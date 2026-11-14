/**
 * Collaboration payment engine. Version 2 of the rebuild spec.
 * Live collection stays off until fee schedules, tax treatment, the earning and
 * refund policy, and the provider route are approved. Example rates are not stored here.
 */
import type { DualPlatformQuote } from "@/lib/dual-platform-fees";

export const QUOTE_VALID_MS = 7 * 24 * 60 * 60 * 1000;

export type LaunchApprovals = {
  feeSchedulesApproved: boolean;
  taxTreatmentApproved: boolean;
  earningRefundPolicyApproved: boolean;
  providerRouteApproved: boolean;
};

export const DEFAULT_LAUNCH_APPROVALS: LaunchApprovals = {
  feeSchedulesApproved: false,
  taxTreatmentApproved: false,
  earningRefundPolicyApproved: false,
  providerRouteApproved: false,
};

export type DeferredFundingSwitches = {
  crossBorderFundingEnabled: boolean;
  teamFundingEnabled: boolean;
  stagedFundingEnabled: boolean;
  automaticMilestoneApprovalEnabled: boolean;
  automaticProviderSwitchingEnabled: boolean;
  allInBudgetEntryEnabled: boolean;
  automaticReleaseApprovalEnabled: boolean;
  automaticProviderReleaseEnabled: boolean;
};

export const DEFAULT_DEFERRED_FUNDING: DeferredFundingSwitches = {
  crossBorderFundingEnabled: false,
  teamFundingEnabled: false,
  stagedFundingEnabled: false,
  automaticMilestoneApprovalEnabled: false,
  automaticProviderSwitchingEnabled: false,
  allInBudgetEntryEnabled: false,
  automaticReleaseApprovalEnabled: false,
  automaticProviderReleaseEnabled: false,
};

export type TaxLineType = "business_fee_tax" | "influencer_fee_tax" | "withholding" | "other";

export type TaxLine = {
  type: TaxLineType;
  ruleVersion: string;
  basisCents: number;
  amountCents: number;
  currency: string;
  liableParty: "business" | "influencer" | "platform";
  disposition: string;
};

export type TaxDetermination = {
  status: "unresolved" | "approved_zero" | "approved";
  lines: TaxLine[];
};

export type SignedCommercialSnapshot = {
  agreementVersion: number;
  amountInputMode: "gross_influencer_compensation" | "all_in_budget";
  currency: string;
  minorDigits: number;
  grossInfluencerCompensationCents: number;
  businessPlatformFeeCents: number;
  influencerPlatformFeeCents: number | null;
  businessTaxCents: number;
  influencerTaxCents: number;
  withholdingCents: number;
  businessPaysCents: number;
  influencerReceivesCents: number | null;
  platformFeesTotalCents: number;
  businessRuleId: string;
  businessRuleVersion: number;
  influencerRuleId: string | null;
  influencerRuleVersion: number | null;
  businessRateBps: number | null;
  influencerRateBps: number | null;
  businessFloorApplied: boolean;
  businessCapApplied: boolean;
  influencerFloorApplied: boolean;
  influencerCapApplied: boolean;
  rounding: "half_away_from_zero";
  taxLines: TaxLine[];
  taxStatus: TaxDetermination["status"];
  milestoneCount: number;
  validUntil: string;
  feeState: "reserved";
  activationFeeCents?: number;
  businessCollaborationFeeCents?: number;
  activationRuleId?: string;
  activationRuleVersion?: number;
  milestoneAllocations?: {
    grossCents: number;
    businessCollaborationFeeCents: number;
    influencerFeeCents: number;
    influencerNetCents: number;
  }[];
};

export type LedgerPosting = {
  kind:
    | "collection"
    | "hold"
    | "influencer_payable"
    | "fee_pending"
    | "fee_earned"
    | "fee_eligible"
    | "fee_settled"
    | "tax"
    | "release"
    | "payout"
    | "return"
    | "refund"
    | "reversal"
    | "provider_fee";
  party: "business" | "influencer" | "platform" | "tax" | "provider";
  side?:
    | "business"
    | "influencer"
    | "business_eligible"
    | "influencer_eligible"
    | "business_pending"
    | "influencer_pending"
    | "recovery";
  amountCents: number;
  reverses?: string;
};

export type StagingTraceStep = {
  step: string;
  where: string;
  amountCents: number;
  reference: string;
};

export type StagingTrace = {
  scenario: "payout" | "refund";
  currency: string;
  businessPaysCents: number;
  influencerReceivesCents: number;
  platformFeesTotalCents: number;
  taxCents: number;
  steps: StagingTraceStep[];
  reconciled: true;
};

export function buildProviderStagingTrace(input: {
  scenario: "payout" | "refund";
  currency: string;
  businessPaysCents: number;
  influencerReceivesCents: number;
  platformFeesTotalCents: number;
  taxCents: number;
  collectionRef: string;
  holdingRef: string;
  releaseRef: string;
  payoutRef: string;
  refundRef?: string;
  holdingAvailable: boolean;
  beneficiaryConfirmed: boolean;
  refundConfirmed?: boolean;
}): StagingTrace | { ok: false; error: string } {
  const currency = input.currency.trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(currency)) return { ok: false, error: "Use a three-letter currency." };
  const amounts = [
    input.businessPaysCents,
    input.influencerReceivesCents,
    input.platformFeesTotalCents,
    input.taxCents,
  ];
  if (amounts.some((amount) => !Number.isInteger(amount) || amount < 0)) {
    return { ok: false, error: "Trace amounts must be zero or positive minor units." };
  }
  if (input.businessPaysCents !== input.influencerReceivesCents + input.platformFeesTotalCents + input.taxCents) {
    return { ok: false, error: "The trace does not reconcile. Collection must equal payout plus fees plus tax." };
  }
  const refs = [input.collectionRef, input.holdingRef, input.releaseRef, input.payoutRef].map((ref) => ref.trim());
  if (refs.some((ref) => ref.length < 4)) return { ok: false, error: "Each provider reference is required." };
  if (!input.holdingAvailable) {
    return { ok: false, error: "Collection without holding evidence cannot start work." };
  }
  if (!input.beneficiaryConfirmed) {
    return { ok: false, error: "A payout is not confirmed until the beneficiary evidence is present." };
  }
  const steps: StagingTraceStep[] = [
    { step: "collection", where: "Provider collection", amountCents: input.businessPaysCents, reference: refs[0] },
    { step: "funds_available", where: "Approved holding arrangement", amountCents: input.businessPaysCents, reference: refs[1] },
    { step: "release_authorization", where: "Release instruction", amountCents: input.influencerReceivesCents, reference: refs[2] },
    { step: "confirmed_payout", where: "Verified beneficiary", amountCents: input.influencerReceivesCents, reference: refs[3] },
  ];
  if (input.scenario === "refund") {
    const refundRef = (input.refundRef ?? "").trim();
    if (refundRef.length < 4 || !input.refundConfirmed) {
      return { ok: false, error: "A refund trace needs a confirmed refund on the original route." };
    }
    steps.push({
      step: "refund",
      where: "Original route, refund confirmed",
      amountCents: input.businessPaysCents,
      reference: refundRef,
    });
  }
  return {
    scenario: input.scenario,
    currency,
    businessPaysCents: input.businessPaysCents,
    influencerReceivesCents: input.influencerReceivesCents,
    platformFeesTotalCents: input.platformFeesTotalCents,
    taxCents: input.taxCents,
    steps,
    reconciled: true,
  };
}

