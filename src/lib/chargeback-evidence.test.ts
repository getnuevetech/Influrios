import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import {
  buildChargebackEvidencePack,
  chargebackEvidenceSummary,
  parseChargebackEvidence,
} from "./chargeback-evidence";
import {
  canCreateAnotherShortLink,
  canMintShortLink,
  entitlementSnapshotForMint,
} from "./short-link";
import { PLAN_ENTITLEMENTS } from "./entitlements";

describe("chargeback evidence pack", () => {
  it("builds a durable pack with provider refs", () => {
    const pack = buildChargebackEvidencePack({
      providerCaseId: "cb_123",
      providerReference: "pi_abc",
      amountCents: 12_500,
      currency: "usd",
      reasonCode: "fraudulent",
      notes: "Issuer opened case",
      attachmentUrls: ["https://example.com/a.pdf", ""],
      recordedBy: "admin@influrios.com",
    });
    assert.equal(pack.providerCaseId, "cb_123");
    assert.equal(pack.currency, "USD");
    assert.equal(pack.attachmentUrls.length, 1);
    assert.match(chargebackEvidenceSummary(pack), /case cb_123/);
    assert.match(chargebackEvidenceSummary(pack), /12500¢ USD/);
    assert.equal(parseChargebackEvidence(null), null);
    assert.equal(parseChargebackEvidence(pack)?.providerReference, "pi_abc");
  });

  it("keeps a blank currency blank", () => {
    const pack = buildChargebackEvidencePack({
      amountCents: 4_000,
      currency: "  ",
      recordedBy: "admin@influrios.com",
    });
    assert.equal(pack.currency, "");
    assert.equal(chargebackEvidenceSummary(pack), "4000¢");
    assert.equal(parseChargebackEvidence({ amountCents: 4_000 })?.currency, "");
    assert.equal(parseChargebackEvidence({ currency: "gbp" })?.currency, "GBP");
    const source = readFileSync("src/lib/chargeback-evidence.ts", "utf8");
    const page = readFileSync("src/app/admin/marketplace/page.tsx", "utf8");
    assert.equal(source.includes('|| "USD"'), false);
    assert.equal(source.includes(': "USD"'), false);
    assert.match(page, /formatStoredMoney\(funding\.evidence\.amountCents, funding\.evidence\.currency\)/);
  });
});

describe("short-link entitlement snapshot / max", () => {
  it("freezes plan caps at mint and enforces shortlinkMax", () => {
    const snap = entitlementSnapshotForMint("PRO", PLAN_ENTITLEMENTS.PRO);
    assert.equal(snap.plan, "PRO");
    assert.equal(snap.shortlinkMax, 5);
    assert.equal(snap.dynamicQr, true);
    assert.ok(snap.frozenAt);

    assert.equal(canMintShortLink(PLAN_ENTITLEMENTS.STARTER), false);
    assert.equal(canMintShortLink(PLAN_ENTITLEMENTS.PLUS), true);
    assert.equal(canCreateAnotherShortLink(0, PLAN_ENTITLEMENTS.PLUS), true);
    assert.equal(canCreateAnotherShortLink(1, PLAN_ENTITLEMENTS.PLUS), false);
    assert.equal(canCreateAnotherShortLink(4, PLAN_ENTITLEMENTS.PRO), true);
    assert.equal(canCreateAnotherShortLink(5, PLAN_ENTITLEMENTS.PRO), false);
  });
});
