import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { PLAN_ENTITLEMENTS } from "./entitlements";
import { advanceClaimStage, evaluateCompletion, secondSocialDecision, toPublicProfile } from "./onboarding";

describe("onboarding completion", () => {
  it("scores a private draft below a published profile", () => {
    const draft = evaluateCompletion({
      stage: "draft",
      bio: "Draft Influencer Card for @new.",
      locationCity: "Your city",
      locationCountry: "Your country",
      specialties: ["lifestyle"],
    });
    const live = evaluateCompletion({
      stage: "published",
      bio: "Beauty educator sharing routines, product notes, and studio days with a real audience.",
      locationCity: "Lagos",
      locationCountry: "Nigeria",
      specialties: ["beauty"],
    });
    assert.equal(draft.score, 0);
    assert.equal(live.score, 100);
    assert.equal(live.items.find((item) => item.id === "email_verified")?.done, true);
  });
});

describe("claim states", () => {
  it("walks draft to claimed to verified to published", () => {
    const claimed = advanceClaimStage("draft", "claim");
    assert.equal(claimed.ok, true);
    if (!claimed.ok) return;
    const verified = advanceClaimStage(claimed.stage, "verify");
    assert.equal(verified.ok, true);
    if (!verified.ok) return;
    const published = advanceClaimStage(verified.stage, "publish");
    assert.equal(published.ok && published.stage, "published");
  });

  it("refuses to skip verification or reopen a published card", () => {
    assert.equal(advanceClaimStage("draft", "verify").ok, false);
    assert.equal(advanceClaimStage("draft", "publish").ok, false);
    assert.equal(advanceClaimStage("claimed", "publish").ok, false);
    assert.equal(advanceClaimStage("published", "claim").ok, false);
    assert.equal(advanceClaimStage("published", "publish").ok, true);
  });
});

describe("starter social cap", () => {
  it("denies a second social with the feature key and upgrade plan", () => {
    const first = secondSocialDecision(0, PLAN_ENTITLEMENTS.STARTER, "STARTER");
    const second = secondSocialDecision(1, PLAN_ENTITLEMENTS.STARTER, "STARTER");
    assert.equal(first.ok, true);
    assert.equal(second.ok, false);
    if (!second.ok) {
      assert.equal(second.feature, "card.social_links.max");
      assert.equal(second.limit, 1);
      assert.equal(second.upgradePlanCode, "PLUS");
    }
  });
});

describe("public profile", () => {
  it("strips email from the public shape", () => {
    const profile = toPublicProfile({
      slug: "ada",
      displayName: "Ada",
      email: "ada@example.com",
    });
    assert.equal("email" in profile, false);
    assert.equal(profile.displayName, "Ada");
  });
});