export function readSignedCollection(
  plan: unknown,
  routeCurrency: string,
): { currency: string; businessPaysCents: number; influencerReceivesCents: number; platformFeesTotalCents: number; milestoneCount: number } | { error: string } | null {
  if (!plan || typeof plan !== "object") return null;
  const quote = (plan as { signedQuote?: Record<string, unknown> }).signedQuote;
  if (!quote) return null;
  const currency = typeof quote.currency === "string" ? quote.currency.trim().toUpperCase() : "";
  const businessPaysCents = quote.businessPaysCents;
  const influencerReceivesCents = quote.influencerReceivesCents;
  const platformFeesTotalCents = quote.platformFeesTotalCents;
  if (!/^[A-Z]{3}$/.test(currency)) return { error: "The signed quote has no currency." };
  if (currency !== routeCurrency.trim().toUpperCase()) {
    return { error: "The signed currency does not match the route." };
  }
  const businessTaxCents = Number(quote.businessTaxCents ?? 0);
  const influencerTaxCents = Number(quote.influencerTaxCents ?? 0);
  const withholdingCents = Number(quote.withholdingCents ?? 0);
  if (
    !Number.isInteger(businessPaysCents) ||
    !Number.isInteger(influencerReceivesCents) ||
    !Number.isInteger(platformFeesTotalCents) ||
    !Number.isInteger(businessTaxCents) ||
    !Number.isInteger(influencerTaxCents) ||
    !Number.isInteger(withholdingCents)
  ) {
    return { error: "The signed quote amounts are incomplete." };
  }
  if (businessTaxCents + influencerTaxCents + withholdingCents !== 0) {
    return { error: "Tax collection is not part of this route." };
  }
  if (Number(businessPaysCents) !== Number(influencerReceivesCents) + Number(platformFeesTotalCents)) {
    return { error: "The signed quote does not reconcile." };
  }
  const milestoneCount = Number(quote.milestoneCount ?? 1);
  return {
    currency,
    businessPaysCents: Number(businessPaysCents),
    influencerReceivesCents: Number(influencerReceivesCents),
    platformFeesTotalCents: Number(platformFeesTotalCents),
    milestoneCount: Number.isInteger(milestoneCount) && milestoneCount > 0 ? milestoneCount : 1,
  };
}

export function collaborationLaunchBlockers(
  approvals: LaunchApprovals = DEFAULT_LAUNCH_APPROVALS,
  tax: TaxDetermination = { status: "unresolved", lines: [] },
): string[] {
  const blockers: string[] = [];
  if (!approvals.feeSchedulesApproved) blockers.push("Business and influencer fee schedules are not approved.");
  if (!approvals.taxTreatmentApproved || tax.status === "unresolved") {
    blockers.push("Tax treatment is not approved.");
  }
  if (tax.status === "approved_zero" && tax.lines.some((line) => line.amountCents !== 0)) {
    blockers.push("An approved zero tax determination cannot carry a tax amount.");
  }
  if (!approvals.earningRefundPolicyApproved) blockers.push("Fee earning and refund policy are not approved.");
  if (!approvals.providerRouteApproved) blockers.push("The provider route is not approved.");
  return blockers;
}

export function taxIsSeparateFromPlatformFees(lines: TaxLine[], platformFeesTotalCents: number) {
  const taxTotal = lines.reduce((sum, line) => sum + line.amountCents, 0);
  return { taxTotalCents: taxTotal, platformFeesTotalCents, taxIncludedInPlatformFees: false as const };
}

/** A stored two-letter country. A mailing address or the agreement jurisdiction is not this value. */
export function verifiedDomesticCountry(countryCode: string | null | undefined): string | null {
  const country = (countryCode ?? "").trim().toUpperCase();
  return /^[A-Z]{2}$/.test(country) ? country : null;
}

/** Records a verified funding country. An unchecked verification clears it. A country name is refused. */
export function recordedVerifiedCountry(input: {
  verified: boolean;
  countryCode: string;
}): { ok: true; country: string | null } | { ok: false; error: string } {
  if (!input.verified) return { ok: true, country: null };
  const country = verifiedDomesticCountry(input.countryCode);
  if (!country) return { ok: false, error: "Enter the verified funding country as a two-letter code." };
  return { ok: true, country };
}

export function domesticCollaborationGate(input: {
  businessCountry: string;
  influencerCountry: string;
  dealCountry: string;
  businessVerified: boolean;
  influencerVerified: boolean;
  routeActive: boolean;
  currency: string;
  routeCurrency: string;
  payoutMethod: string;
  crossBorderAllowed?: boolean;
}): { ok: true } | { ok: false; error: string } {
  const business = input.businessCountry.trim().toUpperCase();
  const influencer = input.influencerCountry.trim().toUpperCase();
  const deal = input.dealCountry.trim().toUpperCase();
  if (!input.businessVerified || !/^[A-Z]{2}$/.test(business)) {
    return { ok: false, error: "The business funding country is not verified." };
  }
  if (!input.influencerVerified || !/^[A-Z]{2}$/.test(influencer)) {
    return { ok: false, error: "The influencer payout country is not verified." };
  }
  if (!/^[A-Z]{2}$/.test(deal)) return { ok: false, error: "The deal country is incomplete." };
  if ((business !== influencer || business !== deal) && !input.crossBorderAllowed) {
    return { ok: false, error: "Cross-border funding is off. Turn it on in Payment settings to fund more than one country." };
  }
  if (!input.routeActive) return { ok: false, error: "The country route is not approved." };
  if (input.currency.trim().toUpperCase() !== input.routeCurrency.trim().toUpperCase()) {
    return { ok: false, error: "The deal currency does not match the route." };
  }
  if (!input.payoutMethod.trim()) return { ok: false, error: "Choose a payout method." };
  return { ok: true };
}

export function launchMilestoneGate(
  count: number,
  options?: { stagedAllowed?: boolean; maxMilestones?: number },
): { ok: true } | { ok: false; error: string } {
  if (count === 1) return { ok: true };
  const max = options?.maxMilestones ?? 4;
  if (options?.stagedAllowed && Number.isInteger(count) && count > 1 && count <= max) return { ok: true };
  return { ok: false, error: "Staged funding is off. This route allows one milestone until Payment settings turns it on." };
}

export function teamFundingGate(creatorCount: number, teamAllowed: boolean): { ok: true } | { ok: false; error: string } {
  if (!Number.isInteger(creatorCount) || creatorCount < 1) {
    return { ok: false, error: "A deal needs one influencer." };
  }
  if (creatorCount === 1 || teamAllowed) return { ok: true };
  return { ok: false, error: "Team funding is off. Turn it on in Payment settings to fund more than one influencer." };
}

