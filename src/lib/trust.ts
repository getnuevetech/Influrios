/**
 * Phase 10 — Disputes, Trust & Contract briefs.
 * Mediation queue for escrow milestones + lightweight collab contract templates.
 * Demo store only — not legal advice / not e-sign.
 */
import { randomBytes } from "crypto";
import { promises as fs } from "fs";
import path from "path";
import {
  getDeal,
  getProtectedPaymentsStore,
  type EscrowDeal,
} from "@/lib/protected-payments";

export type DisputeStatus =
  | "open"
  | "under_review"
  | "resolved_release"
  | "resolved_refund"
  | "resolved_partial"
  | "withdrawn";

export type DisputeOpenedBy = "business" | "creator" | "ops";

export type DisputeCase = {
  id: string;
  dealId: string;
  milestoneId: string;
  openedBy: DisputeOpenedBy;
  reason: string;
  details: string;
  status: DisputeStatus;
  resolutionNote?: string;
  createdAt: string;
  updatedAt: string;
};

export type ContractBrief = {
  id: string;
  title: string;
  audience: "creator" | "business" | "both";
  summary: string;
  clauses: string[];
  linkedDealId?: string;
  createdAt: string;
  updatedAt: string;
};

export type TrustStore = {
  notes: string;
  disputes: DisputeCase[];
  contracts: ContractBrief[];
};

const DATA_DIR = path.join(process.cwd(), "data");
const STORE_PATH = path.join(DATA_DIR, "trust.json");
const now = () => new Date().toISOString();

const DEFAULT_STORE: TrustStore = {
  notes:
    "Phase 10 demo — open dispute on escrow milestone → ops mediate → release/refund/partial. Contract briefs are templates, not counsel.",
  disputes: [
    {
      id: "dsp_demo_1",
      dealId: "escrow_demo_1",
      milestoneId: "ms_2",
      openedBy: "business",
      reason: "Deliverable mismatch",
      details:
        "Draft reels used unapproved product claims. Holding release until revised cut.",
      status: "under_review",
      createdAt: now(),
      updatedAt: now(),
    },
  ],
  contracts: [
    {
      id: "contract_std_collab",
      title: "Standard creator collab brief",
      audience: "both",
      summary:
        "Scope, milestones, usage rights, and escrow release rules for a typical sponsored post package.",
      clauses: [
        "Deliverables and due dates follow the escrow milestones attached to this deal.",
        "Brand usage rights: organic + paid amplification for 90 days after publish.",
        "Creator retains ownership of raw footage unless otherwise agreed in writing.",
        "Funds held in Influrios escrow until each milestone is accepted or mediated.",
        "Either party may open a dispute; ops mediation is binding for the demo rails.",
      ],
      createdAt: now(),
      updatedAt: now(),
    },
    {
      id: "contract_ugc_license",
      title: "UGC license addendum",
      audience: "business",
      summary: "Extended paid media license when brands need whitelisting or ads.",
      clauses: [
        "Paid media / whitelisting term: 6 months from first go-live.",
        "Creator grants non-exclusive worldwide license for the contracted assets.",
        "Edits that change meaning require creator approval before release of final milestone.",
      ],
      createdAt: now(),
      updatedAt: now(),
    },
  ],
};

async function ensureStore(): Promise<TrustStore> {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    const raw = await fs.readFile(STORE_PATH, "utf8");
    return JSON.parse(raw) as TrustStore;
  } catch {
    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.writeFile(STORE_PATH, JSON.stringify(DEFAULT_STORE, null, 2), "utf8");
    return structuredClone(DEFAULT_STORE);
  }
}

async function saveStore(store: TrustStore) {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(STORE_PATH, JSON.stringify(store, null, 2), "utf8");
}

export async function getTrustStore() {
  return ensureStore();
}

export function trustStats(store: TrustStore) {
  const open = store.disputes.filter((d) =>
    ["open", "under_review"].includes(d.status),
  ).length;
  const resolved = store.disputes.filter((d) => d.status.startsWith("resolved")).length;
  return {
    open,
    resolved,
    total: store.disputes.length,
    contracts: store.contracts.length,
  };
}

export async function listOpenDisputes() {
  const store = await ensureStore();
  return store.disputes.filter((d) => ["open", "under_review"].includes(d.status));
}

