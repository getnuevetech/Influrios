/**
 * In-app notice filters. Reading a notice is not the same as finishing its task.
 * Payment notices never move money.
 */

export type NoticeFilter = "all" | "action" | "invitations" | "work" | "payments";

export type NoticeGroup = "invitations" | "work" | "payments" | "updates";

export type NoticeDraftInput = {
  kind: string;
  sourceId: string;
  title: string;
  detail: string;
  href: string;
};

export const PAYOUT_RETURNED_NOTE =
  "The delivery stays approved. Open the payment to recover the payout. Nothing was refunded from this notice.";

export function noticeGroup(kind: string, title = ""): NoticeGroup {
  const text = `${kind} ${title}`.toLowerCase();
  if (/invit|application|responses to review/.test(text)) return "invitations";
  if (/payout|funding|refund|payment|billing/.test(text)) return "payments";
  if (/deliver|revision|milestone|agreement|signature|workspace|submission/.test(text)) return "work";
  return "updates";
}

export function noticeNeedsAction(kind: string, title = "") {
  const text = `${kind} ${title}`.toLowerCase();
  if (noticeGroup(kind, title) === "updates") return false;
  if (/completed|successful|succeeded/.test(text) && !/returned|failed/.test(text)) return false;
  return true;
}

export function noticeMatchesFilter(filter: NoticeFilter, kind: string, title = "") {
  if (filter === "all") return true;
  if (filter === "action") return noticeNeedsAction(kind, title);
  return noticeGroup(kind, title) === filter;
}

export function noticeFilterFromQuery(value: string | undefined): NoticeFilter {
  if (value === "action" || value === "invitations" || value === "work" || value === "payments") return value;
  return "all";
}

export function noticeEventLabel(kind: string, title = "") {
  const text = `${kind} ${title}`.toLowerCase();
  if (/payout_returned|returned/.test(text)) return "Payout returned";
  if (/failed/.test(text) && noticeGroup(kind, title) === "payments") return "Payment needs attention";
  const group = noticeGroup(kind, title);
  if (group === "invitations") return "Invitation";
  if (group === "payments") return "Payment";
  if (/agreement|signature/.test(text)) return "Signature";
  if (group === "work") return "Work";
  return "Update";
}

export function noticeActor(kind: string, detail: string) {
  const submission = detail.match(/^Submission from (.+)$/);
  if (submission?.[1]) return submission[1];
  if (noticeGroup(kind, detail) === "invitations") {
    return /respond/.test(detail.toLowerCase()) ? "Influencer" : "Business";
  }
  if (/signature/.test(`${kind} ${detail}`.toLowerCase())) return "Counterparty";
  return "Influrios";
}

export function noticeKeepsWorkApproved(kind: string) {
  return /payout_returned|returned/.test(kind.toLowerCase());
}

export function businessAttentionDrafts(input: {
  pendingResponses: number;
  contracts: { id: string; title: string }[];
  funding: { id: string; title: string; href: string }[];
  reviews: { id: string; title: string; counterparty: string; href: string }[];
}): NoticeDraftInput[] {
  const drafts: NoticeDraftInput[] = [];
  if (input.pendingResponses > 0) {
    drafts.push({
      kind: "invitation",
      sourceId: "business-responses",
      title: `${input.pendingResponses} response${input.pendingResponses === 1 ? "" : "s"} to review`,
      detail: "Influencers have responded to your invites.",
      href: "/collaboration/business",
    });
  }
  for (const contract of input.contracts) {
    if (!contract.id) continue;
    drafts.push({
      kind: "agreement",
      sourceId: contract.id,
      title: contract.title || "Agreement",
      detail: "Your signature is needed",
      href: `/collaboration/contracts/${contract.id}`,
    });
  }
  for (const item of input.funding) {
    if (!item.id) continue;
    drafts.push({
      kind: "funding",
      sourceId: item.id,
      title: item.title || "Collaboration",
      detail: "Funding is needed before work starts",
      href: item.href.startsWith("/") ? item.href : "/payments",
    });
  }
  for (const item of input.reviews) {
    if (!item.id) continue;
    drafts.push({
      kind: "deliverable",
      sourceId: `review:${item.id}`,
      title: item.title || "Submission",
      detail: item.counterparty ? `Submission from ${item.counterparty}` : "A submission is ready to review",
      href: item.href.startsWith("/") ? item.href : "/payments",
    });
  }
  return drafts.filter((draft) => draft.href.startsWith("/") && draft.sourceId.length > 0);
}
