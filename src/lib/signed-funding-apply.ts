import { prisma } from "@/lib/db";
import { liveFundingBlockReason } from "@/lib/dual-platform-fees";
import { signedQuoteExpired } from "@/lib/payment-engine";
import { requestPrefund } from "@/lib/marketplace-ledger";
import { signedAgreementFundingLevel } from "@/lib/matching-product-boundary";
import {
  canonicalTerms,
  contractFundingIdempotencyKey,
  contractMayBeDeleted,
  contractMayBeVoided,
  parseAmendmentCreators,
  parseAmendmentMilestones,
  missingCommercialTermsReason,
  readSignedTermsSnapshot,
  recoverSignedTermsFromAgreement,
  sameDealError,
  submittedTermsDiffer,
  type SignedCreatorShare,
  type SignedMilestone,
  type SignedTermsSnapshot,
  type SubmittedFundingFields,
} from "@/lib/signed-funding";

const CHANGE_REQUIRED =
  "These terms differ from the signed agreement. An approved change order is required before funding. Nothing was funded.";

const MISSING_TERMS = "This signed agreement has no stored commercial terms. Nothing was funded.";

type StoredAgreement = {
  id: string;
  status: string;
  title: string;
  workspaceId: string | null;
  collaborationId: string | null;
  applicationId: string | null;
  teamProposalId: string | null;
  createdAt: Date;
  sourceJson: unknown;
  renderedBody: string;
  termsSnapshotJson: unknown;
  parties: {
    id?: string;
    role: string;
    name: string;
    email?: string | null;
    userId?: string | null;
    creatorSlug: string | null;
    shareBps: number;
  }[];
};

async function partiesWithCreatorSlugs(parties: StoredAgreement["parties"]) {
  const next = [];
  for (const party of parties) {
    if (party.role !== "creator" || party.creatorSlug?.trim()) {
      next.push(party);
      continue;
    }
    const byUser = party.userId
      ? await prisma.creator.findUnique({ where: { userId: party.userId }, select: { slug: true } })
      : null;
    const email = party.email?.trim();
    const byEmail =
      !byUser && email
        ? await prisma.creator.findFirst({
            where: { user: { email: { equals: email, mode: "insensitive" } } },
            select: { slug: true },
          })
        : null;
    const creatorSlug = byUser?.slug || byEmail?.slug || null;
    if (party.id && creatorSlug) {
      await prisma.contractParty.update({ where: { id: party.id }, data: { creatorSlug } }).catch(() => undefined);
    }
    next.push({ ...party, creatorSlug });
  }
  return next;
}

/** Keep a valid snapshot. When an older signed agreement has none, write one from the signed record. */
export async function ensureStoredCommercialTerms(document: StoredAgreement) {
  const existing = readSignedTermsSnapshot(document.termsSnapshotJson);
  if (existing) return { ok: true as const, snapshot: existing, repaired: false as const };
  if (document.status !== "signed") {
    return { ok: false as const, error: "Funding waits until every party has signed." };
  }
  const parties = await partiesWithCreatorSlugs(document.parties);
  const recovered = recoverSignedTermsFromAgreement({ ...document, parties });
  if (!recovered) {
    return { ok: false as const, error: missingCommercialTermsReason({ ...document, parties }) ?? MISSING_TERMS };
  }
  await prisma.contractDocument.update({
    where: { id: document.id },
    data: { termsSnapshotJson: JSON.parse(JSON.stringify(recovered)) as object },
  });
  await prisma.auditLog
    .create({
      data: {
        actor: "contract-repair",
        action: "contract.terms.recovered",
        objectType: "ContractDocument",
        objectId: document.id,
        after: { currency: recovered.currency, grossCents: recovered.grossCents },
      },
    })
    .catch(() => undefined);
  return { ok: true as const, snapshot: recovered, repaired: true as const };
}

