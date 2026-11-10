import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildFeeDisclosureSummary,
  requireFeeDisclosureAccepted,
  FEE_DISCLOSURE_LEGAL_KEYS,
} from "./fee-disclosure";

describe("fee disclosure (W3.12)", () => {
  const disclosure = {
    feeCents: 1_000,
    ruleId: "rule_default_contracted",
    ruleVersion: 1,
    feeType: "collaboration",
    method: "percent",
    percentBps: 1000,
    payer: "brand",
    jurisdiction: "US",
    serviceLevel: "contracted",
    currency: "USD",
    grossCents: 10_000,
    explanation: "Default contracted collaboration fee",
  };

  it("builds a snapshot-referencing summary without hard-coded marketing %", () => {
    const summary = buildFeeDisclosureSummary(disclosure);
    assert.match(summary, /rule_default_contracted/);
    assert.match(summary, /10\.00%/);
    assert.match(summary, /Gross: \$100\.00/);
    assert.match(summary, /Platform fee: \$10\.00/);
    assert.equal(summary.toLowerCase().includes("cents"), false);
    const campaign = buildFeeDisclosureSummary({
      feeCents: 63_000,
      businessFeeCents: 63_000,
      businessPaysCents: 483_000,
      method: "percent",
      percentBps: 1500,
      jurisdiction: "US",
      serviceLevel: "managed_campaign",
      currency: "USD",
      grossCents: 420_000,
      feeState: "reserved",
    });
    assert.match(campaign, /Gross: \$4,200\.00/);
    assert.match(campaign, /Platform fee: \$630\.00/);
    assert.match(campaign, /Business pays: \$4,830\.00/);
    assert.equal(campaign.toLowerCase().includes("cents"), false);
    assert.match(summary, /Fee schedule/);
    assert.equal(summary.includes("·"), false);
    assert.ok(FEE_DISCLOSURE_LEGAL_KEYS.includes("marketplace-terms"));
  });

  it("requires explicit acceptance before funding", () => {
    const blocked = requireFeeDisclosureAccepted({ accepted: false, disclosure });
    assert.equal(blocked.ok, false);
    const missing = requireFeeDisclosureAccepted({ accepted: true, disclosure: null });
    assert.equal(missing.ok, false);
    const ok = requireFeeDisclosureAccepted({ accepted: true, disclosure });
    assert.equal(ok.ok, true);
    if (ok.ok) {
      assert.ok(ok.record.acceptedAt);
      assert.equal(ok.record.feeCents, 1_000);
      assert.equal(ok.record.ruleId, "rule_default_contracted");
    }
  });
});
