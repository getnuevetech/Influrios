/**
 * Influrios payment standard v4.1.
 * Commercial math lives here. Provider confirmation still moves money.
 * Illustrative fixtures are tests and labels, never stored rates.
 */
import { allocateAgreementMilestones } from "@/lib/agreement-fee-engine";
import { buildRoleMapping } from "@/lib/payment-account-routing";

export const PAYMENT_SCREENS = [
  "B01",
  "B02",
  "B03",
  "B04",
  "W01",
  "W02",
  "I01",
  "I02",
  "V01",
  "S01",
  "A01",
  "A02",
  "A03",
  "R01",
  "M01",
  "M02",
  "E01",
] as const;

export type PaymentScreenId = (typeof PAYMENT_SCREENS)[number];

export const ACCOUNT_ROLES = ["SUBSCRIPTIONS", "COLLABORATION_FUNDS", "OPERATIONS", "RECIPIENT"] as const;
export type AccountRole = (typeof ACCOUNT_ROLES)[number];

export const TAX_TREATMENTS = [
  "taxable",
  "exempt",
  "non_taxable",
  "no_collection_obligation",
  "unresolved",
] as const;
export type TaxTreatment = (typeof TAX_TREATMENTS)[number];

export type AdapterResult<T> = { ok: true; value: T } | { ok: false; blocker: string };

export type MoneyLine = { label: string; amountCents: number; reason?: string };

/** Illustrative no-tax collaboration. Not a production fee schedule. */
export const ILLUSTRATIVE_NO_TAX = {
  label: "Illustrative fixture. Not a production rate.",
  currency: "USD",
  grossCents: 100_000,
  businessFeeCents: 4_000,
  influencerFeeCents: 2_500,
  activationCents: 0,
  weightsBps: [4_000, 6_000],
  milestoneNames: ["Kickoff", "Final delivery"],
} as const;

/** Illustrative subscription preview for S01 tests only. Not a collaboration tax rate. */
export const ILLUSTRATIVE_SUBSCRIPTION = {
  label: "Illustrative subscription fixture. Not a collaboration tax rate.",
  priceCents: 2_000,
  taxCents: 200,
  totalCents: 2_200,
} as const;

