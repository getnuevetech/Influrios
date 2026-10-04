import assert from "node:assert/strict";
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
    assert.equal(parseChargebackEvidence(null), null);
    assert.equal(parseChargebackEvidence(pack)?.providerReference, "pi_abc");
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
