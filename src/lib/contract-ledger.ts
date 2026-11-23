/**
 * Contract ledger: one row per funded collaboration, built only from posted ledger entries and the
 * signed quote frozen on the funding. Internal allocations do not create additional cash.
 */
import { readSignedDealMoney } from "@/lib/payment-engine";

export type LedgerEntryInput = {
  id: string;
  kind: string;
  amountCents: number;
  party: string;
  milestoneId: string | null;
  createdAt: Date;
};

export type MovementStatus = "Settled" | "Posted" | "Paid" | "Reversed" | "Returned";

export type MoneyMovement = {
  id: string;
  date: Date;
  movement: string;
  from: string;
  to: string;
  /** Signed for cash leaving the gateway (payouts, costs, refunds). */
  amountCents: number;
  status: MovementStatus;
  reference: string;
};

export type ContractLedgerRow = {
  id: string;
  code: string;
  title: string;
  businessName: string;
  influencerName: string;
  currency: string;
  createdAt: Date;
  collectedCents: number;
  collaborationFeesCents: number;
  businessFeeCents: number;
  influencerFeeCents: number;
  taxesCents: number;
  platformRetainedCents: number;
  retainedBusinessFeeCents: number;
  retainedInfluencerFeeCents: number;
  processingCostsCents: number;
  netEarningsCents: number;
  heldCents: number;
  releasedAwaitingPayoutCents: number;
  paidToInfluencerCents: number;
  refundedCents: number;
  movements: MoneyMovement[];
};

const sum = (rows: LedgerEntryInput[]) => rows.reduce((total, row) => total + row.amountCents, 0);
const side = (row: LedgerEntryInput) => row.party.split(":")[1] ?? "";

/** C-0108 style code from the funding's position in creation order. */
export function contractCode(position: number) {
  return `C-${String(Math.max(1, position)).padStart(4, "0")}`;
}

function referenceSuffix(code: string) {
  return code.replace(/^C-0*/, "") || "0";
}

