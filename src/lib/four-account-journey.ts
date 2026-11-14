/**
 * Cross-account proof for one private collaboration.
 * Each check uses the existing decision. This module does not move money.
 */
import { authorizeAgencyWorkspaceAction } from "@/lib/agency-context";
import { inboxSourcesFromRecords, projectInboxTasks, taskStateAfterNoticeRead } from "@/lib/action-inbox";
import { invitationsVisibleTo, inviteeResponsePlan } from "@/lib/marketplace-listings";
import { paymentRecoveryView } from "@/lib/payment-recovery";
import { providerEventMayAdvance } from "@/lib/payment-engine";
import { paymentStages } from "@/lib/payment-stages";
import { failedPayoutCommandAllowsRetry } from "@/lib/provider-outbox";
import { recordStatusAxes } from "@/lib/record-status";
import { verifySigningWebhookSignature } from "@/lib/signing";
import { reviewVersionDecision } from "@/lib/version-review";

export type JourneyActor = "influencer" | "business" | "agency" | "admin";

export type JourneyCheck = {
  id: string;
  actor: JourneyActor;
  step: string;
  ok: boolean;
  detail: string;
};

function check(id: string, actor: JourneyActor, step: string, ok: boolean, detail: string): JourneyCheck {
  return { id, actor, step, ok, detail };
}

/** Pausing new funding leaves reconciliation, refunds, and existing payouts available. */
export function journeyFundingInitiation(input: {
  rolloutEnabled: boolean;
  intent: "start_funding" | "reconcile" | "refund" | "payout";
}): { ok: true } | { ok: false; error: string } {
  if (input.intent === "start_funding" && !input.rolloutEnabled) {
    return {
      ok: false,
      error: "New funding initiation is paused. Existing records stay available. Nothing was charged.",
    };
  }
  return { ok: true };
}

/** Paid is the confirmed bank stage. An approval click is not an input. */
export function bankPayoutIsPaid(input: { fundingStatus: string; milestoneStatuses: string[]; entryKinds: string[] }) {
  return paymentStages(input).find((stage) => stage.id === "bank")?.status === "Paid";
}

