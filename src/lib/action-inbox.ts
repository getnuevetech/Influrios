/**
 * Action inbox projection. Tasks come from canonical records.
 * Opening or reading a notification does not resolve a task.
 */

export type InboxAction =
  | "review_contract"
  | "review_delivery"
  | "review_funding"
  | "update_payout"
  | "review_invitation"
  | "submit_delivery";

export type InboxTaskState = "Open" | "Blocked" | "Resolved" | "Superseded";

export type InboxSource = {
  workspaceId: string;
  recordId: string;
  version: string;
  action: InboxAction;
  title: string;
  counterparty: string;
  dueLabel: string;
  href: string;
  mine: boolean;
  resolved?: boolean;
  blocked?: boolean;
  linkLabel?: string;
};

export type InboxTask = InboxSource & {
  key: string;
  state: InboxTaskState;
  cta: "Review contract" | "Review delivery" | "Review funding" | "Update payout details" | "Review invitation" | null;
};

const CTA: Partial<Record<InboxAction, NonNullable<InboxTask["cta"]>>> = {
  review_contract: "Review contract",
  review_delivery: "Review delivery",
  review_funding: "Review funding",
  update_payout: "Update payout details",
  review_invitation: "Review invitation",
};

export function inboxTaskKey(input: Pick<InboxSource, "workspaceId" | "recordId" | "version" | "action" | "mine">) {
  return [input.workspaceId, input.recordId, input.version, input.action, input.mine ? "me" : "other"].join(":");
}

export function projectInboxTasks(sources: readonly InboxSource[]): InboxTask[] {
  const byKey = new Map<string, InboxSource>();
  for (const source of sources) {
    byKey.set(inboxTaskKey(source), source);
  }
  const deliveries = [...byKey.values()].filter((row) => row.action === "review_delivery");
  return [...byKey.values()].map((source) => {
    const newerDelivery =
      source.action === "review_delivery" &&
      deliveries.some(
        (row) =>
          row.workspaceId === source.workspaceId &&
          row.recordId === source.recordId &&
          Number(row.version) > Number(source.version),
      );
    const state: InboxTaskState = newerDelivery
      ? "Superseded"
      : source.resolved
        ? "Resolved"
        : source.blocked
          ? "Blocked"
          : "Open";
    const actionable = state === "Open" && source.mine;
    return {
      ...source,
      key: inboxTaskKey(source),
      state,
      cta: actionable ? (CTA[source.action] ?? null) : null,
    };
  });
}

/** A read receipt never changes the task state. */
export function taskStateAfterNoticeRead(state: InboxTaskState): InboxTaskState {
  return state;
}

export type InboxTab = "assigned" | "waiting" | "resolved";

export function inboxTabFromQuery(value: string | undefined): InboxTab {
  if (value === "waiting" || value === "resolved") return value;
  return "assigned";
}

export function tasksForTab(tasks: readonly InboxTask[], tab: InboxTab) {
  if (tab === "resolved") return tasks.filter((task) => task.state === "Resolved" || task.state === "Superseded");
  if (tab === "waiting") return tasks.filter((task) => (task.state === "Open" || task.state === "Blocked") && !task.mine);
  return tasks.filter((task) => (task.state === "Open" || task.state === "Blocked") && task.mine);
}

export type InboxTypeFilter = "all" | "contract" | "delivery" | "funding" | "payout" | "invitation";

export function inboxTypeFromQuery(value: string | undefined): InboxTypeFilter {
  if (value === "contract" || value === "delivery" || value === "funding" || value === "payout" || value === "invitation") {
    return value;
  }
  return "all";
}

export function inboxChip(task: Pick<InboxTask, "action" | "version">) {
  if (task.action === "review_delivery") return `Review delivery v${task.version}`;
  if (task.action === "review_contract") return "Signature required";
  if (task.action === "review_funding") return "Funding required";
  if (task.action === "update_payout") return "Payout failed";
  if (task.action === "submit_delivery") return "Delivery due";
  return "Invitation";
}

export function taskMatchesInbox(task: InboxTask, input: { q?: string; type?: InboxTypeFilter }) {
  const type = input.type ?? "all";
  const typeOk =
    type === "all" ||
    (type === "contract" && task.action === "review_contract") ||
    (type === "delivery" && (task.action === "review_delivery" || task.action === "submit_delivery")) ||
    (type === "funding" && task.action === "review_funding") ||
    (type === "payout" && task.action === "update_payout") ||
    (type === "invitation" && task.action === "review_invitation");
  if (!typeOk) return false;
  const q = (input.q ?? "").trim().toLowerCase();
  if (!q) return true;
  return `${task.title} ${task.counterparty} ${inboxChip(task)}`.toLowerCase().includes(q);
}

