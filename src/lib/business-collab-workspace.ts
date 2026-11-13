import { statusCountsAsOpenRequest } from "@/lib/business-status";

export type RequestQueueRow = {
  id: string;
  title: string;
  facts: Array<"Draft" | "Public listing" | "Private" | "Closed">;
  open: boolean;
  activity: string;
  updatedLabel: string;
  actionLabel: string;
  actionHref: string;
};

export type ActiveQueueRow = {
  id: string;
  title: string;
  influencer: string;
  stage: string;
  nextActor: "You" | "Influencer";
  bucket: "needs_action" | "in_progress" | "completed";
  badge: string;
  href: string;
};

/** A request list action opens responses or the editor. Acceptance is not an edit. */
export function requestQueueRow(input: {
  id: string;
  title: string;
  briefStatus: "draft" | "active" | "closed";
  published: boolean;
  inviteCount: number;
  applicationCount: number;
  acceptedCount: number;
  updatedLabel: string;
}): RequestQueueRow {
  const facts: RequestQueueRow["facts"] = [];
  if (input.briefStatus === "closed") facts.push("Closed");
  if (input.briefStatus === "draft" && !input.published) facts.push("Draft");
  if (input.published) facts.push("Public listing");
  if (input.inviteCount > 0) facts.push("Private");
  if (facts.length === 0) facts.push(input.briefStatus === "draft" ? "Draft" : "Public listing");

  const parts: string[] = [];
  if (input.inviteCount > 0) parts.push(`${input.inviteCount} invite${input.inviteCount === 1 ? "" : "s"} sent`);
  if (input.applicationCount > 0) {
    parts.push(`${input.applicationCount} application${input.applicationCount === 1 ? "" : "s"}`);
  }
  if (input.acceptedCount > 0) parts.push(`${input.acceptedCount} accepted`);
  const activity = parts.join(" · ") || (facts.includes("Draft") ? "Not sent" : "No responses yet");

  const acceptedHref = `/collaboration/business?tab=active`;
  const responsesHref = `/collaboration/business?tab=opportunities&view=applications&request=${encodeURIComponent(input.id)}`;
  const editorHref = `/collaboration/business/request/${encodeURIComponent(input.id)}`;
  const readHref = `/collaboration/business?tab=requests&request=${encodeURIComponent(input.id)}`;

  let actionLabel = "View request";
  let actionHref = readHref;
  if (input.acceptedCount > 0) {
    actionLabel = "Open collaboration";
    actionHref = acceptedHref;
  } else if (facts.includes("Draft") && !input.published && input.inviteCount === 0) {
    actionLabel = "Edit draft";
    actionHref = editorHref;
  } else if (input.inviteCount > 0 || input.applicationCount > 0) {
    actionLabel = input.inviteCount > 0 && !input.published ? "View invitations" : "View responses";
    actionHref = responsesHref;
  }

  return {
    id: input.id,
    title: input.title || "Untitled request",
    facts,
    open: statusCountsAsOpenRequest(input.briefStatus),
    activity,
    updatedLabel: input.updatedLabel,
    actionLabel,
    actionHref,
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
}): ActiveQueueRow | null {
  if (input.status !== "ACCEPTED" && input.status !== "COLLABORATION_DRAFTED") return null;
  const funded = input.fundingStatus === "held" || input.fundingStatus === "completed";
  const completed = input.fundingStatus === "completed";
  if (completed) {
    return {
      id: input.id,
      title: input.title || "Collaboration",
      influencer: input.influencer,
      stage: "Completed",
      nextActor: "You",
      bucket: "completed",
      badge: "Completed",
      href: `/collaboration/business?tab=active&deal=${encodeURIComponent(input.id)}`,
    };
  }
  if (!input.hasContract) {
    return {
      id: input.id,
      title: input.title || "Collaboration",
      influencer: input.influencer,
      stage: "Agreement review",
      nextActor: "You",
      bucket: "needs_action",
      badge: "Needs action",
      href: `/collaboration/business?tab=active&deal=${encodeURIComponent(input.id)}`,
    };
  }
  return {
    id: input.id,
    title: input.title || "Collaboration",
    influencer: input.influencer,
    stage: funded ? "Content production" : "Agreement signed",
    nextActor: funded ? "Influencer" : "You",
    bucket: "in_progress",
    badge: funded ? "In progress" : "Funds not confirmed",
    href: `/collaboration/business?tab=active&deal=${encodeURIComponent(input.id)}`,
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
  if (filter === "closed") return facts.includes("Closed");
  return true;
}
