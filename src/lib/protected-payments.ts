/**
 * Phase 9 — Protected Payments (escrow / milestone demo).
 * Fund collaborations securely and release as milestones complete.
 * Demo store only — no live payout rails yet.
 */
import { randomBytes } from "crypto";
import { promises as fs } from "fs";
import path from "path";

export type MilestoneStatus =
  | "pending"
  | "submitted"
  | "approved"
  | "released"
  | "disputed";

export type EscrowStatus =
  | "draft"
  | "funded"
  | "in_progress"
  | "completed"
  | "refunded"
  | "cancelled";

export type PaymentMilestone = {
  id: string;
  title: string;
  amountCents: number;
  dueLabel: string;
  status: MilestoneStatus;
  note?: string;
  updatedAt: string;
};

export type EscrowDeal = {
  id: string;
  businessName: string;
  creatorSlug: string;
  creatorName: string;
  briefTitle: string;
  currency: "USD";
  totalCents: number;
  fundedCents: number;
  releasedCents: number;
  status: EscrowStatus;
  milestones: PaymentMilestone[];
  introId?: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
};

export type ProtectedPaymentsStore = {
  deals: EscrowDeal[];
  notes: string;
};

const DATA_DIR = path.join(process.cwd(), "data");
const STORE_PATH = path.join(DATA_DIR, "protected-payments.json");

const now = () => new Date().toISOString();

const DEFAULT_STORE: ProtectedPaymentsStore = {
  notes:
    "Phase 9 demo escrow — fund → milestone submit → approve → release. Connect Stripe Connect / payouts after volume validates.",
  deals: [
    {
      id: "escrow_demo_1",
      businessName: "Luminous Beauty",
      creatorSlug: "sofia-martinez",
      creatorName: "Sofia Martinez",
      briefTitle: "Clean Skincare Launch — 3 posts",
      currency: "USD",
      totalCents: 450000,
      fundedCents: 450000,
      releasedCents: 150000,
      status: "in_progress",
      introId: "intro-demo-1",
      notes: "Demo escrow linked to managed intro.",
      createdAt: now(),
      updatedAt: now(),
      milestones: [
        {
          id: "ms_1",
          title: "Kickoff + content brief sign-off",
          amountCents: 150000,
          dueLabel: "Week 1",
          status: "released",
          note: "Released after brief approved",
          updatedAt: now(),
        },
        {
          id: "ms_2",
          title: "Draft reels delivered",
          amountCents: 150000,
          dueLabel: "Week 2",
          status: "submitted",
          note: "Awaiting brand review",
          updatedAt: now(),
        },
        {
          id: "ms_3",
          title: "Posts live + performance report",
          amountCents: 150000,
          dueLabel: "Week 3",
          status: "pending",
          updatedAt: now(),
        },
      ],
    },
  ],
};

async function ensureStore(): Promise<ProtectedPaymentsStore> {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    const raw = await fs.readFile(STORE_PATH, "utf8");
    return JSON.parse(raw) as ProtectedPaymentsStore;
  } catch {
    try {
      await fs.mkdir(DATA_DIR, { recursive: true });
      await fs.writeFile(STORE_PATH, JSON.stringify(DEFAULT_STORE, null, 2), "utf8");
    } catch {
      /* read-only FS — serve in-memory defaults */
    }
    return structuredClone(DEFAULT_STORE);
  }
}

async function saveStore(store: ProtectedPaymentsStore) {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.writeFile(STORE_PATH, JSON.stringify(store, null, 2), "utf8");
  } catch {
    /* ignore write failures in read-only environments */
  }
}

export async function getProtectedPaymentsStore() {
  return ensureStore();
}