export function buildSignedCommercialSnapshot(input: {
  quote: Extract<DualPlatformQuote, { ok: true }>;
  currency: string;
  minorDigits: number;
  agreementVersion?: number;
  tax?: TaxDetermination;
  milestoneCount: number;
  quotedAt?: Date;
  amountInputMode?: "gross_influencer_compensation" | "all_in_budget";
  validForMs?: number;
}): SignedCommercialSnapshot | { ok: false; error: string } {
  const tax = input.tax ?? { status: "unresolved" as const, lines: [] };
  if (tax.status === "approved_zero" && tax.lines.some((line) => line.amountCents !== 0)) {
    return { ok: false, error: "An approved zero tax determination cannot carry a tax amount." };
  }
  if (tax.status === "unresolved" && tax.lines.length > 0) {
    return { ok: false, error: "Unresolved tax treatment cannot add a tax line." };
  }
  const businessTax = tax.lines.filter((line) => line.type === "business_fee_tax").reduce((sum, line) => sum + line.amountCents, 0);
  const influencerTax = tax.lines
    .filter((line) => line.type === "influencer_fee_tax")
    .reduce((sum, line) => sum + line.amountCents, 0);
  const withholding = tax.lines.filter((line) => line.type === "withholding").reduce((sum, line) => sum + line.amountCents, 0);
  const businessPays = input.quote.businessPaysCents + businessTax;
  const influencerReceives = input.quote.influencerReceivesCents - influencerTax - withholding;
  if (influencerReceives < 0) {
    return { ok: false, error: "Taxes and fees reduce the influencer payout below zero. Nothing was signed." };
  }
  const quotedAt = input.quotedAt ?? new Date();
  const validForMs =
    Number.isInteger(input.validForMs) && input.validForMs != null && input.validForMs > 0
      ? input.validForMs
      : QUOTE_VALID_MS;
  return {
    agreementVersion: input.agreementVersion ?? 1,
    amountInputMode: input.amountInputMode ?? "gross_influencer_compensation",
    currency: input.currency.trim().toUpperCase(),
    minorDigits: input.minorDigits,
    grossInfluencerCompensationCents: input.quote.grossInfluencerCompensationCents,
    businessPlatformFeeCents: input.quote.businessPlatformFeeCents,
    influencerPlatformFeeCents: input.quote.influencerPlatformFeeCents,
    businessTaxCents: businessTax,
    influencerTaxCents: influencerTax,
    withholdingCents: withholding,
    businessPaysCents: businessPays,
    influencerReceivesCents: influencerReceives,
    platformFeesTotalCents: input.quote.platformFeesTotalCents,
    businessRuleId: input.quote.business.rule.id,
    businessRuleVersion: input.quote.business.rule.version,
    influencerRuleId: input.quote.influencer.rule.id,
    influencerRuleVersion: input.quote.influencer.rule.version,
    businessRateBps: input.quote.business.rule.method === "percent" || input.quote.business.rule.method === "percent_plus_fixed"
      ? input.quote.business.rule.percentBps
      : null,
    influencerRateBps:
      input.quote.influencer.rule.method === "percent" || input.quote.influencer.rule.method === "percent_plus_fixed"
        ? input.quote.influencer.rule.percentBps
        : null,
    businessFloorApplied: input.quote.business.floorApplied,
    businessCapApplied: input.quote.business.capApplied,
    influencerFloorApplied: input.quote.influencer.floorApplied,
    influencerCapApplied: input.quote.influencer.capApplied,
    rounding: "half_away_from_zero",
    taxLines: tax.lines,
    taxStatus: tax.status,
    milestoneCount: input.milestoneCount,
    validUntil: new Date(quotedAt.getTime() + validForMs).toISOString(),
    feeState: "reserved",
  };
}

/** Locks the business fee. When the influencer rule also matches, both signed amounts are stored for funding. */
export function buildBusinessCommercialSnapshot(input: {
  quote: {
    grossInfluencerCompensationCents: number;
    feeCents: number;
    totalCents: number;
    rule: { id: string; version: number; method: string; percentBps: number };
    floorApplied: boolean;
    capApplied: boolean;
  };
  influencer?: {
    grossInfluencerCompensationCents: number;
    feeCents: number;
    totalCents: number;
    rule: { id: string; version: number; method: string; percentBps: number };
    floorApplied: boolean;
    capApplied: boolean;
  } | null;
  currency: string;
  minorDigits: number;
  agreementVersion?: number;
  tax?: TaxDetermination;
  milestoneCount: number;
  quotedAt?: Date;
  amountInputMode?: "gross_influencer_compensation" | "all_in_budget";
  validForMs?: number;
  activation?: {
    activationFeeCents: number;
    businessCollaborationFeeCents: number;
    activationRuleId: string;
    activationRuleVersion: number;
    allocations: {
      grossCents: number;
      businessCollaborationFeeCents: number;
      influencerFeeCents: number;
      influencerNetCents: number;
    }[];
  };
}): SignedCommercialSnapshot | { ok: false; error: string } {
  const tax = input.tax ?? { status: "unresolved" as const, lines: [] };
  if (tax.status === "approved_zero" && tax.lines.some((line) => line.amountCents !== 0)) {
    return { ok: false, error: "An approved zero tax determination cannot carry a tax amount." };
  }
  if (tax.status === "unresolved" && tax.lines.length > 0) {
    return { ok: false, error: "Unresolved tax treatment cannot add a tax line." };
  }
  const businessTax = tax.lines.filter((line) => line.type === "business_fee_tax").reduce((sum, line) => sum + line.amountCents, 0);
  const influencerTax = tax.lines.filter((line) => line.type === "influencer_fee_tax").reduce((sum, line) => sum + line.amountCents, 0);
  const influencer = input.influencer;
  const influencerLocked =
    influencer != null && influencer.grossInfluencerCompensationCents === input.quote.grossInfluencerCompensationCents;
  if (influencerLocked && influencer.totalCents - influencerTax < 0) {
    return { ok: false, error: "Influencer fee tax reduces the payout below zero. Nothing was stored." };
  }
  if (
    input.activation &&
    input.activation.activationFeeCents + input.activation.businessCollaborationFeeCents !== input.quote.feeCents
  ) {
    return { ok: false, error: "The activation split does not match the business fee." };
  }
  const quotedAt = input.quotedAt ?? new Date();
  const validForMs =
    Number.isInteger(input.validForMs) && input.validForMs != null && input.validForMs > 0
      ? input.validForMs
      : QUOTE_VALID_MS;
  return {
    agreementVersion: input.agreementVersion ?? 1,
    amountInputMode: input.amountInputMode ?? "gross_influencer_compensation",
    currency: input.currency.trim().toUpperCase(),
    minorDigits: input.minorDigits,
    grossInfluencerCompensationCents: input.quote.grossInfluencerCompensationCents,
    businessPlatformFeeCents: input.quote.feeCents,
    influencerPlatformFeeCents: influencerLocked ? influencer.feeCents : null,
    businessTaxCents: businessTax,
    influencerTaxCents: influencerTax,
    withholdingCents: 0,
    businessPaysCents: input.quote.totalCents + businessTax,
    influencerReceivesCents: influencerLocked ? influencer.totalCents - influencerTax : null,
    platformFeesTotalCents: input.quote.feeCents + (influencerLocked ? influencer.feeCents : 0),
    businessRuleId: input.quote.rule.id,
    businessRuleVersion: input.quote.rule.version,
    influencerRuleId: influencerLocked ? influencer.rule.id : null,
    influencerRuleVersion: influencerLocked ? influencer.rule.version : null,
    businessRateBps:
      input.quote.rule.method === "percent" || input.quote.rule.method === "percent_plus_fixed"
        ? input.quote.rule.percentBps
        : null,
    influencerRateBps:
      influencerLocked && (influencer.rule.method === "percent" || influencer.rule.method === "percent_plus_fixed")
        ? influencer.rule.percentBps
        : null,
    businessFloorApplied: input.quote.floorApplied,
    businessCapApplied: input.quote.capApplied,
    influencerFloorApplied: influencerLocked ? influencer.floorApplied : false,
    influencerCapApplied: influencerLocked ? influencer.capApplied : false,
    rounding: "half_away_from_zero",
    taxLines: tax.lines,
    taxStatus: tax.status,
    milestoneCount: input.milestoneCount,
    validUntil: new Date(quotedAt.getTime() + validForMs).toISOString(),
    feeState: "reserved",
    ...(input.activation
      ? {
          activationFeeCents: input.activation.activationFeeCents,
          businessCollaborationFeeCents: input.activation.businessCollaborationFeeCents,
          activationRuleId: input.activation.activationRuleId,
          activationRuleVersion: input.activation.activationRuleVersion,
          milestoneAllocations: input.activation.allocations,
        }
      : {}),
  };
}

