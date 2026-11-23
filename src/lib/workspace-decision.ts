/**
 * One server-side decision for a collaboration milestone row.
 * The button and the next-step sentence both come from this result.
 *
 * FundingMilestone.status "release_requested" is written by the release sweep
 * with no submission version. The only stored version link is a
 * MilestoneSubmission left "approved" by the approval path. Exactly one
 * approved version, and no later open version, ties the release to that
 * version. Any other shape leaves the release untied and holds the action.
 * Approval does not confirm a bank payout.
 */
import { listReturnQuery } from "@/lib/dialog-behavior";
import { advanceMilestone, requestRevision } from "@/lib/ledger";
import { submissionIsComplete } from "@/lib/deliverable-link";
import type { MemberDealView } from "@/lib/member-deal-money";
import { reviewVersionDecision, type ReviewVersion } from "@/lib/version-review";

export type WorkspaceSubmission = {
  version: number;
  status: string;
  note: string;
  linkUrl: string;
  reviewNote: string;
};

export type WorkspaceMilestoneState = {
  fundingStatus: string;
  milestoneStatus: string;
  revisionCount: number;
  revisionLimit: number;
  disputeOpen: boolean;
  submissions: WorkspaceSubmission[];
  /** Ledger release for this milestone. A button or route save does not set this. */
  payoutConfirmed: boolean;
  /** Settlement payoutState paid. Shown separately from the payment column. */
  bankPayoutConfirmed: boolean;
  /** The influencer has not finished payout setup; an approved milestone waits for it. */
  payoutSetupPending?: boolean;
};

export type WorkspaceActor = {
  audience: "business" | "creator";
  assigned: boolean;
};

export type WorkspaceAction =
  | { kind: "submit_first"; version: number; label: "Submit version"; nextActor: string }
  | { kind: "submit_revision"; version: number; label: "Submit revision"; nextActor: string }
  | { kind: "review"; version: number; label: string; nextActor: string }
  | { kind: "recover_payout"; label: "Update payout details"; nextActor: string; href: string }
  | { kind: "view_payment"; label: "View payment history"; nextActor: string; href: string }
  | { kind: "view_details"; label: "View details"; nextActor: string | null };

const RELEASE_STATUSES = new Set([
  "approved",
  "release_scheduled",
  "release_requested",
  "released",
  "payout_failed",
  "returned",
]);

export type ReleaseTie =
  | { kind: "none" }
  | { kind: "tied"; version: number }
  | { kind: "untied"; reason: string };

const UNTIED_RELEASE =
  "Release requested is stored on the milestone and is not tied to a version. The release sweep does not record a submission version, and no single approved version can be matched to it.";

export function tieReleaseToVersion(state: WorkspaceMilestoneState): ReleaseTie {
  if (!RELEASE_STATUSES.has(state.milestoneStatus)) return { kind: "none" };
  const approved = state.submissions.filter((row) => row.status === "approved");
  if (approved.length !== 1) return { kind: "untied", reason: UNTIED_RELEASE };
  const version = approved[0]?.version;
  if (!Number.isInteger(version)) return { kind: "untied", reason: UNTIED_RELEASE };
  const laterOpen = state.submissions.some(
    (row) => row.version > version && (row.status === "submitted" || row.status === "revision_requested"),
  );
  if (laterOpen) return { kind: "untied", reason: UNTIED_RELEASE };
  return { kind: "tied", version };
}