export function formatMinor(cents: number, currency: string) {
  const code = /^[A-Z]{3}$/.test(currency) ? currency : "USD";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: code,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

export function illustrativeAllocation() {
  const rows = allocateAgreementMilestones({
    grossCents: ILLUSTRATIVE_NO_TAX.grossCents,
    businessCollaborationFeeCents: ILLUSTRATIVE_NO_TAX.businessFeeCents,
    influencerFeeCents: ILLUSTRATIVE_NO_TAX.influencerFeeCents,
    weightsBps: [...ILLUSTRATIVE_NO_TAX.weightsBps],
  });
  if (!rows.ok) return rows;
  const businessPays = ILLUSTRATIVE_NO_TAX.grossCents + ILLUSTRATIVE_NO_TAX.businessFeeCents;
  return {
    ok: true as const,
    businessPaysCents: businessPays,
    rows: rows.rows.map((row, index) => ({
      name: ILLUSTRATIVE_NO_TAX.milestoneNames[index] ?? `Milestone ${index + 1}`,
      ...row,
      operationsFeeCents: row.businessCollaborationFeeCents + row.influencerFeeCents,
      fundedAllocationCents: row.grossCents + row.businessCollaborationFeeCents,
    })),
  };
}

type Supply = { treatment: TaxTreatment; rateBps: number | null; baseCents: number };

function supplyTax(supply: Supply, label: string): { ok: true; amountCents: number; reason: string } | { ok: false; error: string } {
  if (!Number.isInteger(supply.baseCents) || supply.baseCents < 0) {
    return { ok: false, error: `${label} base is not a valid amount.` };
  }
  if (supply.treatment === "unresolved") {
    return { ok: false, error: `${label} tax is unresolved. Checkout stays blocked.` };
  }
  if (supply.treatment === "taxable") {
    if (supply.rateBps == null || !Number.isInteger(supply.rateBps) || supply.rateBps < 0) {
      return { ok: false, error: `${label} is taxable and has no jurisdiction rate. That is not zero tax.` };
    }
    return {
      ok: true,
      amountCents: Math.round((supply.baseCents * supply.rateBps) / 10_000),
      reason: `Taxable at ${(supply.rateBps / 100).toFixed(2).replace(/\.?0+$/, "")}%.`,
    };
  }
  const reason =
    supply.treatment === "exempt"
      ? "Exempt with a recorded exemption."
      : supply.treatment === "non_taxable"
        ? "Non-taxable supply."
        : "No collection obligation for this supply.";
  return { ok: true, amountCents: 0, reason };
}

export function quoteExclusiveTax(input: {
  grossCents: number;
  businessFeeCents: number;
  influencerFeeCents: number;
  activationCents: number;
  withholdingCents?: number;
  treatments: { gross: TaxTreatment; businessFee: TaxTreatment; influencerFee: TaxTreatment; activation: TaxTreatment };
  ratesBps: { gross: number | null; businessFee: number | null; influencerFee: number | null; activation: number | null };
}) {
  const withholding = input.withholdingCents ?? 0;
  if (!Number.isInteger(withholding) || withholding < 0) return { ok: false as const, error: "Withholding must be zero or a positive minor amount." };
  const tg = supplyTax({ treatment: input.treatments.gross, rateBps: input.ratesBps.gross, baseCents: input.grossCents }, "Gross work");
  const tb = supplyTax({ treatment: input.treatments.businessFee, rateBps: input.ratesBps.businessFee, baseCents: input.businessFeeCents }, "Business fee");
  const ti = supplyTax({ treatment: input.treatments.influencerFee, rateBps: input.ratesBps.influencerFee, baseCents: input.influencerFeeCents }, "Influencer fee");
  const ta = supplyTax({ treatment: input.treatments.activation, rateBps: input.ratesBps.activation, baseCents: input.activationCents }, "Activation");
  if (!tg.ok) return tg;
  if (!tb.ok) return tb;
  if (!ti.ok) return ti;
  if (!ta.ok) return ta;
  const businessPaysCents = input.grossCents + input.businessFeeCents + input.activationCents + tg.amountCents + tb.amountCents + ta.amountCents;
  const influencerNetCents = input.grossCents - input.influencerFeeCents - ti.amountCents - withholding;
  if (influencerNetCents < 0) return { ok: false as const, error: "Influencer fee tax makes a net allocation negative. Revise the quote." };
  const platformFeesCents = input.activationCents + input.businessFeeCents + input.influencerFeeCents;
  const taxLiabilityCents = tg.amountCents + tb.amountCents + ta.amountCents + ti.amountCents;
  if (businessPaysCents !== influencerNetCents + platformFeesCents + taxLiabilityCents + withholding) {
    return { ok: false as const, error: "The tax quote does not balance." };
  }
  return {
    ok: true as const,
    businessPaysCents,
    influencerNetCents,
    platformFeesCents,
    taxLiabilityCents,
    withholdingCents: withholding,
    lines: [
      { label: "Tax on gross work", amountCents: tg.amountCents, reason: tg.reason },
      { label: "Tax on business collaboration fee", amountCents: tb.amountCents, reason: tb.reason },
      { label: "Tax on influencer fee", amountCents: ti.amountCents, reason: ti.reason },
      { label: "Tax on activation", amountCents: ta.amountCents, reason: ta.reason },
    ],
  };
}

export function fundingEvidenceAccepts(input: {
  redirectSucceeded: boolean;
  providerAccountMatches: boolean;
  environmentMatches: boolean;
  amountMatches: boolean;
  currencyMatches: boolean;
  referenceMatches: boolean;
  allocationAvailable: boolean;
}) {
  if (input.redirectSucceeded && !input.providerAccountMatches) {
    return { funded: false as const, state: "unknown" as const, reason: "A success redirect is not funding evidence." };
  }
  const confirmed =
    input.providerAccountMatches &&
    input.environmentMatches &&
    input.amountMatches &&
    input.currencyMatches &&
    input.referenceMatches;
  if (!confirmed) return { funded: false as const, state: "unknown" as const, reason: "The provider resource does not match this instruction." };
  if (!input.allocationAvailable) {
    return { funded: false as const, state: "allocated_pending" as const, reason: "Payment received. Allocation is still pending." };
  }
  return { funded: true as const, state: "allocated_available" as const, reason: "Funding confirmed." };
}

export function planCoupledSettlement(input: {
  grossCents: number;
  businessFeeCents: number;
  influencerFeeCents: number;
  alreadySettled: boolean;
  transferConfirmed: boolean;
  existingTransferRef: string;
  payoutState: "queued" | "pending" | "in_transit" | "paid" | "failed" | "returned" | "unknown";
}) {
  if (input.alreadySettled && input.payoutState === "paid") {
    return { ok: false as const, error: "This milestone settlement is already complete." };
  }
  const net = input.grossCents - input.influencerFeeCents;
  const fees = input.businessFeeCents + input.influencerFeeCents;
  if (net < 0 || input.grossCents < 0 || input.businessFeeCents < 0 || input.influencerFeeCents < 0) {
    return { ok: false as const, error: "Settlement amounts must stay non-negative." };
  }
  if ((input.payoutState === "failed" || input.payoutState === "returned") && input.transferConfirmed) {
    return {
      ok: true as const,
      createTransfer: false,
      retryPayoutOnly: true,
      restrictOperationsFee: true,
      influencerNetCents: net,
      operationsFeeCents: fees,
      transferRef: input.existingTransferRef,
      label: "Payout needs attention. The fee already moved stays restricted. No second transfer.",
    };
  }
  if (input.payoutState === "unknown") {
    return { ok: false as const, error: "The payout result is unknown. Query it before another attempt." };
  }
  return {
    ok: true as const,
    createTransfer: !input.transferConfirmed,
    retryPayoutOnly: false,
    restrictOperationsFee: false,
    influencerNetCents: net,
    operationsFeeCents: fees,
    transferRef: input.existingTransferRef,
    label: "Settlement starts the influencer release and the fee release together. It does not mark the payout paid.",
  };
}

export function refundAfterPartialSettlement(input: {
  collectedCents: number;
  settledInfluencerNetCents: number;
  settledOperationsFeeCents: number;
  retainedActivationCents: number;
  proposedRefundCents: number;
}) {
  const amounts = [
    input.collectedCents,
    input.settledInfluencerNetCents,
    input.settledOperationsFeeCents,
    input.retainedActivationCents,
    input.proposedRefundCents,
  ];
  if (amounts.some((amount) => !Number.isInteger(amount) || amount < 0)) {
    return { ok: false as const, error: "Refund amounts must be zero or positive minor units." };
  }
  const refundCents = input.collectedCents - input.settledInfluencerNetCents - input.settledOperationsFeeCents - input.retainedActivationCents;
  if (refundCents < 0) return { ok: false as const, error: "Settled amounts are larger than the collection." };
  const remainingNetOnly = input.proposedRefundCents === input.collectedCents - input.settledInfluencerNetCents - input.settledOperationsFeeCents - input.retainedActivationCents
    ? null
    : input.proposedRefundCents;
  if (remainingNetOnly != null && remainingNetOnly !== refundCents) {
    return {
      ok: false as const,
      error: "Refund the unfinished funded amount, including the unused business fee and influencer fee. Do not refund only the remaining influencer net.",
    };
  }
  if (input.settledInfluencerNetCents + input.settledOperationsFeeCents + input.retainedActivationCents + refundCents !== input.collectedCents) {
    return { ok: false as const, error: "The refund does not conserve the collection." };
  }
  return {
    ok: true as const,
    refundCents,
    lines: [
      { label: "Influencer already paid", amountCents: input.settledInfluencerNetCents },
      { label: "Fees already released", amountCents: input.settledOperationsFeeCents },
      { label: "Activation retained", amountCents: input.retainedActivationCents },
      { label: "Refund to business", amountCents: refundCents },
    ],
  };
}

export type VerificationCheck = {
  key: string;
  label: string;
  owner: string;
  status: "not_started" | "in_progress" | "in_review" | "action_required" | "verified" | "restricted";
  applies: boolean;
};

export function verificationTasks(input: {
  role: "paying_business" | "receiving_influencer" | "subscriber" | "business_recipient";
  emailVerified: boolean;
  individualVerified: boolean;
  entityStatus: VerificationCheck["status"];
  authorityStatus: VerificationCheck["status"];
  taxStatus: VerificationCheck["status"];
  connectStatus: VerificationCheck["status"];
  bankStatus: VerificationCheck["status"];
  connectReturnSeen: boolean;
}) {
  const connect = input.connectReturnSeen && input.connectStatus !== "verified" ? "action_required" : input.connectStatus;
  const tasks: VerificationCheck[] = [
    { key: "email", label: "Email", owner: "Account owner", status: input.emailVerified ? "verified" : "action_required", applies: true },
    {
      key: "individual_identity",
      label: "Individual identity",
      owner: "Authorized person",
      status: input.individualVerified ? "verified" : "not_started",
      applies: input.role !== "subscriber" || true,
    },
    {
      key: "entity",
      label: "Business entity",
      owner: "Influrios review",
      status: input.entityStatus,
      applies: input.role === "paying_business" || input.role === "business_recipient",
    },
    {
      key: "authority",
      label: "Authority to act",
      owner: "Influrios review",
      status: input.authorityStatus,
      applies: input.role === "paying_business" || input.role === "business_recipient",
    },
    { key: "tax_information", label: "Tax information", owner: "Account owner", status: input.taxStatus, applies: true },
    {
      key: "connect",
      label: "Payout account",
      owner: "Influencer",
      status: connect,
      applies: input.role === "receiving_influencer" || input.role === "business_recipient",
    },
    {
      key: "bank",
      label: "Bank destination",
      owner: "Influencer",
      status: input.bankStatus,
      applies: input.role === "receiving_influencer" || input.role === "business_recipient",
    },
  ];
  return tasks.filter((task) => task.applies);
}

export function fundingBlockedByVerification(tasks: VerificationCheck[], role: "paying_business" | "receiving_influencer") {
  const relevant = tasks.filter((task) =>
    role === "paying_business" ? ["individual_identity", "entity", "authority"].includes(task.key) : ["connect", "bank"].includes(task.key),
  );
  const blocked = relevant.find((task) => task.status !== "verified");
  if (!blocked) return null;
  if (role === "receiving_influencer") return "Funding is paused while the influencer completes payout setup.";
  return "Complete business verification before funding.";
}

export function buyerIdentityIsNotKyb(input: { individualVerified: boolean; entityVerified: boolean }) {
  if (input.individualVerified && !input.entityVerified) {
    return { ok: false as const, error: "An individual identity check does not verify the business." };
  }
  return { ok: true as const };
}

export function countryConflict(input: { agreementCountry: string; evidenceCountry: string }) {
  const left = input.agreementCountry.trim().toUpperCase();
  const right = input.evidenceCountry.trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(left) || !/^[A-Z]{2}$/.test(right)) {
    return { ok: false as const, error: "Country evidence is missing. A dropdown or bank country is not enough." };
  }
  if (left !== right) return { ok: false as const, error: "The verified country does not match this agreement." };
  return { ok: true as const, country: left };
}