export function proveFourAccountJourney(): JourneyCheck[] {
  const interest = inviteeResponsePlan({ status: "REQUESTED", intent: "interested" });
  const visible = invitationsVisibleTo(
    [
      { id: "selected", toSlug: "selected", fromSlug: null, offerText: "Selected terms" },
      { id: "other", toSlug: "other", fromSlug: null, offerText: "Other invitee terms" },
    ],
    "selected",
  );
  const stale = reviewVersionDecision({
    versions: [
      { version: 1, status: "submitted" },
      { version: 2, status: "submitted" },
    ],
    requestedVersion: 1,
    intent: "approve",
  });
  const current = reviewVersionDecision({
    versions: [
      { version: 1, status: "revision_requested" },
      { version: 2, status: "submitted" },
    ],
    requestedVersion: 2,
    intent: "approve",
  });
  const approved = recordStatusAxes({
    invitation: "ACCEPTED",
    agreement: "signed",
    fundingStatus: "held",
    deliveryStatus: "approved",
    milestoneStatus: "approved",
  });
  const paid = recordStatusAxes({
    invitation: "ACCEPTED",
    agreement: "signed",
    fundingStatus: "held",
    deliveryStatus: "released",
    milestoneStatus: "released",
    payoutState: "paid",
  });
  const checkout = providerEventMayAdvance({
    eventName: "payment_intent.succeeded",
    holdingAvailable: false,
    beneficiaryConfirmed: false,
    amountCents: 10_000,
    expectedAmountCents: 10_000,
    currency: "USD",
    expectedCurrency: "USD",
    accountId: "acct",
    expectedAccountId: "acct",
    environment: "demo",
    expectedEnvironment: "demo",
    fundingId: "deal",
    expectedFundingId: "deal",
    duplicate: false,
  });
  const replay = providerEventMayAdvance({
    eventName: "payment_intent.succeeded",
    holdingAvailable: true,
    beneficiaryConfirmed: false,
    amountCents: 10_000,
    expectedAmountCents: 10_000,
    currency: "USD",
    expectedCurrency: "USD",
    accountId: "acct",
    expectedAccountId: "acct",
    environment: "demo",
    expectedEnvironment: "demo",
    fundingId: "deal",
    expectedFundingId: "deal",
    duplicate: true,
  });
  const tasks = projectInboxTasks(
    inboxSourcesFromRecords({
      workspaceId: "ws",
      audience: "business",
      contracts: [{ id: "contract", title: "Agreement", href: "/collaboration/contracts/contract" }],
      invitations: [],
      funding: [],
      submissions: [],
      payouts: [],
      creatorDeliverables: [],
    }),
  );
  const signature = tasks.find((task) => task.action === "review_contract");
  const recovery = paymentRecoveryView({
    audience: "business",
    stages: [
      { id: "delivery", status: "Complete" },
      { id: "transfer", status: "Confirmed" },
      { id: "bank", status: "Returned" },
    ],
  });
  const member = authorizeAgencyWorkspaceAction({
    action: "act_for_client",
    sealed: { workspaceId: "ws-a", clientId: "client-a" },
    posted: { workspaceId: "ws-a", clientId: "client-a" },
    seatsEnabled: true,
    actor: { userId: "member", email: "member@example.com" },
    ownerWorkspaceId: "ws-a",
    memberships: [
      {
        workspaceId: "ws-a",
        role: "member",
        inviteStatus: "accepted",
        active: true,
        acceptedUserId: "member",
        email: "member@example.com",
      },
    ],
    client: { id: "client-a", workspaceId: "ws-a" },
  });
  const staleForm = authorizeAgencyWorkspaceAction({
    action: "manage_campaign",
    sealed: { workspaceId: "ws-a", clientId: "client-a" },
    posted: { workspaceId: "ws-b", clientId: "client-b" },
    seatsEnabled: true,
    actor: { userId: "owner", email: "owner@example.com" },
    ownerWorkspaceId: "ws-a",
    memberships: [
      {
        workspaceId: "ws-a",
        role: "owner",
        inviteStatus: "accepted",
        active: true,
        acceptedUserId: "owner",
        email: "owner@example.com",
      },
      {
        workspaceId: "ws-b",
        role: "owner",
        inviteStatus: "accepted",
        active: true,
        acceptedUserId: "owner",
        email: "owner@example.com",
      },
    ],
    client: { id: "client-a", workspaceId: "ws-a" },
  });
  const paused = journeyFundingInitiation({ rolloutEnabled: false, intent: "start_funding" });
  const reconcile = journeyFundingInitiation({ rolloutEnabled: false, intent: "reconcile" });

  return [
    check(
      "J1",
      "influencer",
      "Interest is not a contract",
      interest.ok === true && interest.ok && !interest.steps.includes("ACCEPTED"),
      interest.ok ? interest.steps.join(",") : interest.error,
    ),
    check(
      "J2",
      "influencer",
      "Unselected invitee terms stay hidden",
      visible.length === 1 && visible[0]?.id === "selected" && !visible.some((row) => row.offerText.includes("Other")),
      visible.map((row) => row.id).join(","),
    ),
    check(
      "J3",
      "business",
      "Stale delivery version cannot be approved",
      stale.ok === false,
      stale.ok ? "approved" : stale.error,
    ),
    check(
      "J4",
      "business",
      "Current delivery version can be reviewed",
      current.ok === true && current.ok && current.version === 2,
      current.ok ? String(current.version) : current.error,
    ),
    check(
      "J5",
      "business",
      "Approval is not a bank payout",
      approved.delivery === "Approved" && approved.payout === "Processing" && !bankPayoutIsPaid({
        fundingStatus: "held",
        milestoneStatuses: ["approved"],
        entryKinds: ["hold"],
      }),
      approved.payout,
    ),
    check(
      "J6",
      "influencer",
      "Paid follows a confirmed bank payout",
      paid.payout === "Paid" &&
        bankPayoutIsPaid({ fundingStatus: "held", milestoneStatuses: ["released"], entryKinds: ["hold", "release"] }),
      paid.payout,
    ),
    check(
      "J7",
      "business",
      "Checkout return does not confirm funding",
      checkout.advance === false,
      checkout.advance ? "advanced" : checkout.reason,
    ),
    check(
      "J8",
      "admin",
      "A replayed provider event does not advance",
      replay.advance === false,
      replay.advance ? "advanced" : replay.reason,
    ),
    check(
      "J9",
      "business",
      "Reading a notification leaves the signature task open",
      signature?.state === "Open" && taskStateAfterNoticeRead(signature.state) === "Open",
      signature?.state ?? "missing",
    ),
    check(
      "J10",
      "business",
      "Returned payout stays with the influencer",
      recovery?.kind === "business" &&
        recovery.kind === "business" &&
        recovery.detail === "Action is required from the influencer before payout can continue." &&
        recovery.cta === "View payment history",
      recovery?.kind ?? "none",
    ),
    check(
      "J11",
      "agency",
      "A member cannot act for the client",
      member.ok === false,
      member.ok ? member.role : member.error,
    ),
    check(
      "J12",
      "agency",
      "A stale workspace form cannot retarget the action",
      staleForm.ok === false && staleForm.ok === false && staleForm.workspaceId === "ws-a",
      staleForm.ok ? "allowed" : staleForm.error,
    ),
    check(
      "J13",
      "admin",
      "An unsigned webhook is rejected",
      verifySigningWebhookSignature("{}", null, "secret") === false &&
        verifySigningWebhookSignature("{}", "sha256=deadbeef", "secret") === false,
      "rejected",
    ),
    check(
      "J14",
      "admin",
      "A confirmed payout command is not sent again",
      failedPayoutCommandAllowsRetry("confirmed") === false && failedPayoutCommandAllowsRetry("failed") === true,
      "confirmed stays put",
    ),
    check(
      "J15",
      "business",
      "Rollback pauses new funding and keeps reconciliation",
      paused.ok === false && reconcile.ok === true,
      paused.ok ? "started" : paused.error,
    ),
  ];
}
