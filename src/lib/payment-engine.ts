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
  amountInputMode: "gross_influencer_compensation";
  currency: string;
  minorDigits: number;
  grossInfluencerCompensationCents: number;
  businessPlatformFeeCents: number;
  influencerPlatformFeeCents: number;
  businessTaxCents: number;
  influencerTaxCents: number;
  withholdingCents: number;
  businessPaysCents: number;
  influencerReceivesCents: number;
  platformFeesTotalCents: number;
  businessRuleId: string;
  businessRuleVersion: number;
  influencerRuleId: string;
  influencerRuleVersion: number;
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
};

export type LedgerPosting = {
  kind:
    | "collection"
    | "hold"
    | "influencer_payable"
    | "fee_pending"
    | "fee_earned"
    | "tax"
    | "release"
    | "payout"
    | "return"
    | "refund"
    | "reversal";
  party: "business" | "influencer" | "platform" | "tax";
  side?: "business" | "influencer";
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
): { currency: string; businessPaysCents: number; influencerReceivesCents: number; platformFeesTotalCents: number } | { error: string } | null {
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
  return {
    currency,
    businessPaysCents: Number(businessPaysCents),
    influencerReceivesCents: Number(influencerReceivesCents),
    platformFeesTotalCents: Number(platformFeesTotalCents),
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
}): { ok: true } | { ok: false; error: string } {
  const business = input.businessCountry.trim().toUpperCase();
  const influencer = input.influencerCountry.trim().toUpperCase();
  const deal = input.dealCountry.trim().toUpperCase();
  if (!input.businessVerified) return { ok: false, error: "The business funding country is not verified." };
  if (!input.influencerVerified) return { ok: false, error: "The influencer payout country is not verified." };
  if (!business || !influencer || !deal) return { ok: false, error: "The deal country is incomplete." };
  if (business !== influencer || business !== deal) {
    return { ok: false, error: "Cross-border funding is not part of this route." };
  }
  if (!input.routeActive) return { ok: false, error: "The country route is not approved." };
  if (input.currency.trim().toUpperCase() !== input.routeCurrency.trim().toUpperCase()) {
    return { ok: false, error: "The deal currency does not match the route." };
  }
  if (!input.payoutMethod.trim()) return { ok: false, error: "Choose a payout method." };
  return { ok: true };
}

export function launchMilestoneGate(count: number): { ok: true } | { ok: false; error: string } {
  if (count === 1) return { ok: true };
  return { ok: false, error: "This route allows one milestone. Nothing was signed." };
}

export function buildSignedCommercialSnapshot(input: {
  quote: Extract<DualPlatformQuote, { ok: true }>;
  currency: string;
  minorDigits: number;
  agreementVersion?: number;
  tax?: TaxDetermination;
  milestoneCount: number;
  quotedAt?: Date;
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
  return {
    agreementVersion: input.agreementVersion ?? 1,
    amountInputMode: "gross_influencer_compensation",
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
    validUntil: new Date(quotedAt.getTime() + QUOTE_VALID_MS).toISOString(),
    feeState: "reserved",
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
    return "A revised agreement is required. The signed amounts were not changed.";
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
  if (input.currency.trim().toUpperCase() !== input.expectedCurrency.trim().toUpperCase()) {
    return { advance: false, reason: "The provider currency does not match the deal." };
  }
  if (input.amountCents !== input.expectedAmountCents) return { advance: false, reason: "The provider amount does not match the deal." };
  if (input.accountId !== input.expectedAccountId) return { advance: false, reason: "The provider account does not match the route." };
  if (input.environment !== input.expectedEnvironment) return { advance: false, reason: "The provider environment does not match the route." };
  if (input.eventName === "payment_intent.succeeded" && !input.holdingAvailable) {
    return {
      advance: false,
      reason: "Collection succeeded without evidence that funds are available for release. Work stays blocked.",
    };
  }
  if (input.eventName === "funds_split.released" && !input.beneficiaryConfirmed) {
    return { advance: false, reason: "A split credit is not a confirmed beneficiary payout. Paid stays blocked." };
  }
  return { advance: true };
}

export function airwallexLedgerAdvance(body: string, expected?: {
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
  const accountId = typeof parsed.account_id === "string" ? parsed.account_id : String(metadata.accountId ?? "");
  const environment = typeof parsed.environment === "string" ? parsed.environment : String(metadata.environment ?? "");
  if (!expected) {
    return providerEventMayAdvance({
      eventName: name,
      holdingAvailable,
      beneficiaryConfirmed,
      amountCents: Number.isInteger(amountCents) ? amountCents : -1,
      expectedAmountCents: Number.isInteger(amountCents) ? amountCents : -1,
      currency: currency || "USD",
      expectedCurrency: currency || "USD",
      accountId: accountId || "unscoped",
      expectedAccountId: accountId || "unscoped",
      environment: environment || "unscoped",
      expectedEnvironment: environment || "unscoped",
      fundingId: fundingId || "unscoped",
      expectedFundingId: fundingId || "unscoped",
      duplicate: false,
    });
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
    { kind: "fee_pending", party: "platform", side: "influencer", amountCents: snapshot.influencerPlatformFeeCents },
    { kind: "influencer_payable", party: "influencer", amountCents: snapshot.influencerReceivesCents },
  ];
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
