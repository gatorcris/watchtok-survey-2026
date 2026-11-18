// stripe-webhook: Stripe tells us about payments, expiries, refunds and disputes.
// Deployed with JWT verification OFF (Stripe can't send a Supabase token);
// every call is checked against STRIPE_WEBHOOK_SECRET instead.
import { db, rpc } from "../_shared/util.ts";

const enc = new TextEncoder();

async function verify(raw: string, header: string | null, secret: string): Promise<boolean> {
  if (!header) return false;
  const parts = Object.fromEntries(header.split(",").map((p) => p.split("=", 2)) as [string, string][]);
  const t = Number(parts.t);
  if (!t || Math.abs(Date.now() / 1000 - t) > 300) return false;
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", key, enc.encode(`${t}.${raw}`)));
  const expected = Array.from(sig, (b) => b.toString(16).padStart(2, "0")).join("");
  const given = header.split(",").filter((p) => p.startsWith("v1=")).map((p) => p.slice(3));
  return given.some((g) => g.length === expected.length &&
    [...g].reduce((acc, c, i) => acc | (c.charCodeAt(0) ^ expected.charCodeAt(i)), 0) === 0);
}

async function orderByPaymentIntent(pi: string | null) {
  if (!pi) return null;
  const [o] = await db(`results_orders?stripe_payment_intent=eq.${encodeURIComponent(pi)}&select=id`);
  return o ?? null;
}

Deno.serve(async (req) => {
  const secret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
  const raw = await req.text();
  if (!secret || !(await verify(raw, req.headers.get("Stripe-Signature"), secret))) {
    return new Response("bad signature", { status: 400 });
  }
  const event = JSON.parse(raw);

  try {
    const seen = await db(`results_stripe_events?id=eq.${encodeURIComponent(event.id)}&select=id`);
    if (seen.length) return new Response("duplicate", { status: 200 });

    const obj = event.data.object;
    switch (event.type) {
      case "checkout.session.completed":
      case "checkout.session.async_payment_succeeded": {
        if (!["paid", "no_payment_required"].includes(obj.payment_status)) break;
        const orderId = obj.metadata?.order_id;
        if (!orderId) break;
        // With local-currency pricing, record the USD (source) amounts for commissions.
        const cc = obj.currency_conversion;
        const td = cc?.total_details ?? obj.total_details ?? {};
        await db(`results_orders?id=eq.${orderId}&status=in.(pending,expired)`, {
          method: "PATCH",
          body: JSON.stringify({
            status: "paid",
            paid_at: new Date().toISOString(),
            stripe_session_id: obj.id,
            stripe_payment_intent: obj.payment_intent ?? null,
            currency: cc?.source_currency ?? obj.currency,
            amount_subtotal: cc?.amount_subtotal ?? obj.amount_subtotal,
            amount_discount: td.amount_discount ?? 0,
            amount_tax: td.amount_tax ?? 0,
            amount_total: cc?.amount_total ?? obj.amount_total,
          }),
        });
        await rpc("results_grant_paid_access", { p_order: orderId });
        break;
      }
      case "checkout.session.expired": {
        const orderId = obj.metadata?.order_id;
        if (orderId) {
          await db(`results_orders?id=eq.${orderId}&status=eq.pending`, {
            method: "PATCH", body: JSON.stringify({ status: "expired" }),
          });
        }
        break;
      }
      case "charge.refunded": {
        if (!obj.refunded) break; // partial refunds keep access; Cris decides by hand
        const o = await orderByPaymentIntent(obj.payment_intent);
        if (o) await rpc("results_revoke_paid_access", { p_order: o.id, p_status: "refunded" });
        break;
      }
      case "charge.dispute.created": {
        const o = await orderByPaymentIntent(obj.payment_intent);
        if (o) await rpc("results_revoke_paid_access", { p_order: o.id, p_status: "disputed" });
        break;
      }
    }

    await db("results_stripe_events", {
      method: "POST",
      headers: { Prefer: "return=minimal,resolution=ignore-duplicates" },
      body: JSON.stringify({ id: event.id, type: event.type }),
    });
    return new Response("ok", { status: 200 });
  } catch (e) {
    // Non-200 makes Stripe retry later (it retries for up to 3 days).
    console.error("webhook failed", event?.type, e);
    return new Response("error", { status: 500 });
  }
});
