import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  auditObjectIdsForFunding,
  feeRuleFromSnapshot,
} from "./admin-transaction-view";

describe("admin transaction view (W2.5)", () => {
  it("extracts frozen fee rule fields from feeSnapshotJson", () => {
    const rule = feeRuleFromSnapshot(
      {
        ruleId: "rule_default_contracted",
        ruleName: "Default contracted",
        ruleVersion: 2,
        feeType: "collaboration",
        method: "percent",
        percentBps: 1000,
        calculatedFeeCents: 1_000,
      },
      "contracted",
      999,
    );
    assert.equal(rule.ruleId, "rule_default_contracted");
    assert.equal(rule.ruleName, "Default contracted");
    assert.equal(rule.ruleVersion, 2);
    assert.equal(rule.feeType, "collaboration");
    assert.equal(rule.method, "percent");
    assert.equal(rule.percentBps, 1000);
    assert.equal(rule.calculatedFeeCents, 1_000);
  });

  it("falls back to funding feeCents and serviceLevel fee type when snapshot is thin", () => {
    const rule = feeRuleFromSnapshot(null, "managed_intro", 2_500);
    assert.equal(rule.ruleId, null);
    assert.equal(rule.feeType, "managed_intro");
    assert.equal(rule.calculatedFeeCents, 2_500);
  });

  it("builds audit object filters for funding + milestones + disputes", () => {
    const ids = auditObjectIdsForFunding({
      fundingId: "fund_1",
      milestoneIds: ["m1", "m2"],
      disputeIds: ["d1"],
    });
    assert.deepEqual(ids.funding, { objectType: "CollaborationFunding", objectId: "fund_1" });
    assert.equal(ids.milestones.length, 2);
    assert.equal(ids.disputes[0]?.objectType, "MilestoneDispute");
  });
});
