import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  FUNDABLE_SERVICE_LEVELS,
  MATCHING_PRODUCT_BOUNDARY,
  assertIntroNotProtectedPayment,
  fundableServiceLevelsForUi,
  introStatusDisplayLabel,
  isFundableServiceLevel,
  matchingStageImpliesProtectedPayment,
  requireFundableServiceLevel,
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

describe("requireFundableServiceLevel (W3.2)", () => {
  it("refuses empty and unknown values instead of inventing contracted", () => {
    const empty = requireFundableServiceLevel("");
    assert.equal(empty.ok, false);
    if (!empty.ok) assert.match(empty.error, /Choose a service level/i);

    const missing = requireFundableServiceLevel(undefined);
    assert.equal(missing.ok, false);

    const unknown = requireFundableServiceLevel("vip_concierge");
    assert.equal(unknown.ok, false);
    if (!unknown.ok) assert.match(unknown.error, /not recognized/i);
  });

  it("refuses discovery / platform_match and accepts fundable levels", () => {
    const discovery = requireFundableServiceLevel("discovery");
    assert.equal(discovery.ok, false);
    if (!discovery.ok) assert.match(discovery.error, /not fundable/i);

    const match = requireFundableServiceLevel("platform_match");
    assert.equal(match.ok, false);

    for (const level of FUNDABLE_SERVICE_LEVELS) {
      const ok = requireFundableServiceLevel(level);
      assert.equal(ok.ok, true);
      if (ok.ok) assert.equal(ok.serviceLevel, level);
    }
  });

  it("filters UI options to fundable levels only", () => {
    assert.deepEqual(
      fundableServiceLevelsForUi(["discovery", "contracted", "managed_intro", "platform_match"]),
      ["contracted", "managed_intro"],
    );
    assert.deepEqual(fundableServiceLevelsForUi(["discovery", "platform_match"]), []);
  });
});