export type InboxRecordInput = {
  workspaceId: string;
  audience: "business" | "influencer";
  contracts: { id: string; title: string; href: string }[];
  invitations: { id: string; title: string; counterparty: string; href: string }[];
  funding: { id: string; title: string; counterparty: string; href: string; needsFunding: boolean; blocked: boolean }[];
  submissions: {
    fundingId: string;
    milestoneId: string;
    version: number;
    status: string;
    title: string;
    counterparty: string;
  }[];
  payouts: { id: string; title: string; counterparty: string; bankReturned: boolean }[];
  creatorDeliverables: { id: string; title: string; counterparty: string; href: string; dueLabel: string }[];
};

/** Tasks from canonical records. A notice read flag is not an input. */
export function inboxSourcesFromRecords(input: InboxRecordInput): InboxSource[] {
  const business = input.audience === "business";
  const sources: InboxSource[] = [];
  for (const contract of input.contracts) {
    sources.push({
      workspaceId: input.workspaceId,
      recordId: contract.id,
      version: "signature",
      action: "review_contract",
      title: contract.title || "Agreement",
      counterparty: "Counterparty",
      dueLabel: "No deadline",
      href: contract.href,
      mine: true,
    });
  }
  for (const invitation of input.invitations) {
    sources.push({
      workspaceId: input.workspaceId,
      recordId: invitation.id,
      version: "invite",
      action: "review_invitation",
      title: invitation.title || "Campaign invitation",
      counterparty: invitation.counterparty || "Counterparty",
      dueLabel: "No deadline",
      href: invitation.href,
      mine: true,
    });
  }
  for (const row of input.funding) {
    if (!row.needsFunding && !row.blocked) continue;
    sources.push({
      workspaceId: input.workspaceId,
      recordId: row.id,
      version: "funding",
      action: "review_funding",
      title: row.title || "Collaboration",
      counterparty: row.counterparty || "Counterparty",
      dueLabel: row.blocked ? "Awaiting confirmation" : "No deadline",
      href: row.href,
      mine: business,
      blocked: row.blocked,
    });
  }
  for (const row of input.submissions) {
    const href = `/collaboration/work/${row.fundingId}?version=${row.version}`;
    if (row.status === "submitted") {
      sources.push({
        workspaceId: input.workspaceId,
        recordId: row.milestoneId,
        version: String(row.version),
        action: "review_delivery",
        title: row.title || "Submission",
        counterparty: row.counterparty || "Counterparty",
        dueLabel: "No deadline",
        href,
        mine: business,
      });
    } else if (row.status === "revision_requested") {
      sources.push({
        workspaceId: input.workspaceId,
        recordId: row.milestoneId,
        version: String(row.version),
        action: "review_delivery",
        title: row.title || "Submission",
        counterparty: row.counterparty || "Counterparty",
        dueLabel: "No deadline",
        href,
        mine: business,
        resolved: true,
      });
      if (!business) {
        sources.push({
          workspaceId: input.workspaceId,
          recordId: row.milestoneId,
          version: String(row.version),
          action: "submit_delivery",
          title: row.title || "Submission",
          counterparty: row.counterparty || "Counterparty",
          dueLabel: "No deadline",
          href: `/collaboration/work/${row.fundingId}`,
          mine: true,
          linkLabel: "Open workspace",
        });
      }
    } else if (row.status === "approved") {
      sources.push({
        workspaceId: input.workspaceId,
        recordId: row.milestoneId,
        version: String(row.version),
        action: "review_delivery",
        title: row.title || "Submission",
        counterparty: row.counterparty || "Counterparty",
        dueLabel: "No deadline",
        href,
        mine: business,
        resolved: true,
      });
    }
  }
  for (const row of input.payouts) {
    if (!row.bankReturned) continue;
    sources.push({
      workspaceId: input.workspaceId,
      recordId: row.id,
      version: "bank",
      action: "update_payout",
      title: row.title || "Collaboration",
      counterparty: row.counterparty || "Counterparty",
      dueLabel: "Payout failed",
      href: business ? `/payments?deal=${encodeURIComponent(row.id)}&tab=transactions` : "/creator/earnings#payouts",
      mine: !business,
    });
  }
  for (const row of input.creatorDeliverables) {
    sources.push({
      workspaceId: input.workspaceId,
      recordId: row.id,
      version: "open",
      action: "submit_delivery",
      title: row.title || "Deliverable",
      counterparty: row.counterparty || "Counterparty",
      dueLabel: row.dueLabel || "No deadline",
      href: row.href,
      mine: true,
      linkLabel: "Open workspace",
    });
  }
  return sources;
}
