import { statusCountsAsOpenRequest } from "@/lib/business-status";

export type RequestStatusLabel = "Draft" | "Open" | "Closed" | "Cancelled";
export type RequestVisibilityLabel = "Public" | "Invite only";

export type RequestQueueRow = {
  id: string;
  title: string;
  status: RequestStatusLabel;
  visibility: RequestVisibilityLabel;
  /** @deprecated Prefer status + visibility. Kept for filter helpers during migration. */
  facts: Array<"Draft" | "Public listing" | "Private" | "Closed" | "Cancelled" | "Open">;
  open: boolean;
  responses: string;
  activity: string;
  updatedLabel: string;
  actionLabel: "View";
  actionHref: string;
  openCollaborationHref: string | null;
};

export type ActiveQueueRow = {
  id: string;
  title: string;
  influencer: string;
  workStatus: string;
  nextAction: string;
  stage: string;
  nextActor: "You" | "Influencer";
  bucket: "needs_action" | "in_progress" | "completed";
  badge: string;
  href: string;
  contractStatus: "Signed" | "Not signed";
  fundingStatus: "Confirmed" | "Not started" | "Awaiting";
  payoutStatus: "Not started" | "Processing" | "Paid";
  updatedLabel?: string;
};

/** Status is separate from visibility. Invites on a public listing do not flip visibility to Invite only. */
export function requestQueueRow(input: {
  id: string;
  title: string;
  briefStatus: "draft" | "active" | "closed" | "cancelled";
  published: boolean;
  inviteCount: number;
  applicationCount: number;
  acceptedCount: number;
  updatedLabel: string;
  linkedFundingId?: string | null;
}): RequestQueueRow {
  const status: RequestStatusLabel =
    input.briefStatus === "closed"
      ? "Closed"
      : input.briefStatus === "cancelled"
        ? "Cancelled"
        : input.briefStatus === "draft" && !input.published
          ? "Draft"
          : "Open";
  const visibility: RequestVisibilityLabel = input.published ? "Public" : "Invite only";

  const facts: RequestQueueRow["facts"] = [];
  if (status === "Draft") facts.push("Draft");
  if (status === "Open") facts.push("Open");
  if (status === "Closed") facts.push("Closed");
  if (status === "Cancelled") facts.push("Cancelled");
  if (visibility === "Public") facts.push("Public listing");
  if (visibility === "Invite only") facts.push("Private");

  const responseParts: string[] = [];
  if (input.inviteCount > 0) {
    responseParts.push(`${input.inviteCount} invited`);
    if (input.acceptedCount > 0) responseParts.push(`${input.acceptedCount} accepted`);
  } else if (input.applicationCount > 0) {
    responseParts.push(`${input.applicationCount} application${input.applicationCount === 1 ? "" : "s"}`);
    if (input.acceptedCount > 0) responseParts.push(`${input.acceptedCount} accepted`);
  }
  const responses = responseParts.length > 0 ? responseParts.join(" · ") : "No invitations";

  const parts: string[] = [];
  if (input.inviteCount > 0) parts.push(`${input.inviteCount} invite${input.inviteCount === 1 ? "" : "s"} sent`);
  if (input.applicationCount > 0) {
    parts.push(`${input.applicationCount} application${input.applicationCount === 1 ? "" : "s"}`);
  }
  if (input.acceptedCount > 0) parts.push(`${input.acceptedCount} accepted`);
  const activity = parts.join(" · ") || (status === "Draft" ? "Not sent" : "No responses yet");

  const readHref = `/collaboration/business?tab=requests&request=${encodeURIComponent(input.id)}`;
  const openCollaborationHref =
    input.acceptedCount > 0
      ? input.linkedFundingId
        ? `/collaboration/business?tab=active&deal=${encodeURIComponent(input.linkedFundingId)}`
        : `/collaboration/business?tab=active`
      : null;

  return {
    id: input.id,
    title: input.title || "Untitled request",
    status,
    visibility,
    facts,
    open: statusCountsAsOpenRequest(input.briefStatus === "cancelled" ? "closed" : input.briefStatus),
    responses,
    activity,
    updatedLabel: input.updatedLabel,
    actionLabel: "View",
    actionHref: readHref,
    openCollaborationHref,
  };
}

/** Accepted work belongs in Active. An unanswered invite stays on the request. */
export function activeRowForApplication(input: {
  id: string;
  status: string;
  title: string;
  influencer: string;
  hasContract: boolean;
  fundingStatus?: string | null;
  payoutPaid?: boolean;
  updatedLabel?: string;
}): ActiveQueueRow | null {
  if (input.status !== "ACCEPTED" && input.status !== "COLLABORATION_DRAFTED") return null;
  const funded = input.fundingStatus === "held" || input.fundingStatus === "completed";
  const awaiting = input.fundingStatus === "awaiting_provider";
  const completed = input.fundingStatus === "completed";
  const contractStatus = input.hasContract ? "Signed" : "Not signed";
  const fundingStatusLabel = funded ? "Confirmed" : awaiting ? "Awaiting" : "Not started";
  const payoutStatus = input.payoutPaid ? "Paid" : funded ? "Processing" : "Not started";
  const href = `/collaboration/business?tab=active&deal=${encodeURIComponent(input.id)}`;

  if (completed) {
    return {
      id: input.id,
      title: input.title || "Collaboration",
      influencer: input.influencer,
      workStatus: "Completed",
      nextAction: "View record",
      stage: "Completed",
      nextActor: "You",
      bucket: "completed",
      badge: "Completed",
      href,
      contractStatus,
      fundingStatus: fundingStatusLabel,
      payoutStatus,
      updatedLabel: input.updatedLabel,
    };
  }
  if (!input.hasContract) {
    return {
      id: input.id,
      title: input.title || "Collaboration",
      influencer: input.influencer,
      workStatus: "Agreement review",
      nextAction: "Create the agreement",
      stage: "Agreement review",
      nextActor: "You",
      bucket: "needs_action",
      badge: "Needs action",
      href,
      contractStatus,
      fundingStatus: fundingStatusLabel,
      payoutStatus,
      updatedLabel: input.updatedLabel,
    };
  }
  return {
    id: input.id,
    title: input.title || "Collaboration",
    influencer: input.influencer,
    workStatus: funded ? "In progress" : "Agreement signed",
    nextAction: funded ? "Review delivery" : "Deposit funds",
    stage: funded ? "Content production" : "Agreement signed",
    nextActor: funded ? "Influencer" : "You",
    bucket: "in_progress",
    badge: funded ? "In progress" : "Funds not confirmed",
    href,
    contractStatus,
    fundingStatus: fundingStatusLabel,
    payoutStatus,
    updatedLabel: input.updatedLabel,
  };
}

export function requestMatchesFilter(
  facts: RequestQueueRow["facts"],
  filter: string,
  open = false,
): boolean {
  if (filter === "open") return open;
  if (!filter || filter === "all") return true;
  if (filter === "drafts") return facts.includes("Draft");
  if (filter === "published") return facts.includes("Public listing");
  if (filter === "invites") return facts.includes("Private");
  if (filter === "closed") return facts.includes("Closed") || facts.includes("Cancelled");
  return true;
}