export function signedQuoteExpired(plan: unknown, now = new Date()): string | null {
  if (!plan || typeof plan !== "object") return null;
  const quote = (plan as { signedQuote?: { validUntil?: unknown } }).signedQuote;
  if (!quote?.validUntil || typeof quote.validUntil !== "string") return null;
  const until = new Date(quote.validUntil);
  if (Number.isNaN(until.getTime()) || now.getTime() > until.getTime()) {
    return "This quote has expired. Sign a new breakdown before funding. Nothing was charged.";
  }
  return null;
}

export function directGrossEditBlock(plan: unknown): string | null {
  if (!plan || typeof plan !== "object") return null;
  const row = plan as { feeReservation?: { status?: unknown }; signedQuote?: unknown };
  if (row.feeReservation?.status === "reserved" || row.signedQuote) {
    return "A new agreement version and fresh signatures are required. The signed amounts were not changed.";
  }
  return null;
}

export function ordinaryDealShareSnapshot(): { label: string; shareBps: number }[] {
  return [{ label: "Influencer", shareBps: 10_000 }];
}

export type ProviderAdvanceInput = {
  eventName: string;
  holdingAvailable: boolean;
  beneficiaryConfirmed: boolean;
  amountCents: number;
  expectedAmountCents: number;
  currency: string;
  expectedCurrency: string;
  accountId: string;
  expectedAccountId: string;
  environment: string;
  expectedEnvironment: string;
  fundingId: string;
  expectedFundingId: string;
  duplicate: boolean;
};

export function providerEventMayAdvance(input: ProviderAdvanceInput): { advance: true } | { advance: false; reason: string } {
  if (input.duplicate) return { advance: false, reason: "This provider event was already applied." };
  if (input.fundingId !== input.expectedFundingId) return { advance: false, reason: "The provider event is for a different deal." };
  const currency = input.currency.trim().toUpperCase();
  const expectedCurrency = input.expectedCurrency.trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(currency) || !/^[A-Z]{3}$/.test(expectedCurrency)) {
    return { advance: false, reason: "The provider event has no currency." };
  }
  if (currency !== expectedCurrency) {
    return { advance: false, reason: "The provider currency does not match the deal." };
  }
  if (input.amountCents !== input.expectedAmountCents) return { advance: false, reason: "The provider amount does not match the deal." };
  if (!input.accountId.trim() || input.accountId !== input.expectedAccountId) {
    return { advance: false, reason: "The provider account does not match the route." };
  }
  if (!input.environment.trim() || input.environment !== input.expectedEnvironment) {
    return { advance: false, reason: "The provider environment does not match the route." };
  }
  if (input.eventName === "payment_intent.succeeded" && !input.holdingAvailable) {
    return {
      advance: false,
      reason: "Collection succeeded without evidence that funds are available for release. Work stays blocked.",
    };
  }
  return { advance: true };
}

export function providerLedgerAdvance(body: string, expected?: {
  amountCents: number;
  currency: string;
  accountId: string;
  environment: string;
  fundingId: string;
  duplicate?: boolean;
}): { advance: true } | { advance: false; reason: string } {
  let parsed: {
    id?: unknown;
    name?: unknown;
    account_id?: unknown;
    environment?: unknown;
    data?: { object?: { amount?: unknown; currency?: unknown; metadata?: Record<string, unknown> } };
  };
  try {
    parsed = JSON.parse(body);
  } catch {
    return { advance: false, reason: "The provider payload could not be read." };
  }
  const name = String(parsed.name ?? "");
  const object = parsed.data?.object;
  const metadata = object?.metadata ?? {};
  const holdingAvailable = metadata.holdingAvailable === true || metadata.holding_status === "available";
  const beneficiaryConfirmed = metadata.beneficiaryConfirmed === true || metadata.payout_status === "confirmed";
  const amountRaw = object?.amount;
  const amountCents = typeof amountRaw === "number" ? Math.round(amountRaw) : Number(amountRaw);
  const currency = typeof object?.currency === "string" ? object.currency : "";
  const fundingId = typeof metadata.fundingId === "string" ? metadata.fundingId : "";
  const accountId = typeof parsed.account_id === "string" ? parsed.account_id : "";
  const environment = typeof parsed.environment === "string" ? parsed.environment : "";
  if (!expected) {
    return { advance: false, reason: "Saved route facts are required before this event can move money." };
  }
  return providerEventMayAdvance({
    eventName: name,
    holdingAvailable,
    beneficiaryConfirmed,
    amountCents: Number.isInteger(amountCents) ? amountCents : -1,
    expectedAmountCents: expected.amountCents,
    currency,
    expectedCurrency: expected.currency,
    accountId,
    expectedAccountId: expected.accountId,
    environment,
    expectedEnvironment: expected.environment,
    fundingId,
    expectedFundingId: expected.fundingId,
    duplicate: Boolean(expected.duplicate),
  });
}

export function reserveFeePostings(snapshot: SignedCommercialSnapshot): LedgerPosting[] {
  const rows: LedgerPosting[] = [
    { kind: "fee_pending", party: "platform", side: "business", amountCents: snapshot.businessPlatformFeeCents },
  ];
  if (snapshot.influencerPlatformFeeCents != null) {
    rows.push({ kind: "fee_pending", party: "platform", side: "influencer", amountCents: snapshot.influencerPlatformFeeCents });
  }
  if (snapshot.influencerReceivesCents != null) {
    rows.push({ kind: "influencer_payable", party: "influencer", amountCents: snapshot.influencerReceivesCents });
  }
  for (const line of snapshot.taxLines) {
    if (line.amountCents > 0) rows.push({ kind: "tax", party: "tax", amountCents: line.amountCents });
  }
  return rows;
}

export function collectionPostings(snapshot: SignedCommercialSnapshot, holdingAvailable: boolean): LedgerPosting[] | { ok: false; error: string } {
  const collection: LedgerPosting = { kind: "collection", party: "business", amountCents: snapshot.businessPaysCents };
  if (!holdingAvailable) return { ok: false, error: "A charge without holding evidence does not make funds available." };
  return [collection, { kind: "hold", party: "business", amountCents: snapshot.businessPaysCents }];
}

