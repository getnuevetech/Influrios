/**
 * Funding a signed agreement uses the terms stored at send time.
 * The wizard form cannot substitute a different recipient, amount, currency, or milestone split.
 */

export type SignedCreatorShare = { slug: string; shareBps: number };

export type SignedMilestone = { title: string; shareBps: number };

export type SignedTermsSnapshot = {
  version: 1;
  title: string;
  businessName: string;
  jurisdictionCode: string;
  currency: string;
  grossCents: number;
  serviceLevel: string;
  workspaceId: string;
  collaborationId: string | null;
  applicationId: string | null;
  teamProposalId: string | null;
  creators: SignedCreatorShare[];
  milestones: SignedMilestone[];
  financialPlan: Record<string, unknown> | null;
  payoutMethod: string;
  lockedAt: string;
};

export type SubmittedFundingFields = {
  workspaceId: string;
  collaborationId?: string | null;
  applicationId?: string | null;
  teamProposalId?: string | null;
  creatorSlug?: string | null;
  currency?: string | null;
  grossCents?: number | null;
  /** Custom milestone rows the form actually sent. Template mode leaves this empty. */
  customMilestones?: SignedMilestone[] | null;
};

export type ApprovedAmendment = {
  grossCents: number;
  currency: string;
  creators: SignedCreatorShare[];
  milestones: SignedMilestone[];
  note: string;
};

export function contractFundingIdempotencyKey(documentId: string) {
  return `contract:${documentId.trim()}:initial`;
}

export function normalizeMilestones(rows: SignedMilestone[] | null | undefined): SignedMilestone[] {
  return (rows ?? [])
    .map((row) => ({ title: row.title.trim(), shareBps: row.shareBps }))
    .filter((row) => row.title && Number.isInteger(row.shareBps) && row.shareBps > 0)
    .sort((a, b) => a.title.localeCompare(b.title) || a.shareBps - b.shareBps);
}

export function normalizeCreators(rows: SignedCreatorShare[] | null | undefined): SignedCreatorShare[] {
  return (rows ?? [])
    .map((row) => ({ slug: row.slug.trim(), shareBps: row.shareBps }))
    .filter((row) => row.slug && Number.isInteger(row.shareBps) && row.shareBps > 0)
    .sort((a, b) => a.slug.localeCompare(b.slug));
}

function sameMilestones(left: SignedMilestone[], right: SignedMilestone[]) {
  const a = normalizeMilestones(left);
  const b = normalizeMilestones(right);
  if (a.length !== b.length) return false;
  return a.every((row, index) => row.title === b[index].title && row.shareBps === b[index].shareBps);
}

export function canonicalTerms(snapshot: SignedTermsSnapshot, amendment: ApprovedAmendment | null): SignedTermsSnapshot {
  if (!amendment) return snapshot;
  return {
    ...snapshot,
    currency: amendment.currency.trim().toUpperCase(),
    grossCents: amendment.grossCents,
    creators: normalizeCreators(amendment.creators),
    milestones: normalizeMilestones(amendment.milestones),
    financialPlan: snapshot.financialPlan
      ? {
          ...snapshot.financialPlan,
          contractCurrency: amendment.currency.trim().toUpperCase(),
          grossContractValueCents: amendment.grossCents,
        }
      : null,
  };
}

/** Blank submitted fields mean "use the stored terms". A present field that differs is a change. */
export function submittedTermsDiffer(canonical: SignedTermsSnapshot, submitted: SubmittedFundingFields): string | null {
  const slug = submitted.creatorSlug?.trim() ?? "";
  if (slug && !canonical.creators.some((row) => row.slug === slug)) {
    return "The influencer on this form is not a party on the signed agreement.";
  }
  const currency = submitted.currency?.trim().toUpperCase() ?? "";
  if (currency && currency !== canonical.currency) {
    return "The currency on this form does not match the signed agreement.";
  }
  if (submitted.grossCents && submitted.grossCents > 0 && submitted.grossCents !== canonical.grossCents) {
    return "The amount on this form does not match the signed agreement.";
  }
  const custom = submitted.customMilestones ?? [];
  if (custom.length > 0 && !sameMilestones(custom, canonical.milestones)) {
    return "The milestone split on this form does not match the signed agreement.";
  }
  return null;
}

