import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { PLAN_ENTITLEMENTS } from "./entitlements";
import {
  COUNTED_PROPOSAL_STATUSES,
  buildProposalFields,
  commercialChoices,
  decideProposalAllowance,
  normalizeCommercialOptions,
  proposalCountsTowardLimit,
  proposalDenialMessage,
  reasonList,
  transitionCollaboration,
} from "./collaborations";

describe("collaboration states", () => {
  it("walks draft to sent to accepted", () => {
    assert.equal(transitionCollaboration("draft", "sent").ok, true);
    assert.equal(transitionCollaboration("sent", "accepted").ok, true);
    assert.equal(transitionCollaboration("accepted", "declined").ok, false);
    assert.equal(transitionCollaboration("accepted", "withdrawn").ok, false);
  });

  it("lets a draft be withdrawn and a sent proposal be declined", () => {
    assert.equal(transitionCollaboration("draft", "withdrawn").ok, true);
    assert.equal(transitionCollaboration("draft", "accepted").ok, false);
    assert.equal(transitionCollaboration("sent", "declined").ok, true);
    assert.equal(transitionCollaboration("declined", "accepted").ok, false);
  });

  it("rejects an unknown status", () => {
    const result = transitionCollaboration("draft", "archived");
    assert.equal(result.ok, false);
  });
});

describe("proposal allowance", () => {
  it("counts sent, accepted, and declined only", () => {
    assert.deepEqual(COUNTED_PROPOSAL_STATUSES, ["sent", "accepted", "declined"]);
    assert.equal(proposalCountsTowardLimit("draft"), false);
    assert.equal(proposalCountsTowardLimit("withdrawn"), false);
    assert.equal(proposalCountsTowardLimit("sent"), true);
  });

  it("denies a starter plan and names the feature key", () => {
    const decision = decideProposalAllowance(PLAN_ENTITLEMENTS.STARTER, "STARTER", 0);
    assert.equal(decision.ok, false);
    if (!decision.ok) {
      assert.equal(decision.feature, "collaboration.proposals.max");
      assert.equal(decision.limit, 0);
      assert.equal(decision.upgradePlanCode, "PLUS");
      assert.match(proposalDenialMessage(decision, 30), /collaboration\.proposals\.max/);
    }
  });

  it("allows plus inside the window and points past the cap at pro", () => {
    assert.equal(decideProposalAllowance(PLAN_ENTITLEMENTS.PLUS, "PLUS", 7).ok, true);
    const over = decideProposalAllowance(PLAN_ENTITLEMENTS.PLUS, "PLUS", 8);
    assert.equal(over.ok, false);
    if (!over.ok) {
      assert.equal(over.upgradePlanCode, "PRO");
      assert.match(proposalDenialMessage(over, 30), /8 of 8/);
    }
  });
});

describe("collaboration admin copy", () => {
  it("keeps stored match reasons as the original list", () => {
    assert.deepEqual(reasonList(["Complementary specialties: Beauty ↔ Fashion", 4, ""]), [
      "Complementary specialties: Beauty ↔ Fashion",
    ]);
  });

  it("normalizes commercial options and falls back when empty", () => {
    assert.equal(normalizeCommercialOptions(" Paid \n\n Barter "), "Paid\nBarter");
    assert.equal(normalizeCommercialOptions("   "), null);
    assert.equal(commercialChoices("").length, 4);
  });
});

describe("proposal fields", () => {
  it("stores the entered title and scope and leaves a blank role and explanation blank", () => {
    const fields = buildProposalFields({
      title: "  Spring set  ",
      scope: "Two reels and one live",
      roleInitiator: "",
      roleRecipient: "   ",
      why: "",
    });
    assert.equal(fields.ok, true);
    if (!fields.ok) return;
    assert.equal(fields.title, "Spring set");
    assert.equal(fields.scope, "Two reels and one live");
    assert.equal(fields.roleInitiator, "");
    assert.equal(fields.roleRecipient, "");
    assert.equal(fields.why, "");
  });

  it("requires a title and a scope", () => {
    const missing = buildProposalFields({
      title: "  ",
      scope: "Two reels",
      roleInitiator: "Host",
      roleRecipient: "Editor",
      why: "Shared audience",
    });
    assert.equal(missing.ok, false);
    if (!missing.ok) assert.match(missing.error, /title/);
  });

  it("does not invent a sample proposal on the form or the save path", () => {
    const files = [
      "src/lib/collaborations.ts",
      "src/app/collaboration/propose/page.tsx",
      "src/app/collaboration/records/[id]/page.tsx",
    ];
    for (const file of files) {
      const text = readFileSync(file, "utf8");
      assert.equal(text.includes("Joint content series"), false, file);
      assert.equal(text.includes("Collaboration proposal"), false, file);
      assert.equal(text.includes('|| "Influencer"'), false, file);
      assert.equal(text.includes('|| "—"'), false, file);
    }
  });
});