export type StripeRoleMapping = {
  role: AccountRole;
  owner: string;
  providerAccount: string;
  externalAccountId: string;
  financialAccountId: string;
  environment: "sandbox" | "live";
  verified: boolean;
  capabilities: string[];
  operations: string[];
};

/**
 * Validator input for a US Stripe route. A true result only means the flags allow a later call.
 * It does not submit anything to Stripe. Provider submission requires an object id from Stripe.
 */
export function stripeUsRoleMapping(input: {
  environment: "sandbox" | "live";
  allocatedFundsApproved: boolean;
  accounts?: Partial<
    Record<AccountRole, { externalAccountId: string; financialAccountId?: string; owner: string; capabilities: string[] }>
  >;
}): StripeRoleMapping[] {
  // The boolean is not retrieved capability evidence, so collection stays blocked.
  void input.allocatedFundsApproved;
  return buildRoleMapping({
    environment: input.environment,
    accounts: input.accounts,
    collaborationReady: false,
  });
}

const STRIPE_US_METHODS = [
  "capabilities",
  "createCollection",
  "queryCollection",
  "inspectAllocation",
  "releaseSettlement",
  "querySettlement",
  "createPayout",
  "queryPayout",
  "refund",
  "reverseTransfer",
  "verifyWebhook",
  "reconcile",
] as const;

