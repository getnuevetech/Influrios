import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { selectedMonthWindow } from "./business-status";
import {
  buildEarningFacts,
  classifyEarningFact,
  earningsRowStatus,
  isInfluencerReleaseEntry,
  releasedThisMonthCents,
  summarizeEarningFacts,
  type EarningFact,
} from "./earnings-measures";

function fact(overrides: Partial<EarningFact> & Pick<EarningFact, "id" | "milestoneStatus">): EarningFact {
  return {
    title: "Spring launch",
    milestone: "Kickoff",
    currency: "USD",
    amountCents: 1_000,
    payoutState: null,
    releasedAt: null,
    returnedCents: 0,
    ...overrides,
  };
}

describe("influencer payout measures", () => {
  it("keeps paid, processing, failed, and returned on their own records", () => {
    const window = selectedMonthWindow(new Date("2026-04-15T18:00:00.000Z"));
    const paidAt = new Date("2026-04-11T15:00:00.000Z");
    const facts = [
      fact({ id: "paid", milestoneStatus: "released", payoutState: "paid", amountCents: 390_00, releasedAt: paidAt }),
      fact({ id: "processing", milestoneStatus: "release_requested", payoutState: "in_transit", amountCents: 150_00 }),
      fact({ id: "failed", milestoneStatus: "payout_failed", payoutState: "failed", amountCents: 40_00 }),
      fact({ id: "returned", milestoneStatus: "returned", payoutState: "returned", amountCents: 25_00, returnedCents: 25_00 }),
      fact({ id: "upcoming", milestoneStatus: "submitted", amountCents: 585_00 }),
      fact({ id: "unknown", milestoneStatus: "released", payoutState: "unknown", amountCents: 999_00 }),
    ];
    const summary = summarizeEarningFacts(facts, window);
    assert.equal(summary.paidCents, 390_00);
    assert.equal(summary.processingCents, 150_00);
    assert.equal(summary.returnedCents, 65_00);
    assert.equal(summary.upcomingCents, 585_00);
    assert.equal(summary.unknown, true);
    assert.equal(summary.releasedThisMonthCents, 390_00);
    assert.equal(earningsRowStatus(facts[0]!), "Payout confirmed");
    assert.notEqual(earningsRowStatus(facts[0]!), "Payout processing");
    assert.equal(classifyEarningFact(facts[1]!), "processing");
    assert.equal(earningsRowStatus(facts[2]!), "Payout returned");
    assert.equal(earningsRowStatus(facts[3]!), "Payout returned");
    assert.equal(classifyEarningFact({ milestoneStatus: "released", payoutState: null, returnedCents: 0 }), "paid");
    const built = buildEarningFacts(
      [
        {
          id: "funding",
          title: "Spring launch",
          currency: "USD",
          milestones: [
            { id: "paid", title: "Kickoff", amountCents: 400_00, refundedCents: 0, status: "released" },
            { id: "open", title: "Final", amountCents: 600_00, refundedCents: 0, status: "submitted" },
          ],
          entries: [
            { kind: "release", amountCents: 390_00, party: "Influencer", createdAt: paidAt, milestoneId: "paid" },
            { kind: "return", amountCents: 10_00, party: "influencer", createdAt: paidAt, milestoneId: "open" },
          ],
        },
      ],
      [
        { milestoneId: "paid", payoutState: "paid", influencerNetCents: 390_00, currency: "USD", revision: 2 },
        { milestoneId: "paid", payoutState: "queued", influencerNetCents: 1, currency: "USD", revision: 1 },
      ],
    );
    const fromRecords = summarizeEarningFacts(built, window);
    assert.equal(fromRecords.paidCents, 390_00);
    assert.equal(fromRecords.returnedCents, 10_00);
    assert.equal(fromRecords.rows.find((row) => row.id === "paid")?.status, "Payout confirmed");
    assert.equal(fromRecords.rows.find((row) => row.id === "open")?.status, "Payout returned");
    assert.equal(
      releasedThisMonthCents(
        [
          { kind: "release", party: "Influencer", amountCents: 390_00, createdAt: paidAt },
          { kind: "release", party: "business", amountCents: 50_00, createdAt: paidAt },
          { kind: "release", party: "Influencer", amountCents: 80_00, createdAt: new Date("2026-03-01T00:00:00.000Z") },
        ],
        window,
      ),
      390_00,
    );
    assert.equal(isInfluencerReleaseEntry({ kind: "release", party: "Influencer" }), true);
    assert.equal(isInfluencerReleaseEntry({ kind: "hold", party: "Influencer" }), false);
  });
});