export function recordsDisagree(
  state: WorkspaceMilestoneState,
  complete = true,
): { disagree: boolean; reason: string | null } {
  const tie = tieReleaseToVersion(state);
  if (tie.kind === "untied") return { disagree: true, reason: tie.reason };
  const approved = state.submissions.filter((row) => row.status === "approved");
  const open = state.submissions.filter((row) => row.status === "submitted" || row.status === "revision_requested");
  if (approved.length > 1) {
    return {
      disagree: true,
      reason: "More than one version is approved. The release cannot be tied to a single version.",
    };
  }
  if (approved.length === 1) {
    const version = approved[0]?.version ?? 0;
    if (open.some((row) => row.version > version)) {
      return {
        disagree: true,
        reason: `Version ${version} is approved and a later version is still open. Actions stay off until that discrepancy is resolved.`,
      };
    }
    if (state.milestoneStatus === "pending" || state.milestoneStatus === "submitted") {
      return {
        disagree: true,
        reason: `Version ${version} is approved, but the milestone is still ${state.milestoneStatus.replaceAll("_", " ")}.`,
      };
    }
  }
  if (!complete) return { disagree: false, reason: null };
  if (state.milestoneStatus === "submitted" && !state.submissions.some((row) => row.status === "submitted")) {
    return { disagree: true, reason: "The milestone is in review, but no version is waiting." };
  }
  if (state.milestoneStatus === "pending" && state.submissions.some((row) => row.status === "submitted")) {
    return { disagree: true, reason: "A version is still submitted, but the milestone is waiting for a new submission." };
  }
  return { disagree: false, reason: null };
}

function latestRevision(state: WorkspaceMilestoneState) {
  return state.submissions.reduce<WorkspaceSubmission | null>((latest, row) => {
    if (row.status !== "revision_requested") return latest;
    if (!latest || row.version > latest.version) return row;
    return latest;
  }, null);
}

function nextVersion(state: WorkspaceMilestoneState) {
  return state.submissions.length + 1;
}

export function workspaceDecision(state: WorkspaceMilestoneState, actor: WorkspaceActor): {
  action: WorkspaceAction;
  hold: boolean;
  holdReason: string | null;
  releaseVersion: number | null;
  revisionVersion: number | null;
  workStatus: string;
  workTone: "attention" | "open" | "review" | "done" | "hold";
  paymentStatus: string;
  bankLine: string | null;
  history: string[];
  paymentHistory: string[];
  nextActor: string | null;
  canRequestChanges: boolean;
  feedback: { version: number; note: string } | null;
} {
  const tie = tieReleaseToVersion(state);
  const gap = recordsDisagree(state, actor.audience === "business");
  const revision = latestRevision(state);
  const waiting = reviewVersionDecision({
    versions: state.submissions as ReviewVersion[],
    requestedVersion: currentWaitingVersion(state.submissions),
    intent: "approve",
  });
  const waitingVersion = waiting.ok ? waiting.version : null;
  const hold = gap.disagree;
  const revisionGate = requestRevision({
    fundingStatus: state.fundingStatus,
    milestoneStatus: state.milestoneStatus,
    revisionCount: state.revisionCount,
    revisionLimit: state.revisionLimit,
    disputeOpen: state.disputeOpen,
  });

  const openForReview = state.fundingStatus === "held" || state.fundingStatus === "completed";
  const payoutNeedsRecovery = state.milestoneStatus === "payout_failed" || state.milestoneStatus === "returned";
  let action: WorkspaceAction = { kind: "view_details", label: "View details", nextActor: null };
  if (!hold && state.fundingStatus === "held" && state.milestoneStatus === "pending" && actor.audience === "creator" && actor.assigned) {
    const version = nextVersion(state);
    action = revision
      ? { kind: "submit_revision", version, label: "Submit revision", nextActor: "Next step: Submit revision" }
      : { kind: "submit_first", version, label: "Submit version", nextActor: "Next step: Submit version" };
  } else if (!hold && !state.disputeOpen && actor.audience === "business" && openForReview && waitingVersion != null && state.milestoneStatus === "submitted") {
    action = {
      kind: "review",
      version: waitingVersion,
      label: `Review version ${waitingVersion}`,
      nextActor: `Next step: Review version ${waitingVersion}`,
    };
  } else if (!hold && payoutNeedsRecovery && actor.audience === "creator" && actor.assigned) {
    action = {
      kind: "recover_payout",
      label: "Update payout details",
      nextActor: "Next step: Update payout details",
      href: "/creator/earnings#payouts",
    };
  } else if (!hold && payoutNeedsRecovery && actor.audience === "business") {
    action = {
      kind: "view_payment",
      label: "View payment history",
      nextActor: "Next step: Wait for influencer payout update",
      href: "/payments",
    };
  } else if (!hold && (state.milestoneStatus === "approved" || state.milestoneStatus === "release_scheduled" || state.milestoneStatus === "release_requested" || state.milestoneStatus === "released") && !state.payoutConfirmed && !state.bankPayoutConfirmed) {
    action = {
      kind: "view_details",
      label: "View details",
      nextActor: "Next step: Waiting for bank confirmation",
    };
  }

  const confirmed = state.payoutConfirmed || state.bankPayoutConfirmed;
  return {
    action,
    hold,
    holdReason: hold ? gap.reason : null,
    releaseVersion: tie.kind === "tied" ? tie.version : null,
    revisionVersion: revision?.version ?? null,
    workStatus: workStatusLabel(state, tie, revision, waitingVersion, hold),
    workTone: workTone(state, revision, waitingVersion, hold, tie),
    paymentStatus: paymentStatusLabel(state, confirmed),
    bankLine: confirmed ? "Bank payout confirmed" : null,
    history: versionHistory(state),
    paymentHistory: paymentHistory(state, tie),
    nextActor: action.nextActor,
    canRequestChanges: action.kind === "review" && revisionGate.ok,
    feedback: revision && revision.reviewNote.trim() ? { version: revision.version, note: revision.reviewNote.trim() } : null,
  };
}

