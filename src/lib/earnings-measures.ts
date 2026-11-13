/**
 * Influencer earnings measures. A release, a payout in flight, a confirmed bank
 * payout, and a return are separate records. Payout setup does not rename them.
 */
import { newIncidentReference, selectedMonthWindow } from "@/lib/business-status";
import { prisma } from "@/lib/db";
import { milestonePayoutLabel } from "@/lib/milestone-delivery";
import { storedCurrencyCode } from "@/lib/money";
import type { PaymentStatusLabel } from "@/lib/payment-standard-v4";

export type PayoutState = "queued" | "pending" | "in_transit" | "paid" | "failed" | "returned" | "unknown";

export type EarningFact = {
  id: string;
  title: string;
  milestone: string;
  currency: string;
  amountCents: number;
  milestoneStatus: string;
  payoutState: PayoutState | null;
  releasedAt: Date | null;
  returnedCents: number;
};

export type EarningRow = {
  id: string;
  title: string;
  milestone: string;
  netCents: number;
  status: PaymentStatusLabel;
  milestoneStatus: string;
};

export type EarningSummary = {
  currency: string;
  upcomingCents: number;
  processingCents: number;
  paidCents: number;
  returnedCents: number;
  releasedThisMonthCents: number;
  unknown: boolean;
  rows: EarningRow[];
};

type Bucket = "upcoming" | "processing" | "paid" | "returned" | "unknown";

const PROCESSING_STATUS = new Set(["approved", "release_scheduled", "release_requested"]);

export function isInfluencerReleaseEntry(entry: { kind: string; party?: string | null }) {
  if (entry.kind !== "release") return false;
  const party = (entry.party ?? "").trim();
  if (!party) return true;
  const owner = party.split(":")[0] ?? "";
  return owner === "Influencer" || owner === "influencer";
}

export function isInfluencerReturnEntry(entry: { kind: string; party?: string | null }) {
  if (entry.kind !== "return") return false;
  const party = (entry.party ?? "").trim();
  if (!party) return true;
  const owner = party.split(":")[0] ?? "";
  return owner === "Influencer" || owner === "influencer";
}

export function releasedThisMonthCents(
  entries: { kind: string; party?: string | null; amountCents: number; createdAt: Date }[],
  window: { start: Date; end: Date },
) {
  return entries.reduce((sum, entry) => {
    if (!isInfluencerReleaseEntry(entry)) return sum;
    if (entry.createdAt < window.start || entry.createdAt >= window.end) return sum;
    return sum + entry.amountCents;
  }, 0);
}

/** Bank payout evidence. Profile readiness is not an input. */
export function classifyEarningFact(fact: Pick<EarningFact, "milestoneStatus" | "payoutState" | "returnedCents">): Bucket {
  if (fact.payoutState === "unknown") return "unknown";
  if (
    fact.returnedCents > 0 ||
    fact.payoutState === "returned" ||
    fact.payoutState === "failed" ||
    fact.milestoneStatus === "returned" ||
    fact.milestoneStatus === "payout_failed"
  ) {
    return "returned";
  }
  if (fact.payoutState === "paid" || fact.milestoneStatus === "released") return "paid";
  if (fact.payoutState === "pending" || fact.payoutState === "in_transit" || PROCESSING_STATUS.has(fact.milestoneStatus)) {
    return "processing";
  }
  return "upcoming";
}

export function earningsRowStatus(fact: Pick<EarningFact, "milestoneStatus" | "payoutState" | "returnedCents">): PaymentStatusLabel {
  const bucket = classifyEarningFact(fact);
  if (bucket === "paid") return "Payout confirmed";
  if (bucket === "returned") return "Payout returned";
  if (bucket === "processing") return "Payout processing";
  if (bucket === "unknown") return "Needs attention";
  const payout = milestonePayoutLabel(fact.milestoneStatus);
  if (payout === "Refunded") return "Refunded";
  return "Needs funding";
}

export function emptyEarningSummary(): EarningSummary {
  return {
    currency: "",
    upcomingCents: 0,
    processingCents: 0,
    paidCents: 0,
    returnedCents: 0,
    releasedThisMonthCents: 0,
    unknown: false,
    rows: [],
  };
}