/** Route-flag validator. Success means the call is allowed to be attempted. It is not a provider submission. */
export function validateStripeUsRoute(input: {
  method: string;
  allocatedFundsApproved: boolean;
  bankPayoutControl: boolean;
  methodAllowed: "card" | "ach" | "unknown";
  webhookSignatureValid?: boolean;
}): AdapterResult<{ method: string; simulated: false; submitted: false }> {
  if (!STRIPE_US_METHODS.includes(input.method as (typeof STRIPE_US_METHODS)[number])) {
    return { ok: false, blocker: "That provider method is not part of the US Stripe route." };
  }
  if (input.method === "verifyWebhook" && input.webhookSignatureValid === false) {
    return { ok: false, blocker: "The webhook signature did not match." };
  }
  if (input.methodAllowed === "ach") {
    return { ok: false, blocker: "ACH is not approved for this route. Card support does not imply ACH." };
  }
  const needsAllocation = ["createCollection", "inspectAllocation", "releaseSettlement", "createPayout"].includes(input.method);
  if (needsAllocation && !input.allocatedFundsApproved) {
    return { ok: false, blocker: "Provider approval required." };
  }
  if (input.method === "createPayout" && !input.bankPayoutControl) {
    return { ok: false, blocker: "Bank payout control is not approved. A competing automatic schedule stays off." };
  }
  return { ok: true, value: { method: input.method, simulated: false, submitted: false } };
}