export function earnPlatformFees(input: {
  policyApproved: boolean;
  finalPayoutConfirmed: boolean;
  alreadyEarned: boolean;
  businessFeeCents: number;
  influencerFeeCents: number;
}): { ok: true; entries: LedgerPosting[] } | { ok: false; error: string } {
  if (!input.policyApproved) return { ok: false, error: "Fee earning is not approved. Both fees stay reserved." };
  if (!input.finalPayoutConfirmed) return { ok: false, error: "Both fees stay reserved until the final payout is confirmed." };
  if (input.alreadyEarned) return { ok: false, error: "These fees were already earned." };
  return {
    ok: true,
    entries: [
      { kind: "fee_earned", party: "platform", side: "business", amountCents: input.businessFeeCents },
      { kind: "fee_earned", party: "platform", side: "influencer", amountCents: input.influencerFeeCents },
    ],
  };
}

/** Move earned fees to operating funds. Earning rows stay. A second settlement is refused. */
export function settlePlatformFees(input: {
  earned: boolean;
  alreadySettled: boolean;
  businessFeeCents: number;
  influencerFeeCents: number;
  amountCents: number;
  providerReference: string;
}): { ok: true; entries: LedgerPosting[] } | { ok: false; error: string } {
  if (!input.earned) return { ok: false, error: "Fees stay in clearing until they are earned." };
  if (input.alreadySettled) return { ok: false, error: "These fees were already settled to operating funds." };
  const total = input.businessFeeCents + input.influencerFeeCents;
  if (!Number.isInteger(total) || total < 0) return { ok: false, error: "The earned platform fees are missing." };
  if (input.amountCents !== total) {
    return { ok: false, error: "The settlement does not match the earned platform fees." };
  }
  if (total === 0) return { ok: true, entries: [] };
  if (input.providerReference.trim().length < 4) {
    return { ok: false, error: "A provider settlement reference is required." };
  }
  const entries: LedgerPosting[] = [];
  if (input.businessFeeCents > 0) {
    entries.push({ kind: "fee_settled", party: "platform", side: "business", amountCents: input.businessFeeCents });
  }
  if (input.influencerFeeCents > 0) {
    entries.push({ kind: "fee_settled", party: "platform", side: "influencer", amountCents: input.influencerFeeCents });
  }
  return { ok: true, entries };
}

/** Eligible fees that have not moved to operations. Activation has no milestone. Suspended milestone fees are already removed. */
export function eligiblePlatformFeePosition(
  entries: { kind: string; amountCents: number; party?: string; milestoneId?: string | null }[],
) {
  const sum = (kind: string, party: string, milestoneId: string | null) =>
    entries
      .filter((entry) => entry.kind === kind && entry.party === party && (entry.milestoneId ?? null) === milestoneId)
      .reduce((total, entry) => total + entry.amountCents, 0);
  const activation = Math.max(0, sum("fee_eligible", "platform:business", null) - sum("reversal", "platform:business_eligible", null));
  const milestoneIds = [...new Set(entries.map((entry) => entry.milestoneId).filter((id): id is string => Boolean(id)))];
  let business = activation;
  let influencer = 0;
  for (const milestoneId of milestoneIds) {
    const open = openMilestoneCollaborationFees(entries, milestoneId);
    business += open.businessCollaborationFeeCents;
    influencer += open.influencerFeeCents;
  }
  const settledBusiness = entries
    .filter((entry) => entry.kind === "fee_settled" && entry.party === "platform:business")
    .reduce((total, entry) => total + entry.amountCents, 0);
  const settledInfluencer = entries
    .filter((entry) => entry.kind === "fee_settled" && entry.party === "platform:influencer")
    .reduce((total, entry) => total + entry.amountCents, 0);
  return {
    eligibleBusinessCents: business,
    eligibleInfluencerCents: influencer,
    settledBusinessCents: settledBusiness,
    settledInfluencerCents: settledInfluencer,
    unsettledBusinessCents: Math.max(0, business - settledBusiness),
    unsettledInfluencerCents: Math.max(0, influencer - settledInfluencer),
    activationEligibleCents: activation,
  };
}

/** Fees a partial refund gives back. Retained fees stay. Settled amounts become a recovery instead of a held reduction. */
export function partialRefundFeeReversals(input: {
  activationFeeCents: number;
  businessCollaborationFeeCents: number;
  influencerFeeCents: number;
  retainedActivationCents: number;
  retainedBusinessCollaborationCents: number;
  retainedInfluencerFeeCents: number;
  activationEligibleCents: number;
  settledBusinessCents: number;
}): { ok: true; entries: LedgerPosting[] } | { ok: false; error: string } {
  const amounts = Object.values(input);
  if (amounts.some((amount) => !Number.isInteger(amount) || amount < 0)) {
    return { ok: false, error: "The refund fee reversal does not reconcile." };
  }
  const unretainedActivation = input.activationFeeCents - input.retainedActivationCents;
  const unretainedCollaboration = input.businessCollaborationFeeCents - input.retainedBusinessCollaborationCents;
  const unretainedInfluencer = input.influencerFeeCents - input.retainedInfluencerFeeCents;
  if (unretainedActivation < 0 || unretainedCollaboration < 0 || unretainedInfluencer < 0) {
    return { ok: false, error: "The refund fee reversal does not reconcile." };
  }
  const entries: LedgerPosting[] = [];
  if (unretainedCollaboration > 0) {
    entries.push({
      kind: "reversal",
      party: "platform",
      side: "business_pending",
      amountCents: unretainedCollaboration,
      reverses: "fee_pending",
    });
  }
  if (unretainedInfluencer > 0) {
    entries.push({
      kind: "reversal",
      party: "platform",
      side: "influencer_pending",
      amountCents: unretainedInfluencer,
      reverses: "fee_pending",
    });
  }
  const eligibleReversal = Math.min(unretainedActivation, input.activationEligibleCents);
  if (eligibleReversal > 0) {
    entries.push({
      kind: "reversal",
      party: "platform",
      side: "business_eligible",
      amountCents: eligibleReversal,
      reverses: "fee_eligible",
    });
  }
  const retainedBusiness = input.retainedActivationCents + input.retainedBusinessCollaborationCents;
  const recovery = Math.min(
    unretainedActivation + unretainedCollaboration,
    Math.max(0, input.settledBusinessCents - retainedBusiness),
  );
  if (recovery > 0) {
    entries.push({
      kind: "reversal",
      party: "platform",
      side: "recovery",
      amountCents: recovery,
      reverses: "fee_settled",
    });
  }
  return { ok: true, entries };
}