export async function openDispute(input: {
  dealId: string;
  milestoneId: string;
  openedBy: DisputeOpenedBy;
  reason: string;
  details?: string;
}): Promise<DisputeCase> {
  const deal = await getDeal(input.dealId);
  if (!deal) throw new Error("Deal not found");
  const ms = deal.milestones.find((m) => m.id === input.milestoneId);
  if (!ms) throw new Error("Milestone not found");
  if (ms.status === "released") throw new Error("Cannot dispute a released milestone");
  if (deal.fundedCents <= 0) throw new Error("Deal must be funded");

  const store = await ensureStore();
  const existing = store.disputes.find(
    (d) =>
      d.dealId === input.dealId &&
      d.milestoneId === input.milestoneId &&
      ["open", "under_review"].includes(d.status),
  );
  if (existing) throw new Error("An open dispute already exists for this milestone");

  const ts = now();
  const dispute: DisputeCase = {
    id: `dsp_${randomBytes(4).toString("hex")}`,
    dealId: input.dealId,
    milestoneId: input.milestoneId,
    openedBy: input.openedBy,
    reason: input.reason.trim() || "Dispute",
    details: input.details?.trim() ?? "",
    status: "open",
    createdAt: ts,
    updatedAt: ts,
  };
  store.disputes.unshift(dispute);
  await saveStore(store);

  // Mark milestone disputed in escrow store
  const { markMilestoneDisputed } = await import("@/lib/protected-payments");
  await markMilestoneDisputed(input.dealId, input.milestoneId, dispute.reason);

  return dispute;
}

export async function advanceDispute(
  id: string,
  status: DisputeStatus,
  resolutionNote?: string,
): Promise<DisputeCase> {
  const store = await ensureStore();
  const dispute = store.disputes.find((d) => d.id === id);
  if (!dispute) throw new Error("Dispute not found");
  dispute.status = status;
  dispute.resolutionNote = resolutionNote?.trim() || dispute.resolutionNote;
  dispute.updatedAt = now();
  await saveStore(store);

  const { resolveDisputedMilestone, releaseMilestone, refundDeal } = await import(
    "@/lib/protected-payments"
  );

  if (status === "resolved_release") {
    await resolveDisputedMilestone(dispute.dealId, dispute.milestoneId, "approved");
    await releaseMilestone(
      dispute.dealId,
      dispute.milestoneId,
      dispute.resolutionNote || "Released after mediation",
    );
  } else if (status === "resolved_refund") {
    await resolveDisputedMilestone(dispute.dealId, dispute.milestoneId, "pending");
    await refundDeal(
      dispute.dealId,
      dispute.resolutionNote || "Refunded after mediation",
    );
  } else if (status === "resolved_partial" || status === "withdrawn") {
    await resolveDisputedMilestone(dispute.dealId, dispute.milestoneId, "submitted");
  } else if (status === "under_review") {
    // keep disputed flag
  }

  return dispute;
}

export async function createContractBrief(input: {
  title: string;
  audience: ContractBrief["audience"];
  summary: string;
  clauses: string[];
  linkedDealId?: string;
}): Promise<ContractBrief> {
  const store = await ensureStore();
  const ts = now();
  const brief: ContractBrief = {
    id: `contract_${randomBytes(3).toString("hex")}`,
    title: input.title.trim(),
    audience: input.audience,
    summary: input.summary.trim(),
    clauses: input.clauses.map((c) => c.trim()).filter(Boolean),
    linkedDealId: input.linkedDealId,
    createdAt: ts,
    updatedAt: ts,
  };
  if (!brief.title || !brief.clauses.length) {
    throw new Error("Title and at least one clause required");
  }
  store.contracts.unshift(brief);
  await saveStore(store);
  return brief;
}

export async function attachContractToDeal(
  contractId: string,
  dealId: string,
): Promise<ContractBrief> {
  const deal = await getDeal(dealId);
  if (!deal) throw new Error("Deal not found");
  const store = await ensureStore();
  const brief = store.contracts.find((c) => c.id === contractId);
  if (!brief) throw new Error("Contract not found");
  brief.linkedDealId = dealId;
  brief.updatedAt = now();
  await saveStore(store);
  return brief;
}

export async function enrichDispute(dispute: DisputeCase): Promise<{
  dispute: DisputeCase;
  deal: EscrowDeal | null;
  milestoneTitle: string;
}> {
  const payments = await getProtectedPaymentsStore();
  const deal = payments.deals.find((d) => d.id === dispute.dealId) ?? null;
  const ms = deal?.milestones.find((m) => m.id === dispute.milestoneId);
  return {
    dispute,
    deal,
    milestoneTitle: ms?.title ?? dispute.milestoneId,
  };
}