function currentWaitingVersion(submissions: WorkspaceSubmission[]) {
  const submitted = submissions.filter((row) => row.status === "submitted");
  if (submitted.length === 0) return Number.NaN;
  return submitted.reduce((latest, row) => (row.version > latest.version ? row : latest)).version;
}

function workStatusLabel(
  state: WorkspaceMilestoneState,
  tie: ReleaseTie,
  revision: WorkspaceSubmission | null,
  waitingVersion: number | null,
  hold: boolean,
) {
  if (hold && revision) return `Revision requested · V${revision.version}`;
  if (hold) return "Recorded history";
  if (state.milestoneStatus === "submitted") return waitingVersion != null ? `In review · V${waitingVersion}` : "In review";
  if (state.milestoneStatus === "pending" && revision) return `Revision requested · V${revision.version}`;
  if (state.milestoneStatus === "pending") return "Open";
  if (tie.kind === "tied") return `Approved · V${tie.version}`;
  if (state.milestoneStatus === "refunded") return "Refunded";
  return state.milestoneStatus.replaceAll("_", " ");
}

function workTone(
  state: WorkspaceMilestoneState,
  revision: WorkspaceSubmission | null,
  waitingVersion: number | null,
  hold: boolean,
  tie: ReleaseTie,
): "attention" | "open" | "review" | "done" | "hold" {
  if (hold && !revision) return "hold";
  if (revision && (hold || state.milestoneStatus === "pending")) return "attention";
  if (state.milestoneStatus === "submitted") return "review";
  if (tie.kind === "tied") return "done";
  return "open";
}

function paymentStatusLabel(state: WorkspaceMilestoneState, confirmed: boolean) {
  if (confirmed) return "Paid";
  if (state.payoutSetupPending && (state.milestoneStatus === "approved" || state.milestoneStatus === "release_scheduled")) {
    return "Approved · payout setup required";
  }
  if (state.milestoneStatus === "released") return "Awaiting confirmation";
  if (state.milestoneStatus === "refunded") return "Refunded";
  if (state.milestoneStatus === "returned") return "Returned";
  if (state.milestoneStatus === "payout_failed") return "Payout failed";
  if (state.milestoneStatus === "release_requested") return "Release requested";
  if (state.milestoneStatus === "release_scheduled") return "Release scheduled";
  if (state.milestoneStatus === "approved") return "Pending confirmation";
  return "—";
}

function submissionLabel(status: string) {
  if (status === "revision_requested") return "Revision requested";
  if (status === "submitted") return "Submitted";
  if (status === "approved") return "Approved";
  return status.replaceAll("_", " ");
}

