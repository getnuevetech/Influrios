import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { proveCollabMoneyReconciliation, STAGING_COLLAB_MONEY_EXAMPLE } from "./collab-journey-money";
import { formatContractMoney, formatMoney } from "./money";

describe("collab journey money reconciliation", () => {
  it("reconciles the ABC Holdings staging example across agreement, checkout, and milestones", () => {
    const checks = proveCollabMoneyReconciliation(STAGING_COLLAB_MONEY_EXAMPLE);
    assert.equal(checks.every((row) => row.ok), true, checks.map((row) => `${row.id}:${row.detail}`).join("; "));
    assert.equal(formatContractMoney(420_000), "$4,200.00");
    assert.equal(formatContractMoney(63_000), "$630.00");
    assert.equal(formatContractMoney(357_000), "$3,570.00");
    assert.notEqual(formatMoney(20_790), formatContractMoney(20_790));
  });

  it("fails when milestone nets drift from the signed influencer payout", () => {
    const checks = proveCollabMoneyReconciliation({
      ...STAGING_COLLAB_MONEY_EXAMPLE,
      milestoneNetCents: [356_900],
    });
    assert.equal(checks.find((row) => row.id === "M4")?.ok, false);
  });
});
