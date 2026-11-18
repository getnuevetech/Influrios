import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  defaultWithdrawMessage,
  requestDeletePlan,
  withdrawParticipationPlan,
} from "./request-lifecycle";

describe("request lifecycle", () => {
  it("deletes a bare draft, revokes pending invites, and blocks accepted participants", () => {
    assert.deepEqual(
      requestDeletePlan({
        briefStatus: "draft",
        inviteCount: 0,
        pendingInviteCount: 0,
        acceptedWithoutAgreementCount: 0,
        hasSignedAgreement: false,
        hasFundingOrPaymentHistory: false,
        collaborationCompleted: false,
      }),
      { kind: "delete", confirm: "remove_draft", notify: false },
    );
    assert.equal(
      requestDeletePlan({
        briefStatus: "active",
        inviteCount: 2,
        pendingInviteCount: 2,
        acceptedWithoutAgreementCount: 0,
        hasSignedAgreement: false,
        hasFundingOrPaymentHistory: false,
        collaborationCompleted: false,
      }).kind,
      "delete",
    );
    const blocked = requestDeletePlan({
      briefStatus: "active",
      inviteCount: 1,
      pendingInviteCount: 0,
      acceptedWithoutAgreementCount: 1,
      hasSignedAgreement: false,
      hasFundingOrPaymentHistory: false,
      collaborationCompleted: false,
    });
    assert.equal(blocked.kind, "block");
    assert.equal(
      requestDeletePlan({
        briefStatus: "active",
        inviteCount: 1,
        pendingInviteCount: 0,
        acceptedWithoutAgreementCount: 0,
        hasSignedAgreement: true,
        hasFundingOrPaymentHistory: false,
        collaborationCompleted: false,
      }).kind,
      "cancel_settlement",
    );
    assert.equal(
      requestDeletePlan({
        briefStatus: "closed",
        inviteCount: 1,
        pendingInviteCount: 0,
        acceptedWithoutAgreementCount: 0,
        hasSignedAgreement: true,
        hasFundingOrPaymentHistory: true,
        collaborationCompleted: true,
      }).kind,
      "archive",
    );
  });

  it("requires reason and message for business-initiated withdrawal", () => {
    const ok = withdrawParticipationPlan({
      invitationStatus: "ACCEPTED",
      hasSignedAgreement: false,
      hasFundingOrPaymentHistory: false,
      alreadyWithdrawn: false,
      reason: "Campaign cancelled",
      message: "We had to pause this campaign.",
    });
    assert.equal(ok.ok, true);
    if (ok.ok) assert.equal(ok.label, "Withdraw participation");
    assert.equal(
      withdrawParticipationPlan({
        invitationStatus: "ACCEPTED",
        hasSignedAgreement: true,
        hasFundingOrPaymentHistory: false,
        alreadyWithdrawn: false,
        reason: "Campaign cancelled",
        message: "Paused",
      }).ok,
      false,
    );
    assert.equal(
      withdrawParticipationPlan({
        invitationStatus: "ACCEPTED",
        hasSignedAgreement: false,
        hasFundingOrPaymentHistory: false,
        alreadyWithdrawn: false,
        reason: "",
        message: "Paused",
      }).ok,
      false,
    );
    assert.match(
      defaultWithdrawMessage({
        businessName: "ABC Holdings",
        requestTitle: "Fashion to Tech",
        reason: "Campaign cancelled",
      }),
      /ABC Holdings/,
    );
  });
});
