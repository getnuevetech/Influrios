import { prisma } from "@/lib/db";
import { ensureStoredCommercialTerms } from "@/lib/signed-funding-apply";
import { describeDealProgress, readSignedTermsSnapshot } from "@/lib/signed-funding";

export async function loadAdminDeal(rawId: string) {
  const id = rawId.trim();
  if (!id) return null;

  const contract = await prisma.contractDocument.findFirst({
    where: {
      OR: [
        { id },
        { fundingId: id },
        { collaborationId: id },
        { applicationId: id },
        { teamProposalId: id },
      ],
    },
    orderBy: { createdAt: "desc" },
    include: {
      parties: { orderBy: { createdAt: "asc" } },
      amendments: { orderBy: { createdAt: "desc" }, take: 8 },
    },
  });

  const funding = await prisma.collaborationFunding.findFirst({
    where: {
      OR: [
        { id },
        ...(contract?.id ? [{ contractDocumentId: contract.id }] : []),
        ...(contract?.fundingId ? [{ id: contract.fundingId }] : []),
        ...(contract?.collaborationId ? [{ collaborationId: contract.collaborationId }] : []),
      ],
    },
    orderBy: { createdAt: "desc" },
    include: {
      milestones: { orderBy: { sortOrder: "asc" }, include: { submissions: { orderBy: { version: "asc" } } } },
      disputes: { orderBy: { createdAt: "desc" } },
      entries: { orderBy: { createdAt: "asc" } },
      changeOrders: { orderBy: { createdAt: "desc" } },
    },
  });

  const collaborationId = contract?.collaborationId || funding?.collaborationId || null;
  const collaboration = collaborationId
    ? await prisma.collaboration.findUnique({ where: { id: collaborationId } })
    : await prisma.collaboration.findUnique({ where: { id } });

  if (!contract && !funding && !collaboration) return null;

  const relatedFilters = [
    collaboration?.id ? { collaborationId: collaboration.id } : undefined,
    contract?.applicationId ? { applicationId: contract.applicationId } : undefined,
    contract?.teamProposalId ? { teamProposalId: contract.teamProposalId } : undefined,
    funding?.id ? { fundingId: funding.id } : undefined,
  ].filter((row): row is { collaborationId: string } | { applicationId: string } | { teamProposalId: string } | { fundingId: string } => Boolean(row));
  const relatedContracts = relatedFilters.length === 0 ? [] : await prisma.contractDocument.findMany({
    where: { OR: relatedFilters },
    orderBy: { createdAt: "desc" },
    select: { id: true, title: true, status: true, createdAt: true, supersededById: true, fundingId: true },
  });

  const audits = await prisma.auditLog.findMany({
    where: {
      OR: [
        contract ? { objectType: "ContractDocument", objectId: contract.id } : undefined,
        funding ? { objectType: "CollaborationFunding", objectId: funding.id } : undefined,
        ...(funding?.milestones.map((row) => ({ objectType: "FundingMilestone", objectId: row.id })) ?? []),
        ...(funding?.disputes.map((row) => ({ objectType: "MilestoneDispute", objectId: row.id })) ?? []),
      ].filter((row): row is { objectType: string; objectId: string } => Boolean(row)),
    },
    orderBy: { createdAt: "desc" },
    take: 40,
  });

  const openDispute = funding?.disputes.find((row) => ["open", "under_review", "refund_requested"].includes(row.status));
  const disputedMilestone = openDispute?.milestoneId
    ? funding?.milestones.find((row) => row.id === openDispute.milestoneId)
    : null;
  let terms = readSignedTermsSnapshot(contract?.termsSnapshotJson);
  let termsRecovered = false;
  if (contract?.status === "signed" && !terms) {
    const stored = await ensureStoredCommercialTerms(contract).catch(() => null);
    if (stored?.ok) {
      terms = stored.snapshot;
      termsRecovered = stored.repaired;
    }
  }
  const progress = describeDealProgress({
    collaborationStatus: collaboration?.status ?? null,
    agreementStatus: contract?.status ?? null,
    signedCount: contract?.parties.filter((row) => row.status === "signed").length ?? 0,
    partyCount: contract?.parties.length ?? 0,
    fundingStatus: funding?.status ?? null,
    currency: funding?.currency ?? terms?.currency ?? "",
    milestones: (funding?.milestones ?? []).map((row) => ({
      id: row.id,
      title: row.title,
      status: row.status,
      amountCents: row.amountCents,
      releaseScheduledAt: row.releaseScheduledAt ? row.releaseScheduledAt.toISOString() : null,
    })),
    disputes: openDispute
      ? [
          {
            milestoneId: openDispute.milestoneId,
            status: openDispute.status,
            title: disputedMilestone?.title ?? "the collaboration",
            amountCents: disputedMilestone?.amountCents ?? funding?.grossCents ?? 0,
          },
        ]
      : [],
  });

  return { contract, funding, collaboration, relatedContracts, audits, progress, terms, termsRecovered };
}
