import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL, SUPPORT_EMAIL } from "./config.js";

const title = document.querySelector("[data-confirm-title]");
const message = document.querySelector("[data-confirm-message]");
const token = new URLSearchParams(window.location.search).get("t") || "";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function show(heading, text) {
  title.textContent = heading;
  message.textContent = text;
}

async function confirm() {
  if (!UUID.test(token)) {
    return show("That link doesn't look right.", `Please use the link from your confirmation email, or contact ${SUPPORT_EMAIL}.`);
  }
  try {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/confirm_contact_optin`, {
      method: "POST",
      headers: { apikey: SUPABASE_PUBLISHABLE_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({ p_token: token })
    });
    if (!response.ok) throw new Error(`Request failed (${response.status})`);
    const result = await response.json();
    if (result === "confirmed") return show("You're confirmed.", "We'll email you when the 2027 WatchTok survey opens.");
    if (result === "already") return show("You're already confirmed.", "We'll email you when the 2027 WatchTok survey opens.");
    return show("We couldn't find that sign-up.", `The link may be incomplete. Contact ${SUPPORT_EMAIL} if you need help.`);
  } catch {
    show("We couldn't confirm your email right now.", "Please try the link again in a few minutes.");
  }
}

confirm();
