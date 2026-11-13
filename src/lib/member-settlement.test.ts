import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { memberReviewBlocksExecution, settlementProposal } from "./cancellation-settlement";
import {
  applyPartyAcceptance,
  disputeProposalDraft,
  memberCancellationReasons,
  memberProposalDecision,
  memberSettlementProposal,
  settlementQuestionDraft,
} from "./member-settlement";

const milestones = [
  {
    grossCents: 40_000,
    businessCollaborationFeeCents: 1_600,
    influencerFeeCents: 1_000,
    influencerNetCents: 39_000,
  },
  {
    grossCents: 60_000,
    businessCollaborationFeeCents: 2_400,
    influencerFeeCents: 1_500,
    influencerNetCents: 58_500,
  },
];

function paidFirstMilestone() {
  const result = settlementProposal({
    businessPaysCents: 105_000,
    activationFeeCents: 1_000,
    activationEligible: true,
    activationException: false,
    review: false,
    milestones: [
      { ...milestones[0], acceptedGrossCents: 40_000 },
      { ...milestones[1], acceptedGrossCents: 0 },
    ],
  });
  assert.equal(result.ok, true);
  if (!result.ok) throw new Error("fixture");
  return result.proposal;
}

describe("member settlement review", () => {
  it("keeps the illustrative settlement amounts and withholds automatic execution", () => {
    const proposal = paidFirstMilestone();
    assert.equal(proposal.influencerNetCents, 39_000);
    assert.equal(proposal.platformRetainedCents, 3_600);
    assert.equal(proposal.businessRefundCents, 62_400);
    assert.equal(proposal.automatic, true);
    const held = memberSettlementProposal(proposal);
    assert.equal(held.automatic, false);
    assert.equal(held.influencerNetCents, 39_000);
    assert.equal(held.platformRetainedCents, 3_600);
    assert.equal(held.businessRefundCents, 62_400);
    const decision = memberProposalDecision({ latest: null, proposal });
    assert.equal(decision.kind, "propose");
    if (decision.kind !== "propose") return;
    assert.equal(decision.proposal.automatic, false);
    assert.equal(decision.create, true);
  });

  it("records one party without accepting the version, then both parties without executing it", () => {
    const first = applyPartyAcceptance({
      status: "proposed",
      versionNumber: 2,
      requestedVersion: 2,
      party: "business",
      actor: "brand@example.com",
      acceptances: {},
      disputed: false,
    });
    assert.equal(first.ok, true);
    if (!first.ok) return;
    assert.equal(first.status, "proposed");
    assert.equal(first.both, false);
    const second = applyPartyAcceptance({
      status: "proposed",
      versionNumber: 2,
      requestedVersion: 2,
      party: "influencer",
      actor: "creator@example.com",
      acceptances: first.acceptances,
      disputed: false,
    });
    assert.equal(second.ok, true);
    if (!second.ok) return;
    assert.equal(second.status, "accepted");
    assert.equal(second.both, true);
  });

  it("rejects a stale version, a dispute, and an already sent settlement", () => {
    const stale = applyPartyAcceptance({
      status: "proposed",
      versionNumber: 3,
      requestedVersion: 2,
      party: "business",
      actor: "brand@example.com",
      acceptances: {},
      disputed: false,
    });
    assert.equal(stale.ok, false);
    const disputed = applyPartyAcceptance({
      status: "proposed",
      versionNumber: 2,
      requestedVersion: 2,
      party: "business",
      actor: "brand@example.com",
      acceptances: {},
      disputed: true,
    });
    assert.equal(disputed.ok, false);
    const sent = applyPartyAcceptance({
      status: "executed",
      versionNumber: 2,
      requestedVersion: 2,
      party: "business",
      actor: "brand@example.com",
      acceptances: { business: "brand@example.com", influencer: "creator@example.com" },
      disputed: false,
    });
    assert.equal(sent.ok, false);
  });

  it("opens a question or dispute without a refund status", () => {
    const question = settlementQuestionDraft({
      status: "proposed",
      versionNumber: 1,
      requestedVersion: 1,
      party: "influencer",
      body: "Can we keep the first delivery?",
    });
    assert.equal(question.ok, true);
    if (!question.ok) return;
    assert.equal(question.question.party, "influencer");
    const dispute = disputeProposalDraft({
      status: "proposed",
      versionNumber: 1,
      requestedVersion: 1,
      note: "The accepted delivery is still in review.",
    });
    assert.equal(dispute.ok, true);
    if (!dispute.ok) return;
    assert.equal(dispute.note.includes("refunded"), false);
    const sent = disputeProposalDraft({
      status: "executed",
      versionNumber: 1,
      requestedVersion: 1,
      note: "This should not open.",
    });
    assert.equal(sent.ok, false);
  });

  it("keeps a member proposal from being executed until that version is accepted", () => {
    assert.equal(
      memberReviewBlocksExecution({
        status: "proposed",
        proposalJson: { memberReview: true },
        decisionKind: "execute",
        sameVersion: true,
      }),
      true,
    );
    assert.equal(
      memberReviewBlocksExecution({
        status: "accepted",
        proposalJson: { memberReview: true },
        decisionKind: "execute",
        sameVersion: true,
      }),
      false,
    );
    assert.equal(
      memberReviewBlocksExecution({
        status: "proposed",
        proposalJson: { memberReview: true },
        decisionKind: "execute",
        sameVersion: false,
      }),
      false,
    );
  });

  it("does not offer chargeback to either party and does not call a provider", () => {
    const reasons = [...memberCancellationReasons("business"), ...memberCancellationReasons("influencer")].map((row) => row.id);
    assert.equal(reasons.includes("chargeback"), false);
    const source = readFileSync(new URL("./member-settlement.ts", import.meta.url), "utf8");
    assert.equal(source.includes("executeHeldCancellation"), false);
    assert.equal(source.includes("adapterForProvider"), false);
    assert.equal(source.includes("createFullRefund"), false);
    assert.equal(source.includes("createPartialRefund"), false);
  });
});
