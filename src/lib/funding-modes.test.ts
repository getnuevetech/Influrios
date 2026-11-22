import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  asFundingMode,
  FUNDING_MODE_LABELS,
  fundingModeBlocksFullyFundedBadge,
  resolveFundingMode,
  fundedWorkCanStart,
} from "./funding-modes";
import { fundingBadge } from "./funding-badge";

describe("funding modes (W3.4)", () => {
  it("resolves FULL / NONE from jurisdiction protection", () => {
    assert.equal(resolveFundingMode({ protectedPaymentsEnabled: true }), "FULL");
    assert.equal(resolveFundingMode({ protectedPaymentsEnabled: false }), "NONE");
    assert.equal(resolveFundingMode({ explicitMode: "NONE", protectedPaymentsEnabled: true }), "NONE");
    assert.equal(asFundingMode("nope"), "FULL");
    // Staged funding was removed; an old STAGED value reads as full prefunding.
    assert.equal(asFundingMode("STAGED"), "FULL");
    assert.deepEqual(Object.keys(FUNDING_MODE_LABELS), ["FULL", "NONE"]);
    assert.equal(FUNDING_MODE_LABELS.NONE, "Outside protected coverage");
  });

  it("starts work only after the provider confirms the prefund", () => {
    assert.equal(fundedWorkCanStart({ fundingStatus: "awaiting_provider" }).ok, false);
    assert.equal(fundedWorkCanStart({ fundingStatus: "held" }).ok, true);
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
