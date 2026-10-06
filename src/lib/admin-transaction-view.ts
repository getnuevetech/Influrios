/**
 * W2.5 — Unified admin transaction view (Product Addendum §16 / Dev §19).
 * One funding detail with parties, milestones, provider, fee rule, funds, audit.
 */
import { prisma } from "@/lib/db";
import { feeTypeFromFundingSnapshot, ledgerMovements, reconcileLedger } from "@/lib/ledger";
import { marketplaceConfig } from "@/lib/marketplace-ledger";

export type FundingFeeRuleView = {
  ruleId: string | null;
  ruleName: string | null;
  ruleVersion: number | null;
  feeType: string;
  method: string | null;
  percentBps: number | null;
  fixedCents: number | null;
  calculatedFeeCents: number;
};

export type FundingAuditRow = {
  id: string;
  actor: string;
  action: string;
  objectType: string;
  objectId: string;
  createdAt: string;
};

export type FundingTransactionView = {
  funding: {
    id: string;
    title: string;
    businessName: string;
    creatorSlug: string;
    jurisdictionCode: string;
    currency: string;
    grossCents: number;
    feeCents: number;
    status: string;
    providerCode: string;
    serviceLevel: string;
    fundingMode: string;
    attributionLabel: string;
    attributionStatus: string;
    createdAt: string;
    updatedAt: string;
  };
  collaboration: {
    id: string;
    status: string;
    initiatorSlug: string;
    recipientSlug: string;
  } | null;
  feeRule: FundingFeeRuleView;
  funds: {
    heldCents: number;
    releasedCents: number;
    refundedCents: number;
    feeCents: number;
  };
  provider: {
    code: string;
    ready: boolean;
    name: string | null;
  };
  milestones: Array<{
    id: string;
    title: string;
    amountCents: number;
    refundedCents: number;
    status: string;
    revisionCount: number;
    revisionLimit: number;
    autoApproveAt: string | null;
    rightsStatus: string;
  }>;
  disputes: Array<{
    id: string;
    milestoneId: string | null;
    status: string;
  }>;
  changeOrders: Array<{
    id: string;
    note: string;
    previousUsdCents: number;
    nextUsdCents: number;
  }>;
  audits: FundingAuditRow[];
};

/** Pure — extracts frozen fee rule fields from feeSnapshotJson. */
export function feeRuleFromSnapshot(
  snapshot: unknown,
  serviceLevel: string,
  feeCents: number,
): FundingFeeRuleView {
  const row =
    snapshot && typeof snapshot === "object" ? (snapshot as Record<string, unknown>) : {};
  const ruleVersion =
    typeof row.ruleVersion === "number" && Number.isInteger(row.ruleVersion)
      ? row.ruleVersion
      : null;
  const percentBps =
    typeof row.percentBps === "number" && Number.isInteger(row.percentBps) ? row.percentBps : null;
  const fixedCents =
    typeof row.fixedCents === "number" && Number.isInteger(row.fixedCents) ? row.fixedCents : null;
  const calculated =
    typeof row.calculatedFeeCents === "number" && Number.isInteger(row.calculatedFeeCents)
      ? row.calculatedFeeCents
      : feeCents;
  return {
    ruleId: typeof row.ruleId === "string" ? row.ruleId : null,
    ruleName: typeof row.ruleName === "string" ? row.ruleName : null,
    ruleVersion,
    feeType: feeTypeFromFundingSnapshot(snapshot, serviceLevel),
    method: typeof row.method === "string" ? row.method : null,
    percentBps,
    fixedCents,
    calculatedFeeCents: calculated,
  };
}

export function auditObjectIdsForFunding(input: {
  fundingId: string;
  milestoneIds: string[];
  disputeIds: string[];
}) {
  return {
    funding: { objectType: "CollaborationFunding", objectId: input.fundingId },
    milestones: input.milestoneIds.map((id) => ({ objectType: "FundingMilestone", objectId: id })),
    disputes: input.disputeIds.map((id) => ({ objectType: "MilestoneDispute", objectId: id })),
  };
}

