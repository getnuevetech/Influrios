import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { referralId, withReferralParam } from "./referral-cookie";
import { referralCreditDecision, referralProgramDraft, referralRewardLabel } from "./referrals";

describe("referral program", () => {
  it("keeps the short link on the destination and ignores a blank id", () => {
    assert.equal(
      withReferralParam("https://influrios.com/c/ada", "clxyz1234567890"),
      "https://influrios.com/c/ada?ref=clxyz1234567890",
    );
    assert.equal(
      withReferralParam("https://influrios.com/c/ada?ref=alreadythere1", "clxyz1234567890"),
      "https://influrios.com/c/ada?ref=alreadythere1",
    );
    assert.equal(withReferralParam("https://influrios.com/c/ada", "nope"), "https://influrios.com/c/ada");
    assert.equal(referralId("  clxyz1234567890 "), "clxyz1234567890");
    assert.equal(referralId("bad id"), "");
  });

  it("stores the reward that was entered", () => {
    const points = referralProgramDraft({
      enabled: true,
      rewardKind: "points",
      points: "25",
      amount: "",
      currency: "",
    });
    assert.equal(points.ok, true);
    if (points.ok && points.reward.kind === "points") assert.equal(points.reward.points, 25);

    const money = referralProgramDraft({
      enabled: true,
      rewardKind: "money",
      points: "",
      amount: "10.50",
      currency: "usd",
    });
    assert.equal(money.ok, true);
    if (money.ok && money.reward.kind === "money") {
      assert.equal(money.reward.amountCents, 1050);
      assert.equal(money.reward.currency, "USD");
    }

    const blank = referralProgramDraft({
      enabled: true,
      rewardKind: "",
      points: "",
      amount: "",
      currency: "",
    });
    assert.equal(blank.ok, false);
    if (!blank.ok) assert.equal(blank.error, "Choose points or a money amount.");

    const off = referralProgramDraft({
      enabled: false,
      rewardKind: "",
      points: "",
      amount: "",
      currency: "",
    });
    assert.equal(off.ok, true);
    if (off.ok) assert.equal(off.reward.kind, "");
  });

  it("logs a registration only for another account while the saved reward is on", () => {
    const credited = referralCreditDecision({
      enabled: true,
      reward: { kind: "points", points: 25 },
      linkActive: true,
      referrerCreatorId: "creator_1",
      referrerUserId: "user_1",
      referrerEmail: "ada@example.com",
      referredUserId: "user_2",
      referredEmail: "new@example.com",
      alreadyRegistered: false,
    });
    assert.equal(credited.ok, true);

    const self = referralCreditDecision({
      enabled: true,
      reward: { kind: "money", amountCents: 500, currency: "USD" },
      linkActive: true,
      referrerCreatorId: "creator_1",
      referrerUserId: "user_1",
      referrerEmail: "Ada@example.com",
      referredUserId: "user_2",
      referredEmail: "ada@example.com",
      alreadyRegistered: false,
    });
    assert.equal(self.ok, false);
    if (!self.ok) assert.equal(self.reason, "self");

    const disabled = referralCreditDecision({
      enabled: false,
      reward: { kind: "points", points: 25 },
      linkActive: true,
      referrerCreatorId: "creator_1",
      referrerUserId: "user_1",
      referrerEmail: "ada@example.com",
      referredUserId: "user_2",
      referredEmail: "new@example.com",
      alreadyRegistered: false,
    });
    assert.equal(disabled.ok, false);

    const bare = referralCreditDecision({
      enabled: true,
      reward: { kind: "" },
      linkActive: true,
      referrerCreatorId: "creator_1",
      referrerUserId: null,
      referrerEmail: null,
      referredUserId: "user_2",
      referredEmail: "new@example.com",
      alreadyRegistered: false,
    });
    assert.equal(bare.ok, false);
    if (!bare.ok) assert.equal(bare.reason, "no-reward");

    assert.equal(referralRewardLabel({ rewardKind: "points", points: 25, amountCents: 0, currency: "" }), "25 points");
    assert.equal(
      referralRewardLabel({ rewardKind: "money", points: 0, amountCents: 1050, currency: "USD" }),
      "10.50 USD",
    );
    assert.equal(referralRewardLabel({ rewardKind: "", points: 0, amountCents: 0, currency: "" }), "");
  });
});