/** Move the currently eligible remainder to operating funds. Ineligible fees stay reserved. */
export function settleEligiblePlatformFees(input: {
  eligibleBusinessCents: number;
  eligibleInfluencerCents: number;
  settledBusinessCents: number;
  settledInfluencerCents: number;
  amountCents: number;
  providerReference: string;
}): { ok: true; entries: LedgerPosting[] } | { ok: false; error: string } {
  const amounts = [
    input.eligibleBusinessCents,
    input.eligibleInfluencerCents,
    input.settledBusinessCents,
    input.settledInfluencerCents,
    input.amountCents,
  ];
  if (amounts.some((amount) => !Number.isInteger(amount) || amount < 0)) {
    return { ok: false, error: "The eligible platform fees are missing." };
  }
  const business = Math.max(0, input.eligibleBusinessCents - input.settledBusinessCents);
  const influencer = Math.max(0, input.eligibleInfluencerCents - input.settledInfluencerCents);
  const unsettled = business + influencer;
  if (unsettled <= 0) return { ok: false, error: "Nothing is eligible to settle." };
  if (input.amountCents !== unsettled) {
    return { ok: false, error: "The settlement does not match the eligible platform fees." };
  }
  if (input.providerReference.trim().length < 4) {
    return { ok: false, error: "A provider settlement reference is required." };
  }
  const entries: LedgerPosting[] = [];
  if (business > 0) entries.push({ kind: "fee_settled", party: "platform", side: "business", amountCents: business });
  if (influencer > 0) entries.push({ kind: "fee_settled", party: "platform", side: "influencer", amountCents: influencer });
  return { ok: true, entries };
}

/** The provider's own charge. It is not platform fee revenue and does not change signed amounts. */
export function providerFeePosting(input: {
  amountCents: number;
  providerReference: string;
}): { ok: true; entries: LedgerPosting[] } | { ok: false; error: string } {
  if (!Number.isInteger(input.amountCents) || input.amountCents <= 0) {
    return { ok: false, error: "The provider fee is missing." };
  }
  if (input.providerReference.trim().length < 4) {
    return { ok: false, error: "A provider fee reference is required." };
  }
  return { ok: true, entries: [{ kind: "provider_fee", party: "provider", amountCents: input.amountCents }] };
}

export function refundPostings(input: {
  policyApproved: boolean;
  businessPaysCents: number;
  businessFeeCents: number;
  influencerFeeCents: number;
  businessTaxCents: number;
  influencerTaxCents: number;
  feeRefundable: boolean;
  taxReversible: boolean;
}): { ok: true; entries: LedgerPosting[] } | { ok: false; error: string } {
  if (!input.policyApproved) return { ok: false, error: "The refund policy is not approved. Nothing was refunded." };
  const entries: LedgerPosting[] = [
    { kind: "refund", party: "business", amountCents: input.businessPaysCents, reverses: "collection" },
  ];
  if (input.feeRefundable) {
    entries.push(
      { kind: "reversal", party: "platform", side: "business", amountCents: input.businessFeeCents, reverses: "fee_pending" },
      { kind: "reversal", party: "platform", side: "influencer", amountCents: input.influencerFeeCents, reverses: "fee_pending" },
    );
  }
  if (input.taxReversible) {
    const tax = input.businessTaxCents + input.influencerTaxCents;
    if (tax > 0) entries.push({ kind: "reversal", party: "tax", amountCents: tax, reverses: "tax" });
  }
  return { ok: true, entries };
}

export type CancellationStage = "before_work" | "after_partial_delivery" | "after_payout" | "after_fee_earning";

/** Where the deal is when someone asks to cancel. Earning is checked before the payout amount. */
export function cancellationStage(input: {
  releasedCents: number;
  influencerReceivesCents: number;
  feesEarned: boolean;
}): CancellationStage {
  if (input.feesEarned) return "after_fee_earning";
  if (!Number.isInteger(input.releasedCents) || input.releasedCents <= 0) return "before_work";
  if (input.releasedCents < input.influencerReceivesCents) return "after_partial_delivery";
  return "after_payout";
}

/**
 * Defined result for each cancellation point. New reversal rows only.
 * A payout that already left holding is refunded only after that payout is recorded as returned.
 */
export function cancellationPostings(input: {
  stage: CancellationStage;
  policyApproved: boolean;
  payoutReturned: boolean;
  businessPaysCents: number;
  influencerReceivesCents: number;
  businessFeeCents: number;
  influencerFeeCents: number;
  businessTaxCents: number;
  influencerTaxCents: number;
}): { ok: true; entries: LedgerPosting[] } | { ok: false; error: string } {
  if (!input.policyApproved) return { ok: false, error: "The refund policy is not approved. Nothing was refunded." };
  if (input.stage === "after_partial_delivery") {
    return { ok: false, error: "Partial delivery has no automatic refund. Finance records the amount still held." };
  }
  if ((input.stage === "after_payout" || input.stage === "after_fee_earning") && !input.payoutReturned) {
    return { ok: false, error: "Record the returned payout before refunding the business. Nothing was refunded." };
  }
  const feeReverses = input.stage === "after_fee_earning" ? "fee_earned" : "fee_pending";
  const entries: LedgerPosting[] = [
    { kind: "refund", party: "business", amountCents: input.businessPaysCents, reverses: "collection" },
  ];
  if (input.businessFeeCents > 0) {
    entries.push({
      kind: "reversal",
      party: "platform",
      side: "business",
      amountCents: input.businessFeeCents,
      reverses: feeReverses,
    });
  }
  if (input.influencerFeeCents > 0) {
    entries.push({
      kind: "reversal",
      party: "platform",
      side: "influencer",
      amountCents: input.influencerFeeCents,
      reverses: feeReverses,
    });
  }
  const tax = input.businessTaxCents + input.influencerTaxCents;
  if (tax > 0) entries.push({ kind: "reversal", party: "tax", amountCents: tax, reverses: "tax" });
  if (input.stage === "before_work" && input.influencerReceivesCents > 0) {
    entries.push({
      kind: "reversal",
      party: "influencer",
      amountCents: input.influencerReceivesCents,
      reverses: "influencer_payable",
    });
  }
  return { ok: true, entries };
}

export function returnedPayoutPostings(input: {
  amountCents: number;
  alreadyReturned: boolean;
}): { ok: true; entries: LedgerPosting[] } | { ok: false; error: string } {
  if (input.alreadyReturned) return { ok: false, error: "This payout return is already recorded. A retry stays blocked." };
  if (!Number.isInteger(input.amountCents) || input.amountCents <= 0) {
    return { ok: false, error: "The returned amount is missing." };
  }
  return {
    ok: true,
    entries: [{ kind: "return", party: "influencer", amountCents: input.amountCents, reverses: "payout" }],
  };
}

function isEarnedFeeParty(party: string) {
  return party === "platform" || party === "platform:business" || party === "platform:influencer";
}

/** Fees stay earned only while earned rows exceed later reversals of those fees. */
export function platformFeeEarningState(entries: { kind: string; amountCents: number; party?: string }[]) {
  const earned = entries
    .filter((entry) => entry.kind === "fee_earned")
    .reduce((sum, entry) => sum + entry.amountCents, 0);
  const reversed = entries
    .filter((entry) => entry.kind === "reversal" && isEarnedFeeParty(entry.party ?? ""))
    .reduce((sum, entry) => sum + entry.amountCents, 0);
  return {
    earned: earned > 0 && reversed < earned,
    reversed: earned > 0 && reversed >= earned,
  };
}

export type SignedDealMoney = {
  businessPaysCents: number;
  influencerReceivesCents: number;
  businessPlatformFeeCents: number;
  influencerPlatformFeeCents: number;
  businessTaxCents: number;
  influencerTaxCents: number;
  activationFeeCents?: number;
};