export async function getFundingTransactionView(
  fundingId: string,
): Promise<FundingTransactionView | null> {
  const id = fundingId.trim();
  if (!id) return null;

  const funding = await prisma.collaborationFunding.findUnique({
    where: { id },
    include: {
      milestones: { orderBy: { sortOrder: "asc" } },
      entries: { orderBy: { createdAt: "asc" } },
      disputes: {
        select: { id: true, milestoneId: true, status: true },
        orderBy: { createdAt: "desc" },
      },
      changeOrders: {
        orderBy: { createdAt: "desc" },
        select: { id: true, note: true, previousUsdCents: true, nextUsdCents: true },
      },
    },
  });
  if (!funding) return null;

  const milestoneIds = funding.milestones.map((m) => m.id);
  const disputeIds = funding.disputes.map((d) => d.id);
  const objectFilters = [
    { objectType: "CollaborationFunding", objectId: funding.id },
    ...milestoneIds.map((objectId) => ({ objectType: "FundingMilestone", objectId })),
    ...disputeIds.map((objectId) => ({ objectType: "MilestoneDispute", objectId })),
  ];

  const [audits, collaboration, config] = await Promise.all([
    prisma.auditLog.findMany({
      where: { OR: objectFilters },
      orderBy: { createdAt: "desc" },
      take: 100,
      select: {
        id: true,
        actor: true,
        action: true,
        objectType: true,
        objectId: true,
        createdAt: true,
      },
    }),
    prisma.collaboration.findFirst({
      where: {
        recipientSlug: funding.creatorSlug,
        OR: [{ title: funding.title }, { title: { contains: funding.title.slice(0, 40) } }],
      },
      orderBy: { updatedAt: "desc" },
      select: { id: true, status: true, initiatorSlug: true, recipientSlug: true },
    }),
    marketplaceConfig().catch(() => null),
  ]);

  const ledger = reconcileLedger(ledgerMovements(funding.entries), funding.grossCents);
  const providerRow = config?.providers?.find((p) => p.code === funding.providerCode) ?? null;
  const providerReady =
    providerRow?.ready ??
    (config?.provider?.code === funding.providerCode ? Boolean(config.provider.ready) : false);

  return {
    funding: {
      id: funding.id,
      title: funding.title,
      businessName: funding.businessName,
      creatorSlug: funding.creatorSlug,
      jurisdictionCode: funding.jurisdictionCode,
      currency: funding.currency,
      grossCents: funding.grossCents,
      feeCents: funding.feeCents,
      status: funding.status,
      providerCode: funding.providerCode,
      serviceLevel: funding.serviceLevel,
      fundingMode: funding.fundingMode,
      attributionLabel: funding.attributionLabel,
      attributionStatus: funding.attributionStatus,
      createdAt: funding.createdAt.toISOString(),
      updatedAt: funding.updatedAt.toISOString(),
    },
    collaboration: collaboration
      ? {
          id: collaboration.id,
          status: collaboration.status,
          initiatorSlug: collaboration.initiatorSlug,
          recipientSlug: collaboration.recipientSlug,
        }
      : null,
    feeRule: feeRuleFromSnapshot(funding.feeSnapshotJson, funding.serviceLevel, funding.feeCents),
    funds: {
      heldCents: ledger.heldCents,
      releasedCents: ledger.releasedCents,
      refundedCents: ledger.refundedCents,
      feeCents: ledger.feeCents,
    },
    provider: {
      code: funding.providerCode,
      ready: providerReady,
      name: providerRow?.name ?? config?.provider?.name ?? null,
    },
    milestones: funding.milestones.map((m) => ({
      id: m.id,
      title: m.title,
      amountCents: m.amountCents,
      refundedCents: m.refundedCents,
      status: m.status,
      revisionCount: m.revisionCount,
      revisionLimit: m.revisionLimit,
      autoApproveAt: m.autoApproveAt?.toISOString() ?? null,
      rightsStatus: m.rightsStatus,
    })),
    disputes: funding.disputes,
    changeOrders: funding.changeOrders,
    audits: audits.map((row) => ({
      id: row.id,
      actor: row.actor,
      action: row.action,
      objectType: row.objectType,
      objectId: row.objectId ?? "",
      createdAt: row.createdAt.toISOString(),
    })),
  };
}
