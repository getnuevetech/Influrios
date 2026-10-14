/**
 * Phase M — print a signed marketplace webhook body for staging drills.
 *
 * Influrios (primary) shape:
 *   npx tsx scripts/marketplace-webhook-fixture.ts --fundingId=ID --secret=SECRET --event=funding.held --amountCents=5000
 *   npx tsx scripts/marketplace-webhook-fixture.ts --fundingId=ID --secret=SECRET --event=payout.released --amountCents=3000 --milestoneId=MID
 *
 * Airwallex shape (Admin → Gateways → Airwallex webhook secret):
 *   npx tsx scripts/marketplace-webhook-fixture.ts --format=airwallex --fundingId=ID --secret=SECRET --event=funding.held --amountCents=5000
 *   npx tsx scripts/marketplace-webhook-fixture.ts --format=airwallex --fundingId=ID --secret=SECRET --event=payout.released --amountCents=3000 --milestoneId=MID
 */
import { marketplaceSignature } from "../src/lib/ledger";

function arg(name: string) {
  const prefix = `--${name}=`;
  const hit = process.argv.find((item) => item.startsWith(prefix));
  return hit ? hit.slice(prefix.length) : undefined;
}

const fundingId = arg("fundingId");
const secret = arg("secret");
const event = arg("event") || "funding.held";
const amountCents = Number(arg("amountCents") || "0");
const provider = (arg("provider") || "primary").trim().toLowerCase();
const milestoneId = arg("milestoneId");
const format = (arg("format") || "influrios").trim().toLowerCase();
const app = (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/$/, "");

if (!fundingId || !secret || !(amountCents > 0)) {
  console.error(
    "Usage: npx tsx scripts/marketplace-webhook-fixture.ts --fundingId=... --secret=... --amountCents=N [--event=funding.held|payout.released] [--milestoneId=...] [--format=influrios|airwallex] [--provider=primary]",
  );
  process.exit(1);
}

if (event === "payout.released" && !milestoneId) {
  console.error("payout.released requires --milestoneId=… (approved milestone).");
  process.exit(1);
}

const id = `fixture_${event.replace(/\W+/g, "_")}_${Date.now().toString(36)}`;

let body: string;
let providerHeader: string;
let signatureHeader: string;

if (format === "airwallex") {
  const name =
    event === "funding.held"
      ? "payment_intent.succeeded"
      : event === "payout.released"
        ? "funds_split.released"
        : event === "payout.refunded"
          ? "payment_intent.refunded"
          : null;
  if (!name) {
    console.error("Airwallex format supports funding.held, payout.released, payout.refunded.");
    process.exit(1);
  }
  const metadata: Record<string, string> = { fundingId };
  if (milestoneId) metadata.milestoneId = milestoneId;
  body = JSON.stringify({
    id,
    name,
    data: { object: { id: `obj_${id}`, amount: amountCents, metadata } },
  });
  providerHeader = "airwallex";
  signatureHeader = "x-airwallex-signature";
} else {
  const payload: Record<string, unknown> = {
    id,
    type: event,
    fundingId,
    amountCents,
    provider,
  };
  if (milestoneId) payload.milestoneId = milestoneId;
  body = JSON.stringify(payload);
  providerHeader = provider;
  signatureHeader = "x-influrios-signature";
}

const signature = marketplaceSignature(body, secret);

console.log(`POST ${app}/api/marketplace/webhook`);
console.log(`${signatureHeader}: ${signature}`);
console.log(`x-influrios-provider: ${providerHeader}`);
console.log("Content-Type: application/json");
console.log("");
console.log(body);
console.log("");
console.log("Example:");
console.log(
  `curl -sS -X POST '${app}/api/marketplace/webhook' \\\n  -H 'content-type: application/json' \\\n  -H 'x-influrios-provider: ${providerHeader}' \\\n  -H '${signatureHeader}: ${signature}' \\\n  -d '${body.replace(/'/g, "'\\''")}'`,
);