export function stripeUsInvoke(input: Parameters<typeof validateStripeUsRoute>[0]) {
  return validateStripeUsRoute(input);
}

export type JournalLine = { account: string; direction: "debit" | "credit"; amountCents: number; currency: string };

export function journalBalances(lines: JournalLine[]) {
  const totals = new Map<string, { debit: number; credit: number }>();
  for (const line of lines) {
    if (!Number.isInteger(line.amountCents) || line.amountCents < 0) return { ok: false as const, error: "Journal amounts must be zero or positive minor units." };
    const key = line.currency;
    const row = totals.get(key) ?? { debit: 0, credit: 0 };
    if (line.direction === "debit") row.debit += line.amountCents;
    else row.credit += line.amountCents;
    totals.set(key, row);
  }
  for (const [currency, row] of totals) {
    if (row.debit !== row.credit) return { ok: false as const, error: `${currency} journal is not balanced.` };
  }
  return { ok: true as const };
}

export function confirmedCollectionJournal(input: { currency: string; amountCents: number; eventKey: string }): JournalLine[] {
  return [
    { account: "provider_allocated_cash", direction: "debit", amountCents: input.amountCents, currency: input.currency },
    { account: "refundable_business", direction: "credit", amountCents: input.amountCents, currency: input.currency },
  ];
}

export function buttonClickMovesMoney() {
  return false;
}

export function feeRuleEnablesFunding() {
  return false;
}

export function rejectSplitOrLegacyShare(purpose: string) {
  const value = purpose.trim().toLowerCase();
  if (value === "legacy" || value === "revenue_share" || value === "split" || value === "80/20") {
    return { ok: false as const, error: "No 80/20 allocation and no split payer. Resolve one business rule and one influencer rule." };
  }
  return { ok: true as const };
}

export function changedPayableNeedsConsent(input: { signedPayableCents: number; nextPayableCents: number; consented: boolean }) {
  if (input.signedPayableCents === input.nextPayableCents) return { ok: true as const };
  if (!input.consented) return { ok: false as const, error: "The payable total changed. Confirm the revised breakdown before funding." };
  return { ok: true as const };
}

export function sameIdempotency<T extends { idempotencyKey: string }>(existing: T | null, next: T) {
  if (existing && existing.idempotencyKey === next.idempotencyKey) return existing;
  return next;
}

export type PaymentStatusLabel =
  | "Needs funding"
  | "Checking payment status"
  | "Funding confirmation pending"
  | "Funded"
  | "Payout processing"
  | "Payout confirmed"
  | "Payout returned"
  | "Refund processing"
  | "Refunded"
  | "Needs attention";