export function versionHistory(state: WorkspaceMilestoneState) {
  return [...state.submissions]
    .sort((left, right) => left.version - right.version)
    .map((row) => {
      const feedback = row.reviewNote.trim() ? ` Feedback: ${row.reviewNote.trim()}` : "";
      const note = !feedback && row.note.trim() ? ` Note: ${row.note.trim()}` : "";
      const saved = row.linkUrl.trim() ? ` Saved as ${row.linkUrl.trim()}.` : "";
      return `Version ${row.version} · ${submissionLabel(row.status)}.${feedback}${note}${saved}`;
    });
}

export function paymentHistory(state: WorkspaceMilestoneState, tie: ReleaseTie = tieReleaseToVersion(state)) {
  const lines: string[] = [];
  for (const row of [...state.submissions].sort((left, right) => left.version - right.version)) {
    if (row.status !== "approved") continue;
    lines.push(`Approved version ${row.version}. This is the version the release uses. Bank payout is not confirmed.`);
  }
  if (state.milestoneStatus === "release_requested" || state.milestoneStatus === "release_scheduled") {
    const name = state.milestoneStatus === "release_requested" ? "Release requested" : "Release scheduled";
    lines.push(tie.kind === "tied" ? `${name} for approved version ${tie.version}.` : tie.kind === "untied" ? tie.reason : name);
  } else if (tie.kind === "untied") {
    lines.push(tie.reason);
  }
  if (state.payoutConfirmed || state.bankPayoutConfirmed) lines.push("Bank payout confirmed.");
  if (state.milestoneStatus === "released" && !state.payoutConfirmed && !state.bankPayoutConfirmed) {
    lines.push("The milestone is marked released without a confirmed bank payout.");
  }
  return lines;
}

export function workspaceMutationAllowed(
  state: WorkspaceMilestoneState,
  actor: WorkspaceActor,
  intent: "submit" | "approve" | "revise",
  version?: number,
): { ok: true; version: number } | { ok: false; error: string } {
  const decision = workspaceDecision(state, actor);
  if (decision.hold) {
    return { ok: false, error: decision.holdReason ?? "These records disagree. Nothing was changed." };
  }
  if (intent === "submit") {
    if (decision.action.kind !== "submit_first" && decision.action.kind !== "submit_revision") {
      return { ok: false, error: "This milestone is not waiting for a submission. Nothing was saved." };
    }
    return { ok: true, version: decision.action.version };
  }
  if (decision.action.kind !== "review" || decision.action.version == null) {
    return { ok: false, error: "This version is not waiting for review. Nothing was paid." };
  }
  if (!Number.isInteger(version) || version !== decision.action.version) {
    return { ok: false, error: "This version is no longer current. Refresh and review the latest version. Nothing was paid." };
  }
  if (intent === "revise" && !decision.canRequestChanges) {
    return { ok: false, error: "A revision is not available on this version. Nothing was paid." };
  }
  return { ok: true, version: decision.action.version };
}

export function requestWorkspaceChanges(
  state: WorkspaceMilestoneState,
  input: { version: number; note: string },
): { ok: true; state: WorkspaceMilestoneState } | { ok: false; error: string } {
  const allowed = workspaceMutationAllowed(state, { audience: "business", assigned: false }, "revise", input.version);
  if (!allowed.ok) return allowed;
  const decision = reviewVersionDecision({
    versions: state.submissions,
    requestedVersion: input.version,
    intent: "revise",
    note: input.note,
  });
  if (!decision.ok) return decision;
  const gate = requestRevision({
    fundingStatus: state.fundingStatus,
    milestoneStatus: state.milestoneStatus,
    revisionCount: state.revisionCount,
    revisionLimit: state.revisionLimit,
    disputeOpen: state.disputeOpen,
  });
  if (!gate.ok) return gate;
  return {
    ok: true,
    state: {
      ...state,
      milestoneStatus: "pending",
      revisionCount: gate.revisionCount,
      submissions: state.submissions.map((row) =>
        row.version === decision.version ? { ...row, status: "revision_requested", reviewNote: input.note.trim() } : row,
      ),
    },
  };
}