export function buildContractLedgerRow(input: {
  id: string;
  position: number;
  title: string;
  businessName: string;
  influencerName: string;
  currency: string;
  createdAt: Date;
  grossCents: number;
  feeCents: number;
  feeSnapshotJson: unknown;
  /** Milestones approved for payout whose provider payout has not been confirmed. */
  awaitingPayoutCents: number;
  entries: LedgerEntryInput[];
}): ContractLedgerRow {
  const code = contractCode(input.position);
  const ref = referenceSuffix(code);
  const plan = (input.feeSnapshotJson as { financialPlan?: unknown } | null)?.financialPlan;
  const deal = readSignedDealMoney(plan);
  const of = (kind: string) => input.entries.filter((row) => row.kind === kind);

  const collected = sum(of("hold"));
  const businessFee = deal?.businessPlatformFeeCents ?? sum(of("fee_pending").filter((row) => side(row) === "business"));
  const influencerFee = deal?.influencerPlatformFeeCents ?? sum(of("fee_pending").filter((row) => side(row) === "influencer"));
  const legacyFees = deal ? 0 : sum(of("fee"));
  const collaborationFees = businessFee + influencerFee || input.feeCents;
  const taxes = collected > 0 ? (deal?.businessTaxCents ?? 0) + (deal?.influencerTaxCents ?? 0) : 0;

  const reversedEligible = (which: string) =>
    sum(of("reversal").filter((row) => side(row) === which));
  const retainedBusiness = Math.max(0, sum(of("fee_eligible").filter((row) => side(row) === "business")) - reversedEligible("business"));
  const retainedInfluencer = Math.max(
    0,
    sum(of("fee_eligible").filter((row) => side(row) === "influencer")) - reversedEligible("influencer"),
  );
  const platformRetained = retainedBusiness + retainedInfluencer + legacyFees;
  const processingCosts = sum(of("provider_fee"));
  const paid = sum(of("release")) - sum(of("return"));
  const refunded = sum(of("refund"));
  const held = Math.max(0, collected - taxes - platformRetained - paid - refunded - input.awaitingPayoutCents);

  const movements: MoneyMovement[] = [];
  const push = (row: LedgerEntryInput, movement: Omit<MoneyMovement, "id" | "date">, suffix = "") =>
    movements.push({ id: `${row.id}${suffix}`, date: row.createdAt, ...movement });

  for (const row of [...input.entries].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())) {
    if (row.kind === "hold") {
      push(row, { movement: "Collection", from: "Business", to: "Gateway", amountCents: row.amountCents, status: "Settled", reference: `PAY-${ref}` });
      if (taxes > 0) {
        push(row, { movement: "Tax allocation", from: "Contract funds", to: "Tax payable", amountCents: taxes, status: "Posted", reference: `TAX-${ref}` }, ":tax");
      }
    } else if (row.kind === "fee_eligible" && side(row) === "business") {
      push(row, { movement: "Business fee allocation", from: "Contract funds", to: "Platform", amountCents: row.amountCents, status: "Posted", reference: `FEE-${ref}B` });
    } else if (row.kind === "fee_eligible" && side(row) === "influencer") {
      push(row, { movement: "Influencer fee allocation", from: "Release allocation", to: "Platform", amountCents: row.amountCents, status: "Posted", reference: `FEE-${ref}I` });
    } else if (row.kind === "fee" && !deal) {
      push(row, { movement: "Platform fee allocation", from: "Release allocation", to: "Platform", amountCents: row.amountCents, status: "Posted", reference: `FEE-${ref}` });
    } else if (row.kind === "release") {
      const influencerFeeOnMilestone = sum(
        input.entries.filter((entry) => entry.kind === "fee_eligible" && side(entry) === "influencer" && entry.milestoneId === row.milestoneId),
      );
      push(row, { movement: "Milestone release", from: "Contract funds", to: "Release allocation", amountCents: row.amountCents + influencerFeeOnMilestone, status: "Posted", reference: `REL-${ref}` }, ":rel");
      push(row, { movement: "Net payout payable", from: "Release allocation", to: "Influencer payable", amountCents: row.amountCents, status: "Posted", reference: `NET-${ref}` }, ":net");
      push(row, { movement: "Influencer payout", from: "Gateway", to: "Influencer bank", amountCents: -row.amountCents, status: "Paid", reference: `OUT-${ref}` });
    } else if (row.kind === "return") {
      push(row, { movement: "Payout returned", from: "Influencer bank", to: "Gateway", amountCents: row.amountCents, status: "Returned", reference: `RET-${ref}` });
    } else if (row.kind === "provider_fee") {
      push(row, { movement: "Processing costs", from: "Gateway", to: "Provider fees", amountCents: -row.amountCents, status: "Settled", reference: `COST-${ref}` });
    } else if (row.kind === "refund") {
      push(row, { movement: "Refund", from: "Gateway", to: "Business", amountCents: -row.amountCents, status: "Settled", reference: `RFD-${ref}` });
    } else if (row.kind === "reversal") {
      push(row, { movement: "Fee reversal", from: "Platform", to: "Contract funds", amountCents: row.amountCents, status: "Reversed", reference: `REV-${ref}` });
    } else if (row.kind === "fee_settled") {
      push(row, { movement: "Fee settlement", from: "Platform", to: "Operations account", amountCents: row.amountCents, status: "Settled", reference: `SET-${ref}` });
    }
  }

  return {
    id: input.id,
    code,
    title: input.title,
    businessName: input.businessName,
    influencerName: input.influencerName,
    currency: input.currency,
    createdAt: input.createdAt,
    collectedCents: collected,
    collaborationFeesCents: collaborationFees,
    businessFeeCents: businessFee,
    influencerFeeCents: influencerFee,
    taxesCents: taxes,
    platformRetainedCents: platformRetained,
    retainedBusinessFeeCents: retainedBusiness,
    retainedInfluencerFeeCents: retainedInfluencer + legacyFees,
    processingCostsCents: processingCosts,
    netEarningsCents: platformRetained - processingCosts,
    heldCents: held,
    releasedAwaitingPayoutCents: input.awaitingPayoutCents,
    paidToInfluencerCents: paid,
    refundedCents: refunded,
    movements,
  };
}

export type LedgerTotals = Pick<
  ContractLedgerRow,
  "collectedCents" | "collaborationFeesCents" | "taxesCents" | "platformRetainedCents" | "processingCostsCents" | "netEarningsCents" | "heldCents" | "paidToInfluencerCents"
