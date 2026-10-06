import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  asFundingMode,
  FUNDING_MODE_LABELS,
  fundingModeBlocksFullyFundedBadge,
  resolveFundingMode,
  stagedPhaseCanStart,
} from "./funding-modes";
import { fundingBadge } from "./funding-badge";

describe("funding modes (W3.4)", () => {
  it("resolves FULL / STAGED / NONE from schedule + jurisdiction", () => {
    assert.equal(resolveFundingMode({ scheduleKind: "once", protectedPaymentsEnabled: true }), "FULL");
    assert.equal(resolveFundingMode({ scheduleKind: "staged", protectedPaymentsEnabled: true }), "STAGED");
    assert.equal(resolveFundingMode({ scheduleKind: "once", protectedPaymentsEnabled: false }), "NONE");
    assert.equal(resolveFundingMode({ scheduleKind: "staged", protectedPaymentsEnabled: false }), "NONE");
    assert.equal(resolveFundingMode({ explicitMode: "NONE", protectedPaymentsEnabled: true }), "NONE");
    assert.equal(asFundingMode("nope"), "FULL");
    assert.equal(asFundingMode("STAGED"), "STAGED");
    assert.equal(FUNDING_MODE_LABELS.NONE, "Outside protected coverage");
  });

  it("refuses unfunded staged phases", () => {
    const blocked = stagedPhaseCanStart({
      fundingMode: "STAGED",
      fundingStatus: "awaiting_provider",
      trancheIndex: 2,
      scheduleKind: "staged",
    });
    assert.equal(blocked.ok, false);
    if (!blocked.ok) assert.match(blocked.error, /not funded/i);

    const allowed = stagedPhaseCanStart({
      fundingMode: "STAGED",
      fundingStatus: "held",
      trancheIndex: 2,
      scheduleKind: "staged",
    });
    assert.equal(allowed.ok, true);
  });

  it("never shows Fully Funded for NONE mode", () => {
    assert.equal(fundingModeBlocksFullyFundedBadge("NONE"), true);
    assert.equal(
      fundingBadge({
        status: "held",
        heldCents: 5_000,
        releasedCents: 0,
        fundingMode: "NONE",
      }),
      "Outside Protected Coverage",
    );
    assert.equal(
      fundingBadge({
        status: "completed",
        heldCents: 0,
        releasedCents: 5_000,
        fundingMode: "NONE",
      }),
      "Outside Protected Coverage",
    );
    assert.equal(
      fundingBadge({
        status: "held",
        heldCents: 5_000,
        releasedCents: 0,
        fundingMode: "FULL",
      }),
      "Fully Funded",
    );
  });
});
