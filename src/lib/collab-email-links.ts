/**
 * Where each collaboration email points, and the real figures it shows.
 * Every link opens the page that answers the email (a receipt for a receipt, the checkout for a
 * funding request), never a generic list. Figures come from the signed allocation and the ledger.
 */
import { prisma } from "@/lib/db";

export type CollabLinkIds = { fundingId?: string | null; milestoneId?: string | null };

/** App path for one catalog template. Unknown templates fall back to the collaboration workroom. */
export function collabEmailPath(templateId: string, ids: CollabLinkIds): string {
  const fundingId = ids.fundingId?.trim() ?? "";
  const milestoneId = ids.milestoneId?.trim() ?? "";
  if (!fundingId) return templateId.startsWith("payout.") ? "/creator/earnings" : "/account";
  const work = `/collaboration/work/${fundingId}`;
  const milestoneTab = milestoneId ? `${work}?tab=milestones&focus=${milestoneId}` : `${work}?tab=milestones`;
  const payments = `/payments?deal=${fundingId}`;
  const admin = `/admin/deals/${fundingId}`;

  if (templateId.endsWith("_admin") || templateId.startsWith("ops.") && templateId !== "ops.route_blocked") return admin;
  switch (templateId) {
    case "funding.required":
    case "funding.open":
    case "funding.processing":
    case "funding.failed":
    case "funding.expired":
      return `/payments/checkout/${fundingId}`;
    case "funding.confirmed_business":
    case "funding.confirmed_influencer":
      return milestoneTab;
    case "milestone.submitted":
    case "milestone.review_reminder":
    case "milestone.revision":
    case "milestone.approved":
    case "milestone.auto_approved":
      return milestoneTab;
    case "payout.requested":
    case "payout.confirmed":
    case "payout.retry":
    case "payout.failed":
    case "payout.returned":
      return milestoneId ? `/creator/earnings/receipts/${milestoneId}` : "/creator/earnings";
    case "payout.requested_business":
    case "payout.confirmed_business":
    case "payout.returned_business":
    case "refund.processing":
    case "refund.completed_business":
    case "payment.risk":
    case "payment.activation_receipt":
      return payments;
    case "refund.completed_influencer":
      return "/creator/earnings";
    default:
      return work;
  }
}

type Allocation = { milestoneId?: string; grossCents: number; influencerFeeCents: number; businessCollaborationFeeCents: number };

function signedAllocation(feeSnapshotJson: unknown, milestoneId: string): Allocation | null {
  const quote = (feeSnapshotJson as { financialPlan?: { signedQuote?: { milestoneAllocations?: unknown } } } | null)?.financialPlan
    ?.signedQuote;
  const rows = Array.isArray(quote?.milestoneAllocations) ? (quote!.milestoneAllocations as Allocation[]) : [];
  return rows.find((row) => row && row.milestoneId === milestoneId) ?? null;
}

function money(cents: number | null | undefined, currency: string) {
  if (cents == null || !Number.isInteger(cents)) return "";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: currency || "USD" }).format(cents / 100);
}

function when(date: Date | null | undefined) {
  if (!date) return "";
  return `${new Intl.DateTimeFormat("en-US", { timeZone: "America/Chicago", dateStyle: "long", timeStyle: "short" }).format(date)} CT`;
}

/** Last four characters of a Stripe connected account, never the full id. */
export function maskedStripeDestination(accountId: string | null | undefined) {
  const id = accountId?.trim() ?? "";
  if (!/^acct_[A-Za-z0-9]+$/.test(id)) return "";
  return `Stripe payout account ••••${id.slice(-4)}`;
}

export type MilestonePayoutFacts = {
  currency: string;
  grossCents: number | null;
  influencerFeeCents: number | null;
  withheldCents: number;
  netCents: number | null;
  paidCents: number;
  transferRef: string;
  paidAt: Date | null;
  destination: string;
};