export function submitWorkspaceVersion(
  state: WorkspaceMilestoneState,
  input: { note: string; linkUrl: string; fileCount?: number },
): { ok: true; state: WorkspaceMilestoneState } | { ok: false; error: string } {
  const allowed = workspaceMutationAllowed(state, { audience: "creator", assigned: true }, "submit");
  if (!allowed.ok) return allowed;
  const content = submissionIsComplete({ note: input.note, linkUrl: input.linkUrl, fileCount: input.fileCount ?? 0 });
  if (!content.ok) return content;
  const advanced = advanceMilestone("pending", "submit");
  if (!advanced.ok) return advanced;
  return {
    ok: true,
    state: {
      ...state,
      milestoneStatus: advanced.status,
      submissions: [
        ...state.submissions,
        { version: allowed.version, status: "submitted", note: content.note, linkUrl: content.linkUrl, reviewNote: "" },
      ],
    },
  };
}

export function approveWorkspaceVersion(
  state: WorkspaceMilestoneState,
  version: number,
): { ok: true; state: WorkspaceMilestoneState } | { ok: false; error: string } {
  const allowed = workspaceMutationAllowed(state, { audience: "business", assigned: false }, "approve", version);
  if (!allowed.ok) return allowed;
  const decision = reviewVersionDecision({ versions: state.submissions, requestedVersion: version, intent: "approve" });
  if (!decision.ok) return decision;
  const advanced = advanceMilestone("submitted", "approve");
  if (!advanced.ok) return advanced;
  return {
    ok: true,
    state: {
      ...state,
      milestoneStatus: advanced.status,
      submissions: state.submissions.map((row) =>
        row.version === decision.version ? { ...row, status: "approved" } : row,
      ),
    },
  };
}

export function milestoneAmountColumnLabel(input: {
  amountCents: number[];
  influencerReceivesCents: number | null;
  allocationNetCents?: number[] | null;
}): "Net payout" | "Amount" {
  const amounts = input.amountCents;
  if (amounts.length === 0 || amounts.some((amount) => !Number.isInteger(amount) || amount < 0)) return "Amount";
  const allocations = input.allocationNetCents;
  if (
    allocations &&
    allocations.length === amounts.length &&
    allocations.every((net, index) => Number.isInteger(net) && net === amounts[index])
  ) {
    return "Net payout";
  }
  if (!Number.isInteger(input.influencerReceivesCents)) return "Amount";
  const sum = amounts.reduce((total, amount) => total + amount, 0);
  return sum === input.influencerReceivesCents ? "Net payout" : "Amount";
}

/** Rename only the signed influencer net on this page. Other fee lines stay as stored. */
export function workspaceSummaryLines(view: MemberDealView) {
  if (!(view.role === "influencer" && view.signed && view.feeReady)) return view.lines;
  return view.lines.map((line) =>
    line.label === "Net payout" ? { label: "Agreed net payout", amountCents: line.amountCents } : line,
  );
}

export function fundingStatusLabel(status: string) {
  if (status === "held") return "Funds held";
  if (status === "completed") return "Completed";
  if (status === "awaiting_provider") return "Waiting for funding";
  return status.replaceAll("_", " ");
}

export function workspaceTab(value: string | undefined | null): "milestones" | "files" | "brief" | "messages" {
  if (value === "files" || value === "brief" || value === "messages") return value;
  return "milestones";
}

export const WORKSPACE_RECORD_KEYS = ["focus", "intent", "release", "version", "review", "draftNote", "draftLink", "error", "savedAs"] as const;

export function workspaceCloseQuery(query: Record<string, string | undefined>) {
  return listReturnQuery(query, WORKSPACE_RECORD_KEYS);
}

export function workspaceHref(fundingId: string, query: Record<string, string | undefined>) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value) params.set(key, value);
  }
  const suffix = params.toString();
  return suffix ? `/collaboration/work/${fundingId}?${suffix}` : `/collaboration/work/${fundingId}`;
}

export function orderedByAgreement<T extends { sortOrder: number; id: string }>(rows: T[]) {
  return [...rows].sort((left, right) => left.sortOrder - right.sortOrder || left.id.localeCompare(right.id));
}