export function customerPaymentLabel(input: {
  collection: "created" | "requires_action" | "processing" | "succeeded" | "failed" | "unknown";
  funds: "unconfirmed" | "allocated_pending" | "allocated_available" | "reserved" | "exhausted" | "reconciliation_required";
  payout: "none" | "queued" | "pending" | "in_transit" | "paid" | "failed" | "returned" | "unknown";
  refund: "none" | "processing" | "confirmed" | "failed" | "unknown";
}): PaymentStatusLabel {
  if (input.refund === "confirmed") return "Refunded";
  if (input.refund === "processing" || input.refund === "unknown") return "Refund processing";
  if (input.payout === "paid") return "Payout confirmed";
  if (input.payout === "returned" || input.payout === "failed") return "Payout returned";
  if (input.payout === "pending" || input.payout === "in_transit") return "Payout processing";
  if (input.collection === "processing" || input.collection === "unknown" || input.collection === "requires_action") {
    return "Checking payment status";
  }
  if (input.funds === "allocated_pending") return "Funding confirmation pending";
  if (input.funds === "allocated_available" || input.funds === "reserved") return "Funded";
  if (input.collection === "failed" || input.funds === "reconciliation_required") return "Needs attention";
  return "Needs funding";
}

export function paymentStatusEmail(input: { event: "funding_confirmed" | "payout_confirmed" | "payout_failed" | "refund_update" | "release_started"; reference: string }) {
  const paid = input.event === "payout_confirmed";
  const body =
    input.event === "payout_confirmed"
      ? "Your bank payout is confirmed."
      : input.event === "payout_failed"
        ? "Your bank returned this payout. Review payout details. The net remains owed."
        : input.event === "funding_confirmed"
          ? "Funding is confirmed. This does not mean the influencer has been paid."
          : input.event === "release_started"
            ? "Settlement started. Bank receipt is separate."
            : "A refund update is available. Refunded is shown only after the provider confirms it.";
  return {
    subject: paid ? "Payout confirmed" : "Payment update",
    body,
    reference: input.reference,
    includesFullBankDetails: false,
    authorizesRelease: false,
    saysPaid: paid,
  };
}

export function businessOverviewTotals(input: {
  discloseCounterpartyFees: boolean;
  collectedCents: number;
  remainingCents: number;
  businessFeeCents: number;
  taxCents: number;
  influencerPaidCents: number;
  feesReleasedCents: number;
}) {
  const base = [
    { label: "Collected", amountCents: input.collectedCents },
    { label: "Remaining", amountCents: input.remainingCents },
    { label: "Your collaboration fee", amountCents: input.businessFeeCents },
    { label: "Tax", amountCents: input.taxCents },
  ];
  if (!input.discloseCounterpartyFees) return base;
  return [
    ...base,
    { label: "Influencer paid", amountCents: input.influencerPaidCents },
    { label: "Fees released", amountCents: input.feesReleasedCents },
  ];
}

export function primaryPaymentAction(input: {
  signed: boolean;
  funded: boolean;
  submissionReady: boolean;
  payoutProcessing: boolean;
  payoutProblem: boolean;
  cancellationOpen: boolean;
  completed: boolean;
}) {
  if (!input.signed) return { label: "Review and sign", money: false };
  if (!input.funded) return { label: "Fund collaboration", money: false };
  if (input.cancellationOpen) return { label: "View cancellation case", money: false };
  if (input.payoutProblem) return { label: "View issue", money: false };
  if (input.payoutProcessing) return { label: "View payout status", money: false };
  if (input.submissionReady) return { label: "Review submission", money: false };
  if (input.completed) return { label: "View receipt", money: false };
  return { label: "Open collaboration", money: false };
}

export function approvalCopy(input: { amountCents: number; currency: string; versionLabel: string; milestoneName: string }) {
  return {
    button: `Approve and release ${formatMinor(input.amountCents, input.currency)}`,
    note: "This starts settlement and does not charge the business again.",
    acknowledgement: `I approve version ${input.versionLabel} of ${input.milestoneName}.`,
  };
}

