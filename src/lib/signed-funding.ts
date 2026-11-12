/**
 * Funding a signed agreement uses the terms stored at send time.
 * The wizard form cannot substitute a different recipient, amount, currency, or milestone split.
 */
import { formatStoredMoney, storedCurrencyCode } from "@/lib/money";

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
  originServiceLevel?: string | null;
  feeServiceLevel?: string | null;
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

export function sharePercentLabel(shareBps: number) {
  const percent = shareBps / 100;
  return Number.isInteger(percent) ? `${percent}%` : `${percent.toFixed(2)}%`;
}

/** Share of a funded milestone, derived from its amount and the funding gross. */
export function fundedShareBps(amountCents: number, grossCents: number) {
  if (!Number.isInteger(amountCents) || !Number.isInteger(grossCents) || grossCents <= 0) return null;
  return Math.round((amountCents * 10_000) / grossCents);
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

export function repriceNeedsNewAgreement(
  snapshot: SignedTermsSnapshot,
  amendment: ApprovedAmendment | null,
): string | null {
  if (!amendment) return null;
  const currency = amendment.currency.trim().toUpperCase();
  if (amendment.grossCents !== snapshot.grossCents || currency !== snapshot.currency) {
    return "A new agreement version and fresh signatures are required before these amounts can change. Nothing was repriced.";
  }
  return null;
}

export function canonicalTerms(snapshot: SignedTermsSnapshot, amendment: ApprovedAmendment | null): SignedTermsSnapshot {
  if (!amendment || repriceNeedsNewAgreement(snapshot, amendment)) return snapshot;
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
  | { kind: "resume"; label: "Deposit funds" }
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
  if ((input.fundingStatus ?? "") === "awaiting_provider") return { kind: "resume", label: "Deposit funds" };
  return { kind: "view", label: "View funding" };
}

/** What a signed agreement says about money. A started deposit is not “waiting to start.” */
export function signedFundingNotice(fundingStatus: string | null | undefined) {
  if (fundingStatus === "held" || fundingStatus === "completed") {
    return "Funds are confirmed. Deliverables are open.";
  }
  if (fundingStatus === "awaiting_provider") {
    return "A deposit is open. The agreement stays unfunded until Stripe or finance confirms the payment.";
  }
  if (!fundingStatus) return "Every party has signed. Waiting for the business to start funding.";
  return "Every party has signed.";
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
    else if (nextMilestone.status === "returned") delivery = "Payout returned";
    else delivery = `${nextMilestone.title} ${nextMilestone.status.replaceAll("_", " ")}`;
  } else if (input.milestones.length > 0) delivery = "Release confirmed";

  let next = "Nothing is waiting on an operator.";
  if (open) {
    next = `Dispute on ${open.title} is on hold. Release stays on hold.`;
  } else if (!input.agreementStatus) next = "No agreement has been sent.";
  else if (input.agreementStatus !== "signed" && input.agreementStatus !== "voided") {
    next = "Waiting for the remaining parties to sign.";
  } else if (input.agreementStatus === "signed" && !input.fundingStatus) next = "Waiting for the business to start funding.";
  else if (input.fundingStatus === "awaiting_provider") {
    next = "The business deposits the funds. The agreement stays unfunded until the provider or finance confirms the payment.";
  }
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

export function parseScheduleCorrection(input: {
  slugs: string[];
  creatorPercents: string[];
  titles: string[];
  milestonePercents: string[];
}): { ok: true; creators: SignedCreatorShare[]; milestones: SignedMilestone[] } | { ok: false; error: string } {
  const creators: SignedCreatorShare[] = [];
  const count = Math.max(input.slugs.length, input.creatorPercents.length);
  for (let index = 0; index < count; index += 1) {
    const slug = (input.slugs[index] ?? "").trim();
    const raw = (input.creatorPercents[index] ?? "").trim();
    if (!slug && !raw) continue;
    const percent = Number(raw);
    if (!slug || !Number.isFinite(percent) || percent <= 0) {
      return { ok: false, error: "Each influencer needs a profile slug and a share greater than 0." };
    }
    creators.push({ slug, shareBps: Math.round(percent * 100) });
  }
  const milestones: SignedMilestone[] = [];
  const milestoneCount = Math.max(input.titles.length, input.milestonePercents.length);
  for (let index = 0; index < milestoneCount; index += 1) {
    const title = (input.titles[index] ?? "").trim();
    const raw = (input.milestonePercents[index] ?? "").trim();
    if (!title && !raw) continue;
    const percent = Number(raw);
    if (!title || !Number.isFinite(percent) || percent <= 0) {
      return { ok: false, error: "Each milestone needs a title and a share greater than 0." };
    }
    milestones.push({ title, shareBps: Math.round(percent * 100) });
  }
  const creatorTotal = creators.reduce((sum, row) => sum + row.shareBps, 0);
  const milestoneTotal = milestones.reduce((sum, row) => sum + row.shareBps, 0);
  if (creators.length === 0 || creatorTotal !== 10_000) {
    return { ok: false, error: "Influencer shares must add up to 100%." };
  }
  if (milestones.length === 0 || milestoneTotal !== 10_000) {
    return { ok: false, error: "Milestone shares must add up to 100%." };
  }
  return { ok: true, creators, milestones };
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
    originServiceLevel: typeof row.originServiceLevel === "string" ? row.originServiceLevel : null,
    feeServiceLevel: typeof row.feeServiceLevel === "string" ? row.feeServiceLevel : null,
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

function sourceField(source: unknown, key: string) {
  if (!source || typeof source !== "object" || Array.isArray(source)) return "";
  const value = (source as Record<string, unknown>)[key];
  return typeof value === "string" ? value.trim() : "";
}

/** Agreed fee for a contract card. Currency stays with the amount. */
export function agreedFeeFromSources(source: unknown, snapshotJson?: unknown) {
  const snapshot = readSignedTermsSnapshot(snapshotJson);
  if (snapshot) {
    return {
      label: formatStoredMoney(snapshot.grossCents, snapshot.currency),
      grossCents: snapshot.grossCents,
      currency: snapshot.currency,
    };
  }
  const currency = storedCurrencyCode(sourceField(source, "currency") || sourceField(source, "contractCurrency"));
  const raw = sourceField(source, "gross") || sourceField(source, "creator_compensation");
  if (!raw) return { label: "—", grossCents: null as number | null, currency };
  const amount = Number(raw.replace(/,/g, ""));
  if (currency && Number.isFinite(amount) && amount > 0) {
    const grossCents = Math.round(amount * 100);
    return { label: formatStoredMoney(grossCents, currency), grossCents, currency };
  }
  return { label: currency ? `${currency} ${raw}` : raw, grossCents: null as number | null, currency };
}

export type RecoverableAgreement = {
  title: string;
  workspaceId?: string | null;
  collaborationId?: string | null;
  applicationId?: string | null;
  teamProposalId?: string | null;
  createdAt?: Date | string | null;
  sourceJson?: unknown;
  renderedBody?: string | null;
  parties: { role: string; name: string; creatorSlug?: string | null; shareBps?: number | null }[];
};

function labeledLine(body: string, label: string) {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const spaced = body.match(new RegExp(`^${escaped}\\s{2,}(.+)$`, "im"));
  if (spaced?.[1]) return spaced[1].trim();
  const colon = body.match(new RegExp(`^${escaped}:\\s*(.+)$`, "im"));
  return colon?.[1]?.trim() ?? "";
}

function moneyToCents(raw: string) {
  const match = raw.replace(/,/g, "").match(/(\d+(?:\.\d+)?)/);
  if (!match) return null;
  const amount = Number(match[1]);
  if (!Number.isFinite(amount) || amount <= 0) return null;
  return Math.round(amount * 100);
}

function sharesTotal(rows: { shareBps: number }[]) {
  return rows.reduce((sum, row) => sum + row.shareBps, 0);
}

function balanceDisplayedShares(rows: SignedMilestone[]): SignedMilestone[] | null {
  if (rows.length === 0) return null;
  const total = sharesTotal(rows);
  if (total <= 0) return null;
  const next = rows.map((row) => ({ ...row }));
  if (total !== 10_000) {
    const drift = 10_000 - total;
    // The agreement prints whole percents, so 33% + 33% + 33% is the signed 100% schedule.
    if (Math.abs(drift) > rows.length * 50) return null;
    next[next.length - 1] = { ...next[next.length - 1], shareBps: next[next.length - 1].shareBps + drift };
  }
  const normalized = normalizeMilestones(next);
  return sharesTotal(normalized) === 10_000 ? normalized : null;
}

function milestonesFromScheduleText(section: string): SignedMilestone[] {
  const rows: SignedMilestone[] = [];
  const blocks = section.split(/\n(?=\d+\.\s+)/).map((block) => block.trim()).filter(Boolean);
  for (const block of blocks) {
    const titleLine = block.match(/^\d+\.\s+(.+)$/m)?.[1]?.trim() ?? "";
    const title = titleLine.split("\n")[0]?.trim() ?? "";
    if (!title || /none scheduled/i.test(title) || /^milestone\s+share/i.test(title)) continue;
    const inline = title.split(/\s{2,}/).map((part) => part.trim()).filter(Boolean);
    const inlineShare = inline[1]?.match(/^(\d+(?:\.\d+)?)%$/);
    const labeled = block.match(/Share:\s*(\d+(?:\.\d+)?)%/i);
    const share = inlineShare?.[1] ?? labeled?.[1];
    if (!share) continue;
    const name = inlineShare ? inline[0] : title;
    if (!name) continue;
    rows.push({ title: name, shareBps: Math.round(Number(share) * 100) });
  }
  return rows;
}

function milestonesFromSignedBody(body: string): SignedMilestone[] | null {
  const chrome = body.split(/4\.\s+Milestone Schedule/i)[1]?.split(/\n5\.\s/)[0] ?? "";
  const legacy = body.split(/\n\s*4\.\s+Milestones\b/i)[1]?.split(/\n\s*5\.\s+/i)[0] ?? "";
  const parsed = milestonesFromScheduleText(chrome);
  const rows = parsed.length > 0 ? parsed : milestonesFromScheduleText(legacy);
  return balanceDisplayedShares(rows);
}

function creatorsFromSignedAgreement(input: RecoverableAgreement): SignedCreatorShare[] | null {
  const body = input.renderedBody ?? "";
  const fromParties = normalizeCreators(
    input.parties
      .filter((party) => party.role === "creator" && party.creatorSlug?.trim())
      .map((party) => ({ slug: party.creatorSlug ?? "", shareBps: party.shareBps ?? 0 })),
  );
  if (sharesTotal(fromParties) === 10_000) return fromParties;
  const section = body.split("5. Influencer Share Allocation")[1]?.split(/\n6\.\s/)[0] ?? "";
  const fromBody = normalizeCreators(
    [...section.matchAll(/@([A-Za-z0-9._-]+)\s+(\d+(?:\.\d+)?)%/g)].map((match) => ({
      slug: match[1],
      shareBps: Math.round(Number(match[2]) * 100),
    })),
  );
  if (sharesTotal(fromBody) === 10_000) return fromBody;
  const sole = input.parties.filter((party) => party.role === "creator" && party.creatorSlug?.trim());
  if (sole.length === 1 && (sole[0].shareBps ?? 0) === 0) return [{ slug: sole[0].creatorSlug!.trim(), shareBps: 10_000 }];
  return null;
}

/**
 * Rebuild the funding snapshot from the agreement that was signed.
 * Uses the stored wizard source, the signed text, and the party shares. It does not read a new form.
 */
export function recoverSignedTermsFromAgreement(input: RecoverableAgreement): SignedTermsSnapshot | null {
  const body = input.renderedBody ?? "";
  const currency =
    storedCurrencyCode(sourceField(input.sourceJson, "currency") || sourceField(input.sourceJson, "contractCurrency")) ||
    storedCurrencyCode(labeledLine(body, "Currency"));
  const grossCents =
    moneyToCents(sourceField(input.sourceJson, "gross")) ||
    moneyToCents(labeledLine(body, "Gross Contract Value")) ||
    moneyToCents(labeledLine(body, "Gross contract value"));
  const creators = creatorsFromSignedAgreement(input);
  const milestones = milestonesFromSignedBody(body);
  if (!currency || !grossCents || !creators || !milestones) return null;
  const business = input.parties.find((party) => party.role === "business");
  const lockedAt = input.createdAt ? new Date(input.createdAt) : null;
  return readSignedTermsSnapshot({
    version: 1,
    title: input.title.trim() || sourceField(input.sourceJson, "title"),
    businessName: business?.name.trim() || labeledLine(body, "Business"),
    jurisdictionCode: (sourceField(input.sourceJson, "jurisdiction") || sourceField(input.sourceJson, "jurisdictionCode")).toUpperCase(),
    currency,
    grossCents,
    serviceLevel: sourceField(input.sourceJson, "serviceLevel"),
    workspaceId: input.workspaceId?.trim() || "",
    collaborationId: input.collaborationId ?? null,
    applicationId: input.applicationId ?? null,
    teamProposalId: input.teamProposalId ?? null,
    creators,
    milestones,
    financialPlan: null,
    payoutMethod: sourceField(input.sourceJson, "payoutMethod"),
    lockedAt: lockedAt && Number.isFinite(lockedAt.getTime()) ? lockedAt.toISOString() : "",
  });
}

/** Why a signed agreement still cannot be funded. Null when recovery succeeds. */
export function missingCommercialTermsReason(input: RecoverableAgreement) {
  if (recoverSignedTermsFromAgreement(input)) return null;
  const body = input.renderedBody ?? "";
  const currency =
    storedCurrencyCode(sourceField(input.sourceJson, "currency") || sourceField(input.sourceJson, "contractCurrency")) ||
    storedCurrencyCode(labeledLine(body, "Currency"));
  const grossCents =
    moneyToCents(sourceField(input.sourceJson, "gross")) || moneyToCents(labeledLine(body, "Gross Contract Value"));
  if (!currency || !grossCents) {
    return "This signed agreement has no currency or gross amount. Nothing was funded.";
  }
  if (!creatorsFromSignedAgreement(input)) {
    return "This signed agreement does not name the influencer profile. Nothing was funded.";
  }
  return "This signed agreement has no milestone schedule that adds up to 100%. Nothing was funded.";
}
