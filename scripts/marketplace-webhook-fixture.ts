/**
 * Phase M — print a signed marketplace webhook body for staging drills.
 *
 * Usage:
 *   npx tsx scripts/marketplace-webhook-fixture.ts --fundingId=ID --secret=SECRET --event=funding.held --amountCents=5000
 *   npx tsx scripts/marketplace-webhook-fixture.ts --fundingId=ID --secret=SECRET --event=payout.released --amountCents=5000 --provider=primary
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
const app = (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/$/, "");

if (!fundingId || !secret || !(amountCents > 0)) {
  console.error(
    "Usage: npx tsx scripts/marketplace-webhook-fixture.ts --fundingId=... --secret=... --amountCents=N [--event=funding.held|payout.released] [--provider=primary]",
  );
  process.exit(1);
}

const id = `fixture_${event.replace(/\W+/g, "_")}_${Date.now().toString(36)}`;
const payload = {
  id,
  type: event,
  fundingId,
  amountCents,
  provider,
};

const body = JSON.stringify(payload);
const signature = marketplaceSignature(body, secret);

console.log(`POST ${app}/api/marketplace/webhook`);
console.log(`x-influrios-signature: ${signature}`);
console.log(`x-influrios-provider: ${provider}`);
console.log("Content-Type: application/json");
console.log("");
console.log(body);
console.log("");
console.log("Example:");
console.log(
  `curl -sS -X POST '${app}/api/marketplace/webhook' \\\n  -H 'content-type: application/json' \\\n  -H 'x-influrios-provider: ${provider}' \\\n  -H 'x-influrios-signature: ${signature}' \\\n  -d '${body.replace(/'/g, "'\\''")}'`,
);