export async function repairSignedAgreements(ids?: string[]) {
  if (ids && ids.length === 0) return 0;
  const rows = await prisma.contractDocument.findMany({
    where: { status: "signed", ...(ids ? { id: { in: ids } } : {}) },
    include: { parties: true },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  let repaired = 0;
  for (const row of rows) {
    const result = await ensureStoredCommercialTerms(row);
    if (result.ok && result.repaired) repaired += 1;
  }
  return repaired;
}

export async function fundSignedAgreement(input: {
  documentId: string;
  workspaceId: string;
  payoutMethod?: string | null;
  submitted: SubmittedFundingFields;
}) {
  const documentId = input.documentId.trim();
  const document = await prisma.contractDocument.findUnique({
    where: { id: documentId },
    include: { amendments: { orderBy: { createdAt: "desc" }, take: 1 }, parties: true },
  });
  if (!document) return { ok: false as const, error: "Contract not found." };
  if (document.status !== "signed") {
    return { ok: false as const, error: "Funding waits until every party has signed." };
  }
  const dealError = sameDealError(document, { ...input.submitted, workspaceId: input.workspaceId });
  if (dealError) return { ok: false as const, error: dealError };
  if (document.fundingId) {
    const prior = await prisma.collaborationFunding.findUnique({ where: { id: document.fundingId } });
    if (prior) return { ok: true as const, id: prior.id, status: prior.status, reused: true as const };
  }

  const stored = await ensureStoredCommercialTerms(document);
  if (!stored.ok) return stored;
  const snapshot = stored.snapshot;
  const amendment = document.amendments[0]
    ? {
        grossCents: document.amendments[0].grossCents,
        currency: document.amendments[0].currency,
        creators: parseAmendmentCreators(document.amendments[0].creatorsJson),
        milestones: parseAmendmentMilestones(document.amendments[0].milestonesJson),
        note: document.amendments[0].note,
      }
    : null;
  const terms = canonicalTerms(snapshot, amendment && amendment.creators.length && amendment.milestones.length ? amendment : null);
  const drift = submittedTermsDiffer(terms, input.submitted);
  if (drift) return { ok: false as const, error: `${drift} ${CHANGE_REQUIRED}` };

  const { getLaunchGate } = await import("@/lib/launch-gate");
  const { teamFundingGate } = await import("@/lib/payment-engine");
  const gate = await getLaunchGate().catch(() => null);
  const teamGate = teamFundingGate(terms.creators.length, gate?.teamFundingEnabled === true);
  if (!teamGate.ok) return teamGate;
  const liveFunding = liveFundingBlockReason(
    terms.financialPlan,
    gate
      ? {
          approvals: gate,
          traceReady: gate.providerTraceReady,
        }
      : null,
  );
  if (liveFunding) return { ok: false as const, error: liveFunding };
  const expired = signedQuoteExpired(terms.financialPlan);
  if (expired) return { ok: false as const, error: expired };

  const serviceLevel = signedAgreementFundingLevel(terms.serviceLevel);
  const primary = terms.creators[0];
  const result = await requestPrefund({
    jurisdictionCode: terms.jurisdictionCode,
    businessName: terms.businessName,
    creatorSlug: primary.slug,
    title: terms.title,
    grossCents: terms.grossCents,
    serviceLevel,
    customMilestones: terms.milestones,
    financialPlan: terms.financialPlan,
    workspaceId: document.workspaceId,
    collaborationId: document.collaborationId,
    teamProposalId: document.teamProposalId,
    creatorShares: terms.creators.length > 1 ? terms.creators.map((row) => ({ label: row.slug, shareBps: row.shareBps })) : null,
    payoutMethod: input.payoutMethod?.trim() || terms.payoutMethod,
    contractDocumentId: document.id,
    idempotencyKey: contractFundingIdempotencyKey(document.id),
  });
  return result;
}

export async function approveContractAmendment(input: {
  documentId: string;
  actor: string;
  note: string;
  grossCents: number;
  currency: string;
  creators: SignedCreatorShare[];
  milestones: SignedMilestone[];
}) {
  const note = input.note.trim();
  if (note.length < 8) return { ok: false as const, error: "Add a reason of at least 8 characters. Nothing was changed." };
  const snapshotLike: SignedTermsSnapshot = {
    version: 1,
    title: "amendment",
    businessName: "amendment",
    jurisdictionCode: "US",
    currency: input.currency.trim().toUpperCase(),
    grossCents: input.grossCents,
    serviceLevel: "contracted",
    workspaceId: "amendment",
    collaborationId: null,
    applicationId: null,
    teamProposalId: null,
    creators: input.creators,
    milestones: input.milestones,
    financialPlan: null,
    payoutMethod: "",
    lockedAt: new Date().toISOString(),
  };
  const checked = readSignedTermsSnapshot(snapshotLike);
  if (!checked) {
    return {
      ok: false as const,
      error: "A change order needs a currency, a gross amount, creators that add up to 100%, and milestones that add up to 100%.",
    };
  }
  const document = await prisma.contractDocument.findUnique({
    where: { id: input.documentId.trim() },
    select: { id: true, status: true, fundingId: true },
  });
  if (!document) return { ok: false as const, error: "Contract not found." };
  if (document.status !== "signed") return { ok: false as const, error: "Change orders apply to a signed agreement." };
  if (document.fundingId) {
    return { ok: false as const, error: "Funding already started. Change the prefund with a funding change order." };
  }
  const row = await prisma.contractTermAmendment.create({
    data: {
      documentId: document.id,
      note,
      grossCents: checked.grossCents,
      currency: checked.currency,
      creatorsJson: checked.creators,
      milestonesJson: checked.milestones,
      actor: input.actor,
    },
  });
  await prisma.auditLog.create({
    data: {
      actor: input.actor,
      action: "contract.amendment.approved",
      objectType: "ContractDocument",
      objectId: document.id,
      after: { amendmentId: row.id, grossCents: checked.grossCents, currency: checked.currency, note },
    },
  }).catch(() => undefined);
  return { ok: true as const, id: row.id };
}

export async function voidContractDocument(input: { id: string; actor: string; reason: string }) {
  const reason = input.reason.trim();
  if (reason.length < 8) return { ok: false as const, error: "Add a reason of at least 8 characters. Nothing was voided." };
  const document = await prisma.contractDocument.findUnique({
    where: { id: input.id.trim() },
    select: { id: true, status: true, fundingId: true },
  });
  if (!document) return { ok: false as const, error: "Contract not found." };
  if (!contractMayBeVoided(document.status, document.fundingId)) {
    return {
      ok: false as const,
      error: document.fundingId
        ? "This contract already started funding. It was not voided."
        : "Only a sent, signed, or declined agreement can be voided.",
    };
  }
  await prisma.contractDocument.update({
    where: { id: document.id },
    data: { status: "voided", voidReason: reason, voidedAt: new Date() },
  });
  await prisma.auditLog.create({
    data: {
      actor: input.actor,
      action: "contract.voided",
      objectType: "ContractDocument",
      objectId: document.id,
      before: { status: document.status },
      after: { status: "voided", reason },
    },
  }).catch(() => undefined);
  return { ok: true as const };
}

export async function linkSupersededContract(input: {
  applicationId?: string | null;
  collaborationId?: string | null;
  teamProposalId?: string | null;
  replacementId: string;
}) {
  const or = [
    input.applicationId?.trim() ? { applicationId: input.applicationId.trim() } : null,
    input.collaborationId?.trim() ? { collaborationId: input.collaborationId.trim() } : null,
    input.teamProposalId?.trim() ? { teamProposalId: input.teamProposalId.trim() } : null,
  ].filter((row): row is { applicationId: string } | { collaborationId: string } | { teamProposalId: string } => Boolean(row));
  if (or.length === 0) return;
  const previous = await prisma.contractDocument.findFirst({
    where: { status: "voided", supersededById: null, id: { not: input.replacementId }, OR: or },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  });
  if (!previous) return;
  await prisma.contractDocument.update({
    where: { id: previous.id },
    data: { supersededById: input.replacementId },
  });
}

export function deletionBlockedReason(status: string) {
  if (contractMayBeDeleted(status)) return null;
  return "Signed and sent agreements stay on record. Void the agreement instead of deleting it.";
}