/** The payout breakdown for one milestone: signed allocation for the terms, ledger for what was paid. */
export async function milestonePayoutFacts(milestoneId: string): Promise<(MilestonePayoutFacts & { fundingId: string; creatorSlug: string; title: string; collaboration: string; business: string; status: string; approvedAt: Date | null }) | null> {
  const milestone = await prisma.fundingMilestone.findUnique({
    where: { id: milestoneId },
    include: { funding: { select: { id: true, title: true, businessName: true, creatorSlug: true, currency: true, feeSnapshotJson: true } } },
  });
  if (!milestone) return null;
  const funding = milestone.funding;
  const [entries, profile] = await Promise.all([
    prisma.ledgerEntry.findMany({
      where: { fundingId: funding.id, milestoneId },
      select: { kind: true, amountCents: true, createdAt: true, eventId: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.creator.findUnique({
      where: { slug: funding.creatorSlug },
      select: { payoutProfile: { select: { stripeConnectAccountId: true } } },
    }),
  ]);
  const allocation = signedAllocation(funding.feeSnapshotJson, milestoneId);
  const releases = entries.filter((row) => row.kind === "release");
  const paidCents = releases.reduce((total, row) => total + row.amountCents, 0);
  const grossCents = allocation?.grossCents ?? null;
  const influencerFeeCents = allocation?.influencerFeeCents ?? null;
  const termsNet = grossCents != null && influencerFeeCents != null ? grossCents - influencerFeeCents : null;
  // Anything between the signed net and what was paid is tax withheld or an approved deduction.
  const withheldCents = termsNet != null && paidCents > 0 ? Math.max(0, termsNet - paidCents) : 0;
  const netCents = paidCents > 0 ? paidCents : termsNet;
  const last = releases[releases.length - 1];
  return {
    fundingId: funding.id,
    creatorSlug: funding.creatorSlug,
    title: milestone.title,
    collaboration: funding.title,
    business: funding.businessName,
    status: milestone.status,
    approvedAt: milestone.approvedAt,
    currency: funding.currency || "USD",
    grossCents,
    influencerFeeCents,
    withheldCents,
    netCents,
    paidCents,
    transferRef: last?.eventId?.startsWith("tr_") ? last.eventId : "",
    paidAt: last?.createdAt ?? null,
    destination: maskedStripeDestination(profile?.payoutProfile?.stripeConnectAccountId),
  };
}

/** Template variables with real values for one funding (and milestone when given). Empty values render as "—". */
export async function collabMoneyVars(input: { fundingId: string; milestoneId?: string | null }): Promise<Record<string, string>> {
  const funding = await prisma.collaborationFunding.findUnique({
    where: { id: input.fundingId },
    select: { currency: true, grossCents: true, feeSnapshotJson: true, milestones: { orderBy: { sortOrder: "asc" } } },
  });
  if (!funding) return {};
  const currency = funding.currency || "USD";
  const { readSignedDealMoney } = await import("@/lib/payment-engine");
  const signed = readSignedDealMoney((funding.feeSnapshotJson as { financialPlan?: unknown } | null)?.financialPlan);
  const vars: Record<string, string> = {
    funding_id: input.fundingId,
    gross_compensation: money(funding.grossCents, currency),
    business_total: money(signed?.businessPaysCents ?? null, currency),
    funded_amount: money(signed?.businessPaysCents ?? null, currency),
    influencer_net: money(signed?.influencerReceivesCents ?? null, currency),
    business_collaboration_fee: money(signed?.businessPlatformFeeCents ?? null, currency),
    influencer_fee: money(signed?.influencerPlatformFeeCents ?? null, currency),
  };
  const next = funding.milestones.find((row) => row.status === "pending" || row.status === "open" || row.status === "revision_requested");
  if (next?.deliverableDueAt) vars.due_at = when(next.deliverableDueAt);
  const milestoneId = input.milestoneId?.trim();
  if (!milestoneId) return vars;
  vars.milestone_id = milestoneId;
  const milestone = funding.milestones.find((row) => row.id === milestoneId);
  if (milestone) {
    vars.milestone_name = milestone.title;
    vars.approved_at = when(milestone.approvedAt);
    vars.submitted_at = when(milestone.submittedAt);
    vars.review_due_at = when(milestone.autoApproveAt);
    vars.requested_at = when(milestone.releaseScheduledAt);
    if (milestone.deliverableDueAt) vars.due_at = when(milestone.deliverableDueAt);
    const version = await prisma.milestoneSubmission
      .findFirst({ where: { milestoneId }, orderBy: { version: "desc" }, select: { version: true } })
      .catch(() => null);
    if (version) vars.submission_version = `Version ${version.version}`;
  }
  const facts = await milestonePayoutFacts(milestoneId);
  if (facts) {
    vars.milestone_gross = money(facts.grossCents, currency);
    vars.milestone_influencer_fee = money(facts.influencerFeeCents, currency);
    vars.payout_adjustments = money(facts.withheldCents, currency);
    vars.payout_net = money(facts.netCents, currency);
    vars.confirmed_at = when(facts.paidAt);
    vars.masked_destination = facts.destination;
  }
  return vars;
}