export function formatMoney(cents: number, currency: string = "USD") {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

export async function getDeal(id: string) {
  const store = await ensureStore();
  return store.deals.find((d) => d.id === id) ?? null;
}

export async function listDealsForCreator(slug: string) {
  const store = await ensureStore();
  return store.deals.filter((d) => d.creatorSlug === slug);
}

function recomputeStatus(deal: EscrowDeal) {
  const allReleased = deal.milestones.every((m) => m.status === "released");
  if (deal.status === "refunded" || deal.status === "cancelled") return;
  if (allReleased && deal.fundedCents > 0) {
    deal.status = "completed";
    deal.releasedCents = deal.milestones.reduce(
      (s, m) => s + (m.status === "released" ? m.amountCents : 0),
      0,
    );
    return;
  }
  if (deal.fundedCents > 0) {
    deal.status = deal.milestones.some((m) => m.status !== "pending")
      ? "in_progress"
      : "funded";
  }
  deal.releasedCents = deal.milestones.reduce(
    (s, m) => s + (m.status === "released" ? m.amountCents : 0),
    0,
  );
}

export async function createEscrowDeal(input: {
  businessName: string;
  creatorSlug: string;
  creatorName: string;
  briefTitle: string;
  notes?: string;
  introId?: string;
  milestones: { title: string; amountCents: number; dueLabel: string }[];
}): Promise<EscrowDeal> {
  const store = await ensureStore();
  if (!input.milestones.length) throw new Error("At least one milestone required");
  const totalCents = input.milestones.reduce((s, m) => s + m.amountCents, 0);
  if (totalCents <= 0) throw new Error("Total must be positive");
  const ts = now();
  const deal: EscrowDeal = {
    id: `escrow_${randomBytes(5).toString("hex")}`,
    businessName: input.businessName.trim(),
    creatorSlug: input.creatorSlug,
    creatorName: input.creatorName,
    briefTitle: input.briefTitle.trim(),
    currency: "USD",
    totalCents,
    fundedCents: 0,
    releasedCents: 0,
    status: "draft",
    introId: input.introId,
    notes: input.notes?.trim() ?? "",
    createdAt: ts,
    updatedAt: ts,
    milestones: input.milestones.map((m, i) => ({
      id: `ms_${i + 1}_${randomBytes(2).toString("hex")}`,
      title: m.title,
      amountCents: m.amountCents,
      dueLabel: m.dueLabel,
      status: "pending" as const,
      updatedAt: ts,
    })),
  };
  store.deals.unshift(deal);
  await saveStore(store);
  return deal;
}

export async function fundDeal(dealId: string): Promise<EscrowDeal> {
  const store = await ensureStore();
  const deal = store.deals.find((d) => d.id === dealId);
  if (!deal) throw new Error("Deal not found");
  if (deal.status === "refunded" || deal.status === "cancelled") {
    throw new Error("Cannot fund a closed deal");
  }
  deal.fundedCents = deal.totalCents;
  deal.status = "funded";
  deal.updatedAt = now();
  recomputeStatus(deal);
  await saveStore(store);
  return deal;
}

export async function submitMilestone(
  dealId: string,
  milestoneId: string,
  note?: string,
): Promise<EscrowDeal> {
  const store = await ensureStore();
  const deal = store.deals.find((d) => d.id === dealId);
  if (!deal) throw new Error("Deal not found");
  if (deal.fundedCents < deal.totalCents) throw new Error("Deal must be funded first");
  const ms = deal.milestones.find((m) => m.id === milestoneId);
  if (!ms) throw new Error("Milestone not found");
  if (ms.status === "released") throw new Error("Already released");
  ms.status = "submitted";
  ms.note = note?.trim() || ms.note;
  ms.updatedAt = now();
  deal.updatedAt = ms.updatedAt;
  recomputeStatus(deal);
  await saveStore(store);
  return deal;
}

export async function releaseMilestone(
  dealId: string,
  milestoneId: string,
  note?: string,
): Promise<EscrowDeal> {
  const store = await ensureStore();
  const deal = store.deals.find((d) => d.id === dealId);
  if (!deal) throw new Error("Deal not found");
  const ms = deal.milestones.find((m) => m.id === milestoneId);
  if (!ms) throw new Error("Milestone not found");
  if (deal.fundedCents < deal.totalCents) throw new Error("Deal must be funded first");
  if (ms.status === "pending") throw new Error("Creator must submit work first");
  ms.status = "released";
  ms.note = note?.trim() || "Released to creator";
  ms.updatedAt = now();
  deal.updatedAt = ms.updatedAt;
  recomputeStatus(deal);
  await saveStore(store);
  return deal;
}

export async function refundDeal(dealId: string, note?: string): Promise<EscrowDeal> {
  const store = await ensureStore();
  const deal = store.deals.find((d) => d.id === dealId);
  if (!deal) throw new Error("Deal not found");
  const held = deal.fundedCents - deal.releasedCents;
  if (held <= 0) throw new Error("Nothing left to refund");
  deal.status = "refunded";
  deal.notes = [deal.notes, note?.trim()].filter(Boolean).join(" · ");
  deal.updatedAt = now();
  for (const ms of deal.milestones) {
    if (ms.status !== "released") {
      ms.status = "pending";
      ms.note = "Refunded / cancelled";
      ms.updatedAt = deal.updatedAt;
    }
  }
  await saveStore(store);
  return deal;
}

/** Phase 10 — flag milestone while mediation runs. */
export async function markMilestoneDisputed(
  dealId: string,
  milestoneId: string,
  note?: string,
): Promise<EscrowDeal> {
  const store = await ensureStore();
  const deal = store.deals.find((d) => d.id === dealId);
  if (!deal) throw new Error("Deal not found");
  const ms = deal.milestones.find((m) => m.id === milestoneId);
  if (!ms) throw new Error("Milestone not found");
  if (ms.status === "released") throw new Error("Already released");
  ms.status = "disputed";
  ms.note = note?.trim() || "Disputed — under mediation";
  ms.updatedAt = now();
  deal.updatedAt = ms.updatedAt;
  deal.status = "in_progress";
  await saveStore(store);
  return deal;
}

/** Clear disputed flag before release / resume (mediator outcome). */
export async function resolveDisputedMilestone(
  dealId: string,
  milestoneId: string,
  next: Exclude<MilestoneStatus, "disputed" | "released"> = "submitted",
): Promise<EscrowDeal> {
  const store = await ensureStore();
  const deal = store.deals.find((d) => d.id === dealId);
  if (!deal) throw new Error("Deal not found");
  const ms = deal.milestones.find((m) => m.id === milestoneId);
  if (!ms) throw new Error("Milestone not found");
  if (ms.status === "released") return deal;
  ms.status = next;
  ms.updatedAt = now();
  deal.updatedAt = ms.updatedAt;
  recomputeStatus(deal);
  await saveStore(store);
  return deal;
}

export function escrowStats(store: ProtectedPaymentsStore) {
  const funded = store.deals.reduce((s, d) => s + d.fundedCents, 0);
  const released = store.deals.reduce((s, d) => s + d.releasedCents, 0);
  const held = funded - released;
  const active = store.deals.filter((d) =>
    ["funded", "in_progress", "draft"].includes(d.status),
  ).length;
  return { funded, released, held, active, total: store.deals.length };
}
