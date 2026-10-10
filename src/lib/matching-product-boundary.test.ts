import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import {
  FUNDABLE_SERVICE_LEVELS,
  MATCHING_PRODUCT_BOUNDARY,
  assertIntroNotProtectedPayment,
  fundableServiceLevelsForUi,
  introStatusDisplayLabel,
  isFundableServiceLevel,
  matchingStageImpliesProtectedPayment,
  paymentDealDraft,
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

describe("payment deal draft", () => {
  it("keeps the entered parties, title, jurisdiction, and amount", () => {
    const draft = paymentDealDraft({
      businessName: " Harbor ",
      creatorSlug: "ada-okonkwo",
      title: "Spring set · 2 of 4",
      jurisdictionCode: "ng",
      grossUsd: "1200",
      serviceLevel: "managed_campaign",
    });
    assert.equal(draft.ok, true);
    if (!draft.ok) return;
    assert.equal(draft.businessName, "Harbor");
    assert.equal(draft.creatorSlug, "ada-okonkwo");
    assert.equal(draft.title, "Spring set");
    assert.equal(draft.jurisdictionCode, "NG");
    assert.equal(draft.grossCents, 120_000);
    assert.equal(draft.serviceLevel, "managed_campaign");
  });

  it("does not invent a creator, a US amount, or a sample brief", () => {
    const draft = paymentDealDraft({ serviceLevel: "contracted" });
    assert.equal(draft.ok, false);
    if (!draft.ok) assert.match(draft.error, /business, creator, title, jurisdiction, and gross/);
  });

  it("does not prefill a sample deal on the payments form", () => {
    const page = readFileSync("src/app/payments/page.tsx", "utf8");
    const actions = readFileSync("src/app/payments/actions.ts", "utf8");
    assert.equal(page.includes("directoryCreators[0]"), false);
    assert.equal(page.includes("defaultValue={4500}"), false);
    assert.equal(page.includes("Product launch collab"), false);
    assert.equal(page.includes('?? "US"'), false);
    assert.equal(actions.includes('?? "US"'), false);
    assert.equal(actions.includes('?? "Ambassador"'), false);
    assert.equal(actions.includes(" ambassador"), false);
  });
});