export function summarizeEarningFacts(facts: EarningFact[], window: { start: Date; end: Date }): EarningSummary {
  const currencies = [...new Set(facts.map((fact) => storedCurrencyCode(fact.currency)).filter((code): code is string => Boolean(code)))];
  const currency = currencies.length === 1 ? currencies[0]! : "";
  const summary = emptyEarningSummary();
  summary.currency = currency;
  const countable = currencies.length === 1;
  for (const fact of facts) {
    const bucket = classifyEarningFact(fact);
    if (bucket === "unknown") summary.unknown = true;
    const factCurrency = storedCurrencyCode(fact.currency);
    const amount = bucket === "returned" && fact.returnedCents > 0 ? fact.returnedCents : fact.amountCents;
    if (countable && factCurrency === currency && bucket !== "unknown") {
      if (bucket === "upcoming") summary.upcomingCents += amount;
      if (bucket === "processing") summary.processingCents += amount;
      if (bucket === "paid") summary.paidCents += amount;
      if (bucket === "returned") summary.returnedCents += amount;
    }
    if (
      countable &&
      factCurrency === currency &&
      fact.releasedAt &&
      fact.releasedAt >= window.start &&
      fact.releasedAt < window.end &&
      classifyEarningFact(fact) === "paid"
    ) {
      summary.releasedThisMonthCents += fact.amountCents;
    }
    summary.rows.push({
      id: fact.id,
      title: fact.title,
      milestone: fact.milestone,
      netCents: fact.amountCents,
      status: earningsRowStatus(fact),
      milestoneStatus: fact.milestoneStatus,
    });
  }
  return summary;
}

type FundingRow = {
  id: string;
  title: string;
  currency: string;
  milestones: { id: string; title: string; amountCents: number; refundedCents: number; status: string }[];
  entries: { kind: string; amountCents: number; party: string | null; createdAt: Date; milestoneId: string | null }[];
};

type SettlementRow = {
  milestoneId: string;
  payoutState: string;
  influencerNetCents: number;
  currency: string;
  revision: number;
};

function asPayoutState(value: string | null | undefined): PayoutState | null {
  if (
    value === "queued" ||
    value === "pending" ||
    value === "in_transit" ||
    value === "paid" ||
    value === "failed" ||
    value === "returned" ||
    value === "unknown"
  ) {
    return value;
  }
  return null;
}

export function buildEarningFacts(fundings: FundingRow[], settlements: SettlementRow[]): EarningFact[] {
  const latest = new Map<string, SettlementRow>();
  for (const row of settlements) {
    const current = latest.get(row.milestoneId);
    if (!current || row.revision > current.revision) latest.set(row.milestoneId, row);
  }
  const facts: EarningFact[] = [];
  for (const funding of fundings) {
    for (const milestone of funding.milestones) {
      const settlement = latest.get(milestone.id);
      const returns = funding.entries.filter(
        (entry) => entry.milestoneId === milestone.id && isInfluencerReturnEntry(entry),
      );
      const releases = funding.entries.filter(
        (entry) => entry.milestoneId === milestone.id && isInfluencerReleaseEntry(entry),
      );
      const releasedAt = releases.reduce<Date | null>((latestAt, entry) => {
        if (!latestAt || entry.createdAt > latestAt) return entry.createdAt;
        return latestAt;
      }, null);
      const releasable = Math.max(0, milestone.amountCents - milestone.refundedCents);
      facts.push({
        id: milestone.id,
        title: funding.title,
        milestone: milestone.title,
        currency: storedCurrencyCode(settlement?.currency) || storedCurrencyCode(funding.currency) || "",
        amountCents: settlement ? settlement.influencerNetCents : releasable,
        milestoneStatus: milestone.status,
        payoutState: asPayoutState(settlement?.payoutState),
        releasedAt,
        returnedCents: returns.reduce((sum, entry) => sum + entry.amountCents, 0),
      });
    }
  }
  return facts;
}

export async function loadInfluencerEarningFacts(creatorSlug: string, now = new Date()) {
  const slug = creatorSlug.trim();
  if (!slug) return { ok: true as const, summary: emptyEarningSummary() };
  try {
    const fundings = await prisma.collaborationFunding.findMany({
      where: { creatorSlug: slug },
      select: {
        id: true,
        title: true,
        currency: true,
        milestones: {
          orderBy: { sortOrder: "asc" },
          select: { id: true, title: true, amountCents: true, refundedCents: true, status: true },
        },
        entries: { select: { kind: true, amountCents: true, party: true, createdAt: true, milestoneId: true } },
      },
    });
    const settlements = fundings.length
      ? await prisma.milestoneSettlementV4.findMany({
          where: { fundingId: { in: fundings.map((funding) => funding.id) } },
          select: { milestoneId: true, payoutState: true, influencerNetCents: true, currency: true, revision: true },
        })
      : [];
    const facts = buildEarningFacts(fundings, settlements);
    const window = selectedMonthWindow(now);
    const summary = summarizeEarningFacts(facts, window);
    summary.releasedThisMonthCents = releasedThisMonthCents(
      fundings.flatMap((funding) => funding.entries),
      window,
    );
    return { ok: true as const, summary };
  } catch (error) {
    const incident = newIncidentReference();
    console.error("influencer earnings", incident, error);
    return { ok: false as const, incident };
  }
}