export function sameDealError(
  document: {
    workspaceId?: string | null;
    collaborationId?: string | null;
    applicationId?: string | null;
    teamProposalId?: string | null;
  },
  submitted: SubmittedFundingFields,
): string | null {
  const workspace = document.workspaceId?.trim() ?? "";
  if (!workspace || workspace !== submitted.workspaceId.trim()) {
    return "This agreement belongs to a different business. Nothing was funded.";
  }
  const pairs: [string | null | undefined, string | null | undefined][] = [
    [document.collaborationId, submitted.collaborationId],
    [document.applicationId, submitted.applicationId],
    [document.teamProposalId, submitted.teamProposalId],
  ];
  for (const [left, right] of pairs) {
    const stored = left?.trim() ?? "";
    const entered = right?.trim() ?? "";
    if (stored && entered && stored !== entered) {
      return "This form is for a different deal than the signed agreement. Nothing was funded.";
    }
  }
  return null;
}

export function contractMayBeDeleted(status: string) {
  return status === "draft";
}

export function contractMayBeVoided(status: string, fundingId: string | null | undefined) {
  if (fundingId?.trim()) return false;
  return status === "sent" || status === "signed" || status === "declined";
}

export type ContractFundingCta =
  | { kind: "hidden" }
  | { kind: "wait"; label: string }
  | { kind: "start"; label: "Start funding" }
  | { kind: "resume"; label: "Resume payment" }
  | { kind: "view"; label: "View funding" };

export function contractFundingCta(input: {
  role: string | null | undefined;
  status: string;
  fundingId?: string | null;
  fundingStatus?: string | null;
}): ContractFundingCta {
  if (input.role !== "business") {
    if (input.status === "signed" && !input.fundingId) {
      return { kind: "wait", label: "The business starts funding from their side." };
    }
    return { kind: "hidden" };
  }
  if (input.status !== "signed") {
    return { kind: "wait", label: "Funding waits until every party has signed." };
  }
  if (!input.fundingId) return { kind: "start", label: "Start funding" };
  if ((input.fundingStatus ?? "") === "awaiting_provider") return { kind: "resume", label: "Resume payment" };
  return { kind: "view", label: "View funding" };
}

export type DealMilestoneFact = {
  id: string;
  title: string;
  status: string;
  amountCents: number;
  releaseScheduledAt: string | null;
};

export type DealDisputeFact = {
  milestoneId: string | null;
  status: string;
  title: string;
  amountCents: number;
};

const OPEN_DISPUTE = new Set(["open", "under_review", "refund_requested"]);

