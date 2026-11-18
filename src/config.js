export const SUPABASE_URL = "https://djupcnxgpueafhqcsmud.supabase.co";
export const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_poVf-2ahVdtlKFwgrNuY_A_mWnbwAPg";

// The official public campaign uses the untagged canonical URL.
// Legacy referral handling remains available for controlled research uses.
export const ALLOWED_REFERRAL_CODES = [];

// The 2026 survey closed Nov 2026 (report fixed at the first 309 completed responses).
// While true, the public site shows a closed notice and a 2027 email sign-up instead of the survey.
// Test mode (?test=1) still opens the survey for development; test responses never count.
export const SURVEY_CLOSED = true;

// Paid checkout (Stripe). While false, the buy panel shows only with ?buy=1 (testing);
// everyone else keeps the "Request full access" button. Flip to true on launch day.
export const CHECKOUT_LIVE = false;
// Must match TERMS_VERSION in supabase/functions/create-checkout and the version on terms.html.
export const TERMS_VERSION = "2026-11-18";

export const PRIVACY_VERSION = "V9-final-candidate";
export const SUPPORT_EMAIL = "watchtoksurvey@gmail.com";