>;

export function ledgerTotals(rows: ContractLedgerRow[]): LedgerTotals {
  const add = (key: keyof LedgerTotals) => rows.reduce((total, row) => total + row[key], 0);
  return {
    collectedCents: add("collectedCents"),
    collaborationFeesCents: add("collaborationFeesCents"),
    taxesCents: add("taxesCents"),
    platformRetainedCents: add("platformRetainedCents"),
    processingCostsCents: add("processingCostsCents"),
    netEarningsCents: add("netEarningsCents"),
    heldCents: add("heldCents"),
    paidToInfluencerCents: add("paidToInfluencerCents"),
  };
}

const csvCell = (value: string | number) => {
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
};
const money = (cents: number) => (cents / 100).toFixed(2);

/** CSV of every money movement for the given contracts, oldest first. */
export function ledgerCsv(rows: ContractLedgerRow[]) {
  const lines = [
    ["Contract", "Campaign", "Business", "Influencer", "Currency", "Date", "Movement", "From", "To", "Amount", "Status", "Reference"],
  ];
  for (const row of rows) {
    for (const move of row.movements) {
      lines.push([
        row.code,
        row.title,
        row.businessName,
        row.influencerName,
        row.currency,
        move.date.toISOString().slice(0, 10),
        move.movement,
        move.from,
        move.to,
        money(move.amountCents),
        move.status,
        move.reference,
      ]);
    }
  }
  return lines.map((line) => line.map(csvCell).join(",")).join("\n") + "\n";
}

const AWAITING_PAYOUT = ["release_scheduled", "release_requested", "payout_failed"];

export type ContractLedgerFilter = { q?: string; currency?: string; days?: number };

/** Every funding that money was collected for, newest first, filtered by search, currency and date. */
export async function loadContractLedger(filter: ContractLedgerFilter = {}) {
  const { prisma } = await import("@/lib/db");
  const since = filter.days && filter.days > 0 ? new Date(Date.now() - filter.days * 86_400_000) : null;
  const fundings = await prisma.collaborationFunding.findMany({
    where: { entries: { some: { kind: "hold" } } },
    orderBy: { createdAt: "asc" },
    include: {
      entries: { orderBy: { createdAt: "asc" } },
      milestones: { select: { amountCents: true, refundedCents: true, status: true } },
    },
  });
  const slugs = [...new Set(fundings.map((row) => row.creatorSlug))];
  const creators = slugs.length
    ? await prisma.creator.findMany({ where: { slug: { in: slugs } }, select: { slug: true, displayName: true } })
    : [];
  const nameOf = new Map(creators.map((row) => [row.slug, row.displayName]));
  const rows = fundings.map((funding, index) =>
    buildContractLedgerRow({
      id: funding.id,
      position: index + 1,
      title: funding.title,
      businessName: funding.businessName,
      influencerName: nameOf.get(funding.creatorSlug) ?? funding.creatorSlug,
      currency: funding.currency,
      createdAt: funding.createdAt,
      grossCents: funding.grossCents,
      feeCents: funding.feeCents,
      feeSnapshotJson: funding.feeSnapshotJson,
      awaitingPayoutCents: funding.milestones
        .filter((row) => AWAITING_PAYOUT.includes(row.status))
        .reduce((total, row) => total + Math.max(0, row.amountCents - row.refundedCents), 0),
      entries: funding.entries.map((entry) => ({
        id: entry.id,
        kind: entry.kind,
        amountCents: entry.amountCents,
        party: entry.party,
        milestoneId: entry.milestoneId,
        createdAt: entry.createdAt,
      })),
    }),
  );
  const q = (filter.q ?? "").trim().toLowerCase();
  const currency = (filter.currency ?? "").trim().toUpperCase();
  const currencies = [...new Set(rows.map((row) => row.currency))].sort();
  const filtered = rows
    .filter((row) => !currency || row.currency === currency)
    .filter((row) => !since || row.createdAt >= since)
    .filter(
      (row) =>
        !q ||
        [row.id, row.code, row.title, row.businessName, row.influencerName].some((value) => value.toLowerCase().includes(q)),
    )
    .reverse();
  return { rows: filtered, currencies };
}