export function readSignedDealMoney(plan: unknown): SignedDealMoney | null {
  if (!plan || typeof plan !== "object") return null;
  const quote = (plan as { signedQuote?: Record<string, unknown> }).signedQuote;
  if (!quote) return null;
  const money = {
    businessPaysCents: quote.businessPaysCents,
    influencerReceivesCents: quote.influencerReceivesCents,
    businessPlatformFeeCents: quote.businessPlatformFeeCents,
    influencerPlatformFeeCents: quote.influencerPlatformFeeCents,
    businessTaxCents: quote.businessTaxCents ?? 0,
    influencerTaxCents: quote.influencerTaxCents ?? 0,
  };
  if (Object.values(money).some((amount) => !Number.isInteger(amount) || Number(amount) < 0)) return null;
  const activation = quote.activationFeeCents;
  if (activation != null && (!Number.isInteger(activation) || Number(activation) < 0)) return null;
  return {
    businessPaysCents: Number(money.businessPaysCents),
    influencerReceivesCents: Number(money.influencerReceivesCents),
    businessPlatformFeeCents: Number(money.businessPlatformFeeCents),
    influencerPlatformFeeCents: Number(money.influencerPlatformFeeCents),
    businessTaxCents: Number(money.businessTaxCents),
    influencerTaxCents: Number(money.influencerTaxCents),
    ...(activation == null ? {} : { activationFeeCents: Number(activation) }),
  };
}

/** Collaboration fees for one milestone become eligible once, on its confirmed payout. Missing allocations stay on the older earning path. */
export function collaborationMilestoneFees(input: {
  allocations: unknown;
  milestoneCount: number;
  milestoneIndex: number;
}):
  | { ok: true; fees: { businessCollaborationFeeCents: number; influencerFeeCents: number } | null }
  | { ok: false; error: string } {
  if (input.allocations == null) return { ok: true, fees: null };
  if (!Array.isArray(input.allocations) || input.allocations.length === 0) return { ok: true, fees: null };
  if (
    !Number.isInteger(input.milestoneCount) ||
    input.allocations.length !== input.milestoneCount ||
    !Number.isInteger(input.milestoneIndex) ||
    input.milestoneIndex < 0 ||
    input.milestoneIndex >= input.allocations.length
  ) {
    return { ok: false, error: "The frozen milestone allocation does not match this schedule." };
  }
  const row = input.allocations[input.milestoneIndex];
  if (!row || typeof row !== "object") return { ok: false, error: "The frozen milestone allocation does not reconcile." };
  const business = (row as { businessCollaborationFeeCents?: unknown }).businessCollaborationFeeCents;
  const influencer = (row as { influencerFeeCents?: unknown }).influencerFeeCents;
  if (!Number.isInteger(business) || !Number.isInteger(influencer) || Number(business) < 0 || Number(influencer) < 0) {
    return { ok: false, error: "The frozen milestone allocation does not reconcile." };
  }
  return {
    ok: true,
    fees: { businessCollaborationFeeCents: Number(business), influencerFeeCents: Number(influencer) },
  };
}

function milestoneCollaborationEligibility(
  fees: { businessCollaborationFeeCents: number; influencerFeeCents: number } | null | undefined,
  alreadyEligible: boolean,
): { ok: true; entries: LedgerPosting[] } | { ok: false; error: string } {
  if (!fees || alreadyEligible) return { ok: true, entries: [] };
  if (
    !Number.isInteger(fees.businessCollaborationFeeCents) ||
    !Number.isInteger(fees.influencerFeeCents) ||
    fees.businessCollaborationFeeCents < 0 ||
    fees.influencerFeeCents < 0
  ) {
    return { ok: false, error: "The frozen milestone allocation does not reconcile." };
  }
  const entries: LedgerPosting[] = [];
  if (fees.businessCollaborationFeeCents > 0) {
    entries.push({
      kind: "fee_eligible",
      party: "platform",
      side: "business",
      amountCents: fees.businessCollaborationFeeCents,
    });
  }
  if (fees.influencerFeeCents > 0) {
    entries.push({
      kind: "fee_eligible",
      party: "platform",
      side: "influencer",
      amountCents: fees.influencerFeeCents,
    });
  }
  return { ok: true, entries };
}

