/**
 * Phase M — print staging env / webhook checklist.
 * Does not call SMTP, Stripe, or social providers.
 *
 * Usage: npx tsx scripts/staging-checklist.ts
 */
import { PRODUCT_SWITCHES } from "../src/lib/product-switches";

function present(name: string) {
  const value = process.env[name];
  return Boolean(value && String(value).trim());
}

const app = (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/$/, "");
const required = ["DATABASE_URL"] as const;
const recommended = [
  "NEXT_PUBLIC_APP_URL",
  "ADMIN_SESSION_SECRET",
  "ADMIN_SUPER_EMAIL",
  "ADMIN_SUPER_PASSWORD",
  "CRON_SECRET",
  "MEILI_HOST",
  "MEILI_API_KEY",
  "NEXT_SERVER_ACTIONS_ENCRYPTION_KEY",
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "SMTP_HOST",
  "SMTP_FROM",
  "AIRWALLEX_CLIENT_ID",
  "AIRWALLEX_API_KEY",
] as const;

let missingRequired = 0;

console.log("Influrios staging checklist (Phase M)\n");
console.log(`App origin: ${app}`);
console.log(`HTTPS: ${app.startsWith("https://") ? "yes" : "no — set NEXT_PUBLIC_APP_URL to https on staging"}\n`);

console.log("Webhook / callback URLs");
console.log(`  Stripe billing:     ${app}/api/billing/webhook`);
console.log(`  Marketplace:        ${app}/api/marketplace/webhook`);
console.log(`  Social OAuth:       ${app}/api/social/callback`);
console.log(`  Signing:            ${app}/api/signing/webhook`);
console.log(`  Sweep clock:        ${app}/api/cron/sweeps\n`);

console.log("Required env");
for (const key of required) {
  const ok = present(key);
  if (!ok) missingRequired += 1;
  console.log(`  ${ok ? "OK" : "MISSING"}  ${key}`);
}
const authOk = present("AUTH_SECRET") || present("ADMIN_SESSION_SECRET");
if (!authOk) missingRequired += 1;
console.log(`  ${authOk ? "OK" : "MISSING"}  AUTH_SECRET or ADMIN_SESSION_SECRET`);

console.log("\nRecommended for staging integrations");
for (const key of recommended) {
  console.log(`  ${present(key) ? "set" : "—"}  ${key}`);
}

console.log("\nProduct switch policy (defaults in code)");
for (const row of PRODUCT_SWITCHES) {
  console.log(`  ${row.key}: default ${row.enabled ? "on" : "off"} — ${row.description}`);
}

console.log("\nCheckout stays closed until a Stripe sandbox key is saved. Plans change only after Stripe confirms payment.");
console.log("Leave customer_portal and stripe_connect OFF unless testing those paths.");
console.log("\nFill evidence in docs/deploy/STAGING_LAUNCH_INTEGRATIONS.md — this script does not prove delivery.");

if (missingRequired > 0) {
  console.error(`\n${missingRequired} required env var(s) missing.`);
  process.exit(1);
}

console.log("\nLocal required env looks present.");