export function routeReadiness(input: {
  domesticRule: boolean;
  currency: boolean;
  cardMethod: boolean;
  holdingEvidence: boolean;
  payoutMethod: boolean;
  refundSupport: boolean;
  bankPayoutControl: boolean;
  verificationWorkflow: boolean;
  taxOwner: boolean;
  productionApproval: boolean;
  allocatedFundsApproved: boolean;
}) {
  const checks = [
    ["Domestic country rule", input.domesticRule],
    ["Currency", input.currency],
    ["Card collection", input.cardMethod],
    ["Holding evidence", input.holdingEvidence],
    ["Payout method", input.payoutMethod],
    ["Refund and reversal", input.refundSupport],
    ["Bank payout control", input.bankPayoutControl],
    ["Verification workflow", input.verificationWorkflow],
    ["Tax owner", input.taxOwner],
    ["Production approval", input.productionApproval],
  ] as const;
  return {
    checks: checks.map(([label, ready]) => ({ label, ready })),
    fundingBlocked: !input.allocatedFundsApproved || checks.some(([, ready]) => !ready),
    blocker: input.allocatedFundsApproved ? null : "Provider approval required",
  };
}

export function subscriptionPreview(input: {
  priceCents: number;
  treatment: TaxTreatment;
  rateBps: number | null;
  addressReady: boolean;
  consented: boolean;
  /** local uses the recorded treatment. not_called is not a failure and is not zero. */
  provider?: "local" | "unavailable" | "not_called";
}) {
  if (input.provider === "not_called") {
    return {
      ok: true as const,
      kind: "not_calculated" as const,
      error: null,
      taxCents: null,
      totalCents: null,
      reason: "Tax calculated at checkout",
      canSubmit: false,
    };
  }
  if (input.provider === "unavailable") {
    return {
      ok: false as const,
      kind: "provider_unavailable" as const,
      error: "We couldn't calculate tax. Nothing was charged.",
      totalCents: null,
    };
  }
  if (!input.addressReady) {
    return {
      ok: false as const,
      kind: "address_needed" as const,
      error: "Add your billing address to calculate tax.",
      totalCents: null,
    };
  }
  if (input.treatment === "unresolved") {
    return {
      ok: false as const,
      kind: "configuration_missing" as const,
      error: "This plan is temporarily unavailable.",
      missing: "Tax treatment",
      totalCents: null,
    };
  }
  const tax = supplyTax({ treatment: input.treatment, rateBps: input.rateBps, baseCents: input.priceCents }, "Subscription");
  if (!tax.ok) return { ok: false as const, kind: "calculation_failed" as const, error: tax.error, totalCents: null };
  return {
    ok: true as const,
    kind: "calculated" as const,
    priceCents: input.priceCents,
    taxCents: tax.amountCents,
    reason: tax.reason,
    totalCents: input.priceCents + tax.amountCents,
    canSubmit: input.consented,
  };
}

export function fundingInDateRange(updatedAt: Date | null | undefined, from: string, to: string) {
  const start = /^\d{4}-\d{2}-\d{2}$/.test(from) ? from : "";
  const end = /^\d{4}-\d{2}-\d{2}$/.test(to) ? to : "";
  if (!start && !end) return true;
  if (!updatedAt || Number.isNaN(updatedAt.getTime())) return false;
  const day = updatedAt.toISOString().slice(0, 10);
  if (start && day < start) return false;
  if (end && day > end) return false;
  return true;
}

export function emptyPaymentsCopy(hasFilters: boolean) {
  if (hasFilters) return { title: "No matches", action: "Clear filters" };
  return { title: "No collaboration payments yet.", action: "Open contracts" };
}

export function exceptionCopy(kind: "loading" | "verification" | "tax" | "processing" | "funded" | "release_blocked" | "payout_processing" | "payout_returned" | "refund_processing" | "forbidden") {
  const copy = {
    loading: "Loading payment details. Money actions stay off until this finishes.",
    verification: "Complete business verification before funding.",
    tax: "We could not calculate tax. Check billing details.",
    processing: "Checking payment confirmation.",
    funded: "Funding confirmed. The influencer has not been paid yet.",
    release_blocked: "Work approved. Payout needs attention.",
    payout_processing: "Payment is on its way.",
    payout_returned: "Your bank returned this payout. Review payout details. The net remains owed.",
    refund_processing: "Refund submitted. Awaiting confirmation.",
    forbidden: "You do not have access to this payment.",
  } as const;
  return copy[kind];
}