/** Extra ledger rows for a signed dual-fee deal. The original signed amounts stay unchanged. */
export function signedDealMoneyEvents(input: {
  deal: SignedDealMoney;
  eventType: "funding.held" | "payout.released" | "payout.refunded" | "payout.returned";
  amountCents: number;
  policyApproved: boolean;
  finalPayout: boolean;
  alreadyEarned: boolean;
  alreadyReturned: boolean;
  alreadyActivationEligible?: boolean;
  /** Frozen collaboration fees for the milestone whose payout just succeeded. */
  milestoneFees?: { businessCollaborationFeeCents: number; influencerFeeCents: number } | null;
  alreadyMilestoneEligible?: boolean;
  /** Collaboration fees for this payout already settled to operations. */
  feesSettled?: boolean;
  releasedCents?: number;
  payoutReturned?: boolean;
  /** The still-open provider payout this return closes. Omit only for a full signed payout. */
  operationReleasedCents?: number;
  /** Returns already posted on this agreement, excluding the open payout being closed. */
  alreadyReturnedCents?: number;
  feesReversed?: boolean;
  /** Approved refund instruction. A partial amount is accepted only when it matches this figure. */
  operationRefundCents?: number;
  /** Unretained fees for a partial refund. Omitted refunds do not reverse fees. */
  refundFees?: {
    activationFeeCents: number;
    businessCollaborationFeeCents: number;
    influencerFeeCents: number;
    retainedActivationCents: number;
    retainedBusinessCollaborationCents: number;
    retainedInfluencerFeeCents: number;
    activationEligibleCents: number;
    settledBusinessCents: number;
  } | null;
  alreadyRefundedCents?: number;
}): { ok: true; entries: LedgerPosting[] } | { ok: false; error: string } {
  if (input.eventType === "funding.held") {
    if (input.amountCents !== input.deal.businessPaysCents) {
      return { ok: false, error: "The collection does not match the signed business payment." };
    }
    const entries: LedgerPosting[] = [
      { kind: "fee_pending", party: "platform", side: "business", amountCents: input.deal.businessPlatformFeeCents },
      { kind: "fee_pending", party: "platform", side: "influencer", amountCents: input.deal.influencerPlatformFeeCents },
      { kind: "influencer_payable", party: "influencer", amountCents: input.deal.influencerReceivesCents },
    ];
    const activation = input.deal.activationFeeCents ?? 0;
    if (!input.alreadyActivationEligible && activation > 0) {
      entries.push({ kind: "fee_eligible", party: "platform", side: "business", amountCents: activation });
    }
    return { ok: true, entries };
  }
  if (input.eventType === "payout.released") {
    const released = input.releasedCents ?? input.amountCents;
    if (
      !Number.isInteger(input.amountCents) ||
      input.amountCents <= 0 ||
      input.amountCents > input.deal.influencerReceivesCents ||
      !Number.isInteger(released) ||
      released < input.amountCents ||
      released > input.deal.influencerReceivesCents
    ) {
      return { ok: false, error: "The payout does not match the signed influencer amount." };
    }
    const eligible = milestoneCollaborationEligibility(input.milestoneFees, input.alreadyMilestoneEligible === true);
    if (!eligible.ok) return eligible;
    if (!input.finalPayout || input.alreadyEarned) return { ok: true, entries: eligible.entries };
    if (released !== input.deal.influencerReceivesCents) {
      return { ok: false, error: "The payout does not match the signed influencer amount." };
    }
    const earned = earnPlatformFees({
      policyApproved: input.policyApproved,
      finalPayoutConfirmed: true,
      alreadyEarned: false,
      businessFeeCents: input.deal.businessPlatformFeeCents,
      influencerFeeCents: input.deal.influencerPlatformFeeCents,
    });
    if (!earned.ok) return { ok: true, entries: eligible.entries };
    return { ok: true, entries: [...eligible.entries, ...earned.entries] };
  }
  if (input.eventType === "payout.refunded") {
    const alreadyRefunded = input.alreadyRefundedCents ?? 0;
    if (!Number.isInteger(input.amountCents) || input.amountCents <= 0 || !Number.isInteger(alreadyRefunded) || alreadyRefunded < 0) {
      return { ok: false, error: "The refund amount is missing." };
    }
    if (alreadyRefunded + input.amountCents > input.deal.businessPaysCents) {
      return { ok: false, error: "The refund is larger than the remaining signed business payment." };
    }
    const fullRefund = input.amountCents === input.deal.businessPaysCents && alreadyRefunded === 0;
    if (input.operationRefundCents == null) {
      if (!fullRefund) {
        return { ok: false, error: "A signed deal refunds the full business payment on the original route." };
      }
    } else if (!Number.isInteger(input.operationRefundCents) || input.amountCents !== input.operationRefundCents) {
      return { ok: false, error: "The refund does not match this refund instruction." };
    }
    if (fullRefund) {
      return cancellationPostings({
        stage: cancellationStage({
          releasedCents: input.releasedCents ?? 0,
          influencerReceivesCents: input.deal.influencerReceivesCents,
          feesEarned: input.alreadyEarned,
        }),
        policyApproved: input.policyApproved,
        payoutReturned: input.payoutReturned ?? false,
        businessPaysCents: input.deal.businessPaysCents,
        influencerReceivesCents: input.deal.influencerReceivesCents,
        businessFeeCents: input.deal.businessPlatformFeeCents,
        influencerFeeCents: input.deal.influencerPlatformFeeCents,
        businessTaxCents: input.deal.businessTaxCents,
        influencerTaxCents: input.deal.influencerTaxCents,
      });
    }
    if (!input.policyApproved) return { ok: false, error: "The refund policy is not approved. Nothing was refunded." };
    const entries: LedgerPosting[] = [{ kind: "refund", party: "business", amountCents: input.amountCents, reverses: "collection" }];
    if (input.refundFees) {
      const reversed = partialRefundFeeReversals(input.refundFees);
      if (!reversed.ok) return reversed;
      entries.push(...reversed.entries);
    }
    return { ok: true, entries };
  }
  if (input.alreadyReturned) {
    return { ok: false, error: "This payout return is already recorded. A retry stays blocked." };
  }
  if (!Number.isInteger(input.amountCents) || input.amountCents <= 0) {
    return { ok: false, error: "The returned amount is missing." };
  }
  const priorReturns = input.alreadyReturnedCents ?? 0;
  if (!Number.isInteger(priorReturns) || priorReturns < 0 || input.amountCents > input.deal.influencerReceivesCents) {
    return { ok: false, error: "The returned amount does not match the signed influencer payout." };
  }
  if (input.operationReleasedCents == null) {
    if (input.amountCents !== input.deal.influencerReceivesCents || priorReturns > 0) {
      return { ok: false, error: "The returned amount does not match the signed influencer payout." };
    }
  } else if (
    !Number.isInteger(input.operationReleasedCents) ||
    input.amountCents !== input.operationReleasedCents
  ) {
    return { ok: false, error: "The returned amount does not match this payout." };
  }
  const posted = returnedPayoutPostings({ amountCents: input.amountCents, alreadyReturned: false });
  if (!posted.ok) return posted;
  const suspended = suspendMilestoneEligibility(input.milestoneFees, input.feesSettled === true);
  if (!suspended.ok) return suspended;
  const returnedEntries = [...posted.entries, ...suspended.entries];
  if (!input.alreadyEarned || input.feesReversed) return { ok: true, entries: returnedEntries };
  const reversals: LedgerPosting[] = [];
  if (input.deal.businessPlatformFeeCents > 0) {
    reversals.push({
      kind: "reversal",
      party: "platform",
      side: "business",
      amountCents: input.deal.businessPlatformFeeCents,
      reverses: "fee_earned",
    });
  }
  if (input.deal.influencerPlatformFeeCents > 0) {
    reversals.push({
      kind: "reversal",
      party: "platform",
      side: "influencer",
      amountCents: input.deal.influencerPlatformFeeCents,
      reverses: "fee_earned",
    });
  }
  return { ok: true, entries: [...returnedEntries, ...reversals] };
}

/** Open collaboration-fee eligibility for one milestone. Activation rows have no milestone and stay out. */
export function openMilestoneCollaborationFees(
  entries: { kind: string; amountCents: number; party?: string; milestoneId?: string | null }[],
  milestoneId: string,
) {
  const net = (eligibleParty: string, reversalParty: string) => {
    const eligible = entries
      .filter((entry) => entry.kind === "fee_eligible" && entry.milestoneId === milestoneId && entry.party === eligibleParty)
      .reduce((sum, entry) => sum + entry.amountCents, 0);
    const reversed = entries
      .filter((entry) => entry.kind === "reversal" && entry.milestoneId === milestoneId && entry.party === reversalParty)
      .reduce((sum, entry) => sum + entry.amountCents, 0);
    return Math.max(0, eligible - reversed);
  };
  return {
    businessCollaborationFeeCents: net("platform:business", "platform:business_eligible"),
    influencerFeeCents: net("platform:influencer", "platform:influencer_eligible"),
  };
}

function suspendMilestoneEligibility(
  fees: { businessCollaborationFeeCents: number; influencerFeeCents: number } | null | undefined,
  settled: boolean,
): { ok: true; entries: LedgerPosting[] } | { ok: false; error: string } {
  if (!fees) return { ok: true, entries: [] };
  if (
    !Number.isInteger(fees.businessCollaborationFeeCents) ||
    !Number.isInteger(fees.influencerFeeCents) ||
    fees.businessCollaborationFeeCents < 0 ||
    fees.influencerFeeCents < 0
  ) {
    return { ok: false, error: "The frozen milestone allocation does not reconcile." };
  }
  const entries: LedgerPosting[] = [];
  if (fees.businessCollaborationFeeCents > 0) {
    entries.push({
      kind: "reversal",
      party: "platform",
      side: "business_eligible",
      amountCents: fees.businessCollaborationFeeCents,
      reverses: "fee_eligible",
    });
  }
  if (fees.influencerFeeCents > 0) {
    entries.push({
      kind: "reversal",
      party: "platform",
      side: "influencer_eligible",
      amountCents: fees.influencerFeeCents,
      reverses: "fee_eligible",
    });
  }
  const open = fees.businessCollaborationFeeCents + fees.influencerFeeCents;
  if (settled && open > 0) {
    entries.push({
      kind: "reversal",
      party: "platform",
      side: "recovery",
      amountCents: open,
      reverses: "fee_settled",
    });
  }
  return { ok: true, entries };
}
