// create-checkout: a signed-in results member asks to buy the 2026 report.
// Validates the request, records a pending order, and returns a Stripe Checkout URL.
// Deployed with JWT verification ON (only signed-in users can call it).
import { db, SB_URL, stripe } from "../_shared/util.ts";

const TERMS_VERSION = "2026-11-25"; // must match src/config.js and terms.html
// Older versions still accepted for pages loaded before an update.
const ACCEPTED_TERMS = [TERMS_VERSION, "2026-11-21"];
const PRICE_CENTS = 129900;
const LOOKUP_KEY = "watchtok-2026-report-1299";
const TAX_CODE = "txcd_10701410";
const ALLOWED_ORIGINS = ["https://watchtoksurvey.com", "https://www.watchtoksurvey.com"];

function cors(origin: string | null) {
  const allow = origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    Vary: "Origin",
  };
}

async function ensurePrice(): Promise<string> {
  const found = await stripe("GET", "prices", { "lookup_keys[]": LOOKUP_KEY, active: "true" });
  if (found.ok && found.json.data?.length) return found.json.data[0].id;
  const product = await stripe("POST", "products", {
    name: "2026 WatchTok Report – full access (12 months)",
    description: "One-time purchase. 12 months of online access to the full 2026 WatchTok Report. No auto-renewal.",
    tax_code: TAX_CODE,
  });
  if (!product.ok) throw new Error(JSON.stringify(product.json));
  const price = await stripe("POST", "prices", {
    product: product.json.id,
    unit_amount: PRICE_CENTS,
    currency: "usd",
    tax_behavior: "exclusive",
    lookup_key: LOOKUP_KEY,
  });
  if (!price.ok) throw new Error(JSON.stringify(price.json));
  return price.json.id;
}

async function ensureCoupon(cents: number): Promise<string> {
  const id = `fm-off-${cents}`;
  const got = await stripe("GET", `coupons/${id}`);
  if (got.ok) return id;
  const made = await stripe("POST", "coupons", {
    id, amount_off: cents, currency: "usd", duration: "once", name: "Founding Member code",
  });
  if (!made.ok) throw new Error(JSON.stringify(made.json));
  return id;
}

Deno.serve(async (req) => {
  const headers = { ...cors(req.headers.get("Origin")), "Content-Type": "application/json" };
  const reply = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers });
  if (req.method === "OPTIONS") return new Response("ok", { headers });
  if (req.method !== "POST") return reply(405, { error: "method" });

  try {
    // Who is asking (token already verified by the gateway; confirm with Auth).
    const auth = req.headers.get("Authorization") ?? "";
    const userRes = await fetch(`${SB_URL}/auth/v1/user`, {
      headers: { Authorization: auth, apikey: Deno.env.get("SUPABASE_ANON_KEY")! },
    });
    if (!userRes.ok) return reply(401, { error: "sign_in" });
    const user = await userRes.json();
    if (!user?.id || user.is_anonymous) return reply(401, { error: "sign_in" });

    const [member] = await db(`results_members?user_id=eq.${user.id}&select=*`);
    if (!member) return reply(403, { error: "register" });
    const tierNow = member.tier === "full" && member.access_until && new Date(member.access_until) <= new Date()
      ? "sample" : member.tier;
    if (tierNow !== "sample") return reply(409, { error: "already_has_access" });

    const body = await req.json().catch(() => ({}));
    if (body.terms_accepted !== true || !ACCEPTED_TERMS.includes(body.terms_version)) {
      return reply(400, { error: "terms" });
    }
    const brand = typeof body.brand_name === "string" ? body.brand_name.trim().slice(0, 160) : "";
    const code = typeof body.code === "string" ? body.code.trim().toUpperCase() : "";

    let codeRow: Record<string, unknown> | null = null;
    if (code) {
      if (!/^[A-Z0-9-]{4,40}$/.test(code)) return reply(400, { error: "code_invalid" });
      [codeRow] = await db(`results_codes?code=eq.${encodeURIComponent(code)}&active=is.true&select=*`);
      if (!codeRow) return reply(400, { error: "code_invalid" });
      if (codeRow.kind === "discount") {
        if (codeRow.max_uses !== null && (codeRow.use_count as number) >= (codeRow.max_uses as number)) {
          return reply(400, { error: "code_used" });
        }
        // Held for 35 minutes by an unfinished checkout from someone else.
        const since = new Date(Date.now() - 35 * 60 * 1000).toISOString();
        const held = await db(
          `results_orders?code=eq.${encodeURIComponent(code)}&status=eq.pending&created_at=gt.${since}&user_id=neq.${user.id}&select=id`,
        );
        if (held.length) return reply(400, { error: "code_in_use" });
      }
    }

    // One open checkout per buyer: close any earlier one, and stop if it was already paid
    // (the payment message can arrive a little after the buyer returns from Stripe).
    const recent = new Date(Date.now() - 35 * 60 * 1000).toISOString();
    const mine = await db(
      `results_orders?user_id=eq.${user.id}&status=eq.pending&stripe_session_id=not.is.null&created_at=gt.${recent}&select=id,stripe_session_id`,
    );
    for (const p of mine) {
      const s = await stripe("GET", `checkout/sessions/${p.stripe_session_id}`);
      if (s.ok && s.json.status === "complete") return reply(409, { error: "payment_processing" });
      if (s.ok && s.json.status === "open") {
        const ex = await stripe("POST", `checkout/sessions/${p.stripe_session_id}/expire`);
        if (!ex.ok) return reply(409, { error: "payment_processing" });
      }
      await db(`results_orders?id=eq.${p.id}&status=eq.pending`, { method: "PATCH", body: JSON.stringify({ status: "expired" }) });
    }

    const [order] = await db("results_orders", {
      method: "POST",
      body: JSON.stringify({
        user_id: user.id,
        email: member.email,
        buyer_name: member.full_name,
        brand_name: brand || null,
        license: brand ? "company" : "personal",
        code: codeRow ? code : null,
        code_kind: codeRow?.kind ?? null,
        referrer_label: codeRow?.member_label ?? null,
        terms_version: body.terms_version,
        terms_accepted_at: new Date().toISOString(),
      }),
    });

    const price = await ensurePrice();
    const discounts = codeRow?.kind === "discount"
      ? [{ coupon: await ensureCoupon(codeRow.discount_cents as number) }]
      : undefined;
    const site = "https://watchtoksurvey.com/results/";
    const session = await stripe("POST", "checkout/sessions", {
      mode: "payment",
      line_items: [{ price, quantity: 1 }],
      managed_payments: { enabled: true },
      client_reference_id: user.id,
      customer_email: member.email,
      metadata: { order_id: order.id },
      payment_intent_data: { metadata: { order_id: order.id } },
      discounts,
      expires_at: Math.floor(Date.now() / 1000) + 30 * 60,
      success_url: `${site}?checkout=success`,
      cancel_url: `${site}?checkout=cancel`,
    });
    if (!session.ok) {
      console.error("stripe session error", JSON.stringify(session.json));
      await db(`results_orders?id=eq.${order.id}`, { method: "PATCH", body: JSON.stringify({ status: "expired" }) });
      return reply(502, { error: "stripe" });
    }
    await db(`results_orders?id=eq.${order.id}`, {
      method: "PATCH",
      body: JSON.stringify({ stripe_session_id: session.json.id }),
    });
    return reply(200, { url: session.json.url });
  } catch (e) {
    console.error("create-checkout failed", e);
    return reply(500, { error: "server" });
  }
});
