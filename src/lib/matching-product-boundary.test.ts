import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  MATCHING_PRODUCT_BOUNDARY,
  assertIntroNotProtectedPayment,
  introStatusDisplayLabel,
  isFundableServiceLevel,
  matchingStageImpliesProtectedPayment,
} from "./matching-product-boundary";

describe("matching product boundary (W4 / R073)", () => {
  it("keeps intro copy distinct from contracted protected payment", () => {
    assert.match(MATCHING_PRODUCT_BOUNDARY.summary, /not a funded collaboration/i);
    assert.equal(introStatusDisplayLabel("paid"), MATCHING_PRODUCT_BOUNDARY.introFeePaidLabel);
    assert.notEqual(introStatusDisplayLabel("paid"), "Fully Funded");
  });

  it("does not treat intro statuses as protected payment", () => {
    assert.equal(matchingStageImpliesProtectedPayment({ introStatus: "introduced" }), false);
    assert.equal(matchingStageImpliesProtectedPayment({ introStatus: "paid" }), false);
    assert.equal(
      matchingStageImpliesProtectedPayment({ serviceLevel: "contracted" }),
      true,
    );
    assert.equal(
      matchingStageImpliesProtectedPayment({ serviceLevel: "discovery" }),
      false,
    );
  });

  it("classifies fundable service levels", () => {
    assert.equal(isFundableServiceLevel("contracted"), true);
    assert.equal(isFundableServiceLevel("managed_campaign"), true);
    assert.equal(isFundableServiceLevel("discovery"), false);
    assert.equal(isFundableServiceLevel("platform_match"), false);
  });

  it("refuses claiming Fully Funded from an intro", () => {
    const blocked = assertIntroNotProtectedPayment({ claimingFullyFunded: true });
    assert.equal(blocked.ok, false);
    if (!blocked.ok) assert.match(blocked.error, /contract wizard/i);
    assert.equal(assertIntroNotProtectedPayment({}).ok, true);
  });
});