export function describeDealProgress(input: {
  collaborationStatus: string | null;
  agreementStatus: string | null;
  signedCount: number;
  partyCount: number;
  fundingStatus: string | null;
  currency: string;
  milestones: DealMilestoneFact[];
  disputes: DealDisputeFact[];
}) {
  const collaboration = input.collaborationStatus?.trim() || "No collaboration record";
  let agreement = "No agreement";
  if (input.agreementStatus === "signed") agreement = "Fully signed";
  else if (input.agreementStatus === "sent" || input.agreementStatus === "draft") {
    agreement =
      input.partyCount > 0
        ? `Awaiting signatures (${input.signedCount}/${input.partyCount})`
        : "Awaiting signatures";
  } else if (input.agreementStatus) agreement = input.agreementStatus;

  const fundingLabels: Record<string, string> = {
    awaiting_provider: "Awaiting provider confirmation",
    held: "Provider confirmed the hold",
    completed: "Funding completed",
    refunded: "Refunded",
    payment_risk: "Payment risk",
    cancelled: "Cancelled",
  };
  const funding = input.fundingStatus
    ? fundingLabels[input.fundingStatus] ?? input.fundingStatus.replaceAll("_", " ")
    : "Not started";

  const open = input.disputes.find((row) => OPEN_DISPUTE.has(row.status));
  const nextMilestone = input.milestones.find((row) => row.status !== "released" && row.status !== "refunded");
  let delivery = "No milestone yet";
  if (nextMilestone) {
    if (nextMilestone.status === "approved" && nextMilestone.releaseScheduledAt) delivery = "Release scheduled";
    else if (nextMilestone.status === "approved") delivery = "Release waiting on the provider";
    else if (nextMilestone.status === "payout_failed") delivery = "Release failed";
    else delivery = `${nextMilestone.title} ${nextMilestone.status.replaceAll("_", " ")}`;
  } else if (input.milestones.length > 0) delivery = "Release confirmed";

  let next = "Nothing is waiting on an operator.";
  if (open) {
    next = `Dispute on ${open.title} is on hold. Release stays on hold.`;
  } else if (!input.agreementStatus) next = "No agreement has been sent.";
  else if (input.agreementStatus !== "signed" && input.agreementStatus !== "voided") {
    next = "Waiting for the remaining parties to sign.";
  } else if (input.agreementStatus === "signed" && !input.fundingStatus) next = "Waiting for the business to start funding.";
  else if (input.fundingStatus === "awaiting_provider") next = "Waiting for payment provider confirmation.";
  else if (nextMilestone?.status === "approved" && nextMilestone.releaseScheduledAt) {
    next = `Release is scheduled for ${nextMilestone.title}.`;
  } else if (nextMilestone?.status === "approved") next = `Release is processing for ${nextMilestone.title}.`;
  else if (nextMilestone?.status === "released" || (!nextMilestone && input.milestones.length > 0)) {
    next = "Release is confirmed.";
  } else if (nextMilestone) next = `${nextMilestone.title} is ${nextMilestone.status.replaceAll("_", " ")}.`;

  return {
    collaboration,
    agreement,
    funding,
    delivery,
    next,
    hold: open ? { title: open.title, amountCents: open.amountCents, currency: input.currency } : null,
  };
}

export function parseAmendmentCreators(value: unknown): SignedCreatorShare[] {
  if (!Array.isArray(value)) return [];
  return normalizeCreators(
    value.map((row) => {
      const record = row && typeof row === "object" ? (row as Record<string, unknown>) : {};
      return { slug: String(record.slug ?? ""), shareBps: Number(record.shareBps) };
    }),
  );
}

export function parseAmendmentMilestones(value: unknown): SignedMilestone[] {
  if (!Array.isArray(value)) return [];
  return normalizeMilestones(
    value.map((row) => {
      const record = row && typeof row === "object" ? (row as Record<string, unknown>) : {};
      return { title: String(record.title ?? ""), shareBps: Number(record.shareBps) };
    }),
  );
}

export function readSignedTermsSnapshot(value: unknown): SignedTermsSnapshot | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  const currency = String(row.currency ?? "").trim().toUpperCase();
  const grossCents = Number(row.grossCents);
  const creators = parseAmendmentCreators(row.creators);
  const milestones = parseAmendmentMilestones(row.milestones);
  if (!/^[A-Z]{3}$/.test(currency) || !Number.isInteger(grossCents) || grossCents <= 0) return null;
  if (creators.length === 0 || milestones.length === 0) return null;
  const share = creators.reduce((sum, creator) => sum + creator.shareBps, 0);
  const milestoneShare = milestones.reduce((sum, milestone) => sum + milestone.shareBps, 0);
  if (share !== 10_000 || milestoneShare !== 10_000) return null;
  return {
    version: 1,
    title: String(row.title ?? "").trim(),
    businessName: String(row.businessName ?? "").trim(),
    jurisdictionCode: String(row.jurisdictionCode ?? "").trim().toUpperCase(),
    currency,
    grossCents,
    serviceLevel: String(row.serviceLevel ?? "").trim(),
    workspaceId: String(row.workspaceId ?? "").trim(),
    collaborationId: String(row.collaborationId ?? "").trim() || null,
    applicationId: String(row.applicationId ?? "").trim() || null,
    teamProposalId: String(row.teamProposalId ?? "").trim() || null,
    creators,
    milestones,
    financialPlan: row.financialPlan && typeof row.financialPlan === "object" ? (row.financialPlan as Record<string, unknown>) : null,
    payoutMethod: String(row.payoutMethod ?? "").trim(),
    lockedAt: String(row.lockedAt ?? ""),
  };
}
