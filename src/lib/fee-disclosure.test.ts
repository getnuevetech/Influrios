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
    grossCents: 10_000,
    explanation: "Default contracted collaboration fee",
  };

  it("builds a snapshot-referencing summary without hard-coded marketing %", () => {
    const summary = buildFeeDisclosureSummary(disclosure);
    assert.match(summary, /rule_default_contracted/);
    assert.match(summary, /10\.00%/);
    assert.match(summary, /fee 1000¢/);
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
