/**
 * Influrios Payment Standard v2 — domain core.
 * Influrios owns quotes, allocations, release authorization and accounting.
 * Gateways execute movements. All money fields are dollars with two decimals.
 */
import {
  addDollars,
  allocateDollarsByWeight,
  dollar,
  dollarsEqual,
  sumDollars,
  subDollars,
  type Dollar,
  zeroDollar,
} from "@/lib/payment-money";

export const PAYMENT_STANDARD_VERSION = "2.0" as const;

/** Primary logical roles. Influencers are beneficiaries, not a fourth merchant role. */
export const ACCOUNT_ROLES_V2 = ["SUBSCRIPTION", "COLLABORATION", "OPERATIONS", "TREASURY"] as const;
export type AccountRoleV2 = (typeof ACCOUNT_ROLES_V2)[number];

export const MOVEMENT_METHODS = [
  "direct_wallet",
  "through_platform",
  "direct_external_payout",
  "banking_bridge",
  "native_provider_split",
] as const;
export type MovementMethod = (typeof MOVEMENT_METHODS)[number];

export type CollaborationEconomics = {
  currency: string;
  /** Gross influencer compensation G */
  gross: Dollar;
  /** Business platform fee B */
  businessFee: Dollar;
  /** Influencer platform fee I */
  influencerFee: Dollar;
  /** Applicable tax on the business charge (may be 0.00) */
  tax: Dollar;
  /** Separately disclosed processor or other costs charged to the business */
  disclosedCosts: Dollar;
};

export type CollaborationTotals = CollaborationEconomics & {
  /** Business funds G + B (+ tax + disclosed) */
  businessFunds: Dollar;
  /** Influencer net G − I */
  influencerNet: Dollar;
  /** Operations fees B + I */
  operationsFees: Dollar;
};

export type MilestoneWeight = {
  name: string;
  /** Basis points; all weights must sum to 10_000 */
  weightBps: number;
};

export type MilestoneAllocation = {
  name: string;
  weightBps: number;
  influencerNet: Dollar;
  operationsFee: Dollar;
  reserved: Dollar;
};

export type ReleaseLegPurpose = "influencer" | "operations" | "tax" | "other";

export type ReleaseLegPlan = {
  purpose: ReleaseLegPurpose;
  amount: Dollar;
  beneficiaryRef: string;
  movementMethod: MovementMethod;
};

export type ReleaseAuthorizationPlan = {
  authorizationKey: string;
  agreementVersion: number;
  milestoneName: string;
  currency: string;
  legs: ReleaseLegPlan[];
  total: Dollar;
};

/** Acceptance fixture from Payment Standard v2 / Dev AI handoff. Test rates only. */
export const ACCEPTANCE_FIXTURE_USD = {
  label: "Acceptance fixture only. Not a production fee schedule.",
  currency: "USD",
  gross: dollar("4200.00"),
  businessFee: dollar("630.00"),
  influencerFee: dollar("630.00"),
  tax: dollar("0.00"),
  disclosedCosts: dollar("0.00"),
  milestones: [
    { name: "Kickoff", weightBps: 3400 },
    { name: "Draft delivery", weightBps: 3300 },
    { name: "Published work", weightBps: 3300 },
  ] satisfies MilestoneWeight[],
  expected: {
    businessFunds: dollar("4830.00"),
    influencerNet: dollar("3570.00"),
    operationsFees: dollar("1260.00"),
    rows: [
      {
        name: "Kickoff",
        influencerNet: dollar("1213.80"),
        operationsFee: dollar("428.40"),
        reserved: dollar("1642.20"),
      },
      {
        name: "Draft delivery",
        influencerNet: dollar("1178.10"),
        operationsFee: dollar("415.80"),
        reserved: dollar("1593.90"),
      },
      {
        name: "Published work",
        influencerNet: dollar("1178.10"),
        operationsFee: dollar("415.80"),
        reserved: dollar("1593.90"),
      },
    ],
    remainingAfter: [dollar("3187.80"), dollar("1593.90"), dollar("0.00")],
  },
} as const;

/** Subscription tax display fixture: $19.00 + 10% = $20.90 */
export const SUBSCRIPTION_TAX_FIXTURE_USD = {
  label: "Subscription tax fixture only.",
  currency: "USD",
  base: dollar("19.00"),
  taxRateBps: 1000,
  tax: dollar("1.90"),
  total: dollar("20.90"),
} as const;

export function collaborationTotals(input: CollaborationEconomics): CollaborationTotals {
  const influencerNet = subDollars(input.gross, input.influencerFee);
  if (influencerNet.startsWith("-")) {
    throw new Error("Influencer fee cannot exceed gross compensation.");
  }
  return {
    ...input,
    businessFunds: addDollars(input.gross, input.businessFee, input.tax, input.disclosedCosts),
    influencerNet,
    operationsFees: addDollars(input.businessFee, input.influencerFee),
  };
}

export function allocateCollaborationMilestones(
  economics: CollaborationEconomics,
  milestones: MilestoneWeight[],
): { ok: true; totals: CollaborationTotals; rows: MilestoneAllocation[] } | { ok: false; error: string } {
  let totals: CollaborationTotals;
  try {
    totals = collaborationTotals(economics);
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Invalid economics." };
  }
  const weights = milestones.map((row) => row.weightBps);
  const influencerParts = allocateDollarsByWeight(totals.influencerNet, weights);
  const operationsParts = allocateDollarsByWeight(totals.operationsFees, weights);
  if (!influencerParts || !operationsParts) {
    return { ok: false, error: "Milestone weights must add up to 100% before fees can be allocated." };
  }
  const rows: MilestoneAllocation[] = milestones.map((milestone, index) => {
    const influencerNet = influencerParts[index]!;
    const operationsFee = operationsParts[index]!;
    return {
      name: milestone.name,
      weightBps: milestone.weightBps,
      influencerNet,
      operationsFee,
      reserved: addDollars(influencerNet, operationsFee),
    };
  });
  if (!dollarsEqual(sumDollars(rows.map((row) => row.reserved)), totals.businessFunds) && dollarsEqual(economics.tax, zeroDollar()) && dollarsEqual(economics.disclosedCosts, zeroDollar())) {
    // Without tax/costs, reserved pool equals G+B = influencerNet + operationsFees.
    if (!dollarsEqual(sumDollars(rows.map((row) => row.influencerNet)), totals.influencerNet)) {
      return { ok: false, error: "Influencer allocations do not reconcile to net compensation." };
    }
    if (!dollarsEqual(sumDollars(rows.map((row) => row.operationsFee)), totals.operationsFees)) {
      return { ok: false, error: "Operations allocations do not reconcile to earned fees." };
    }
  }
  if (!dollarsEqual(sumDollars(rows.map((row) => row.influencerNet)), totals.influencerNet)) {
    return { ok: false, error: "Influencer allocations do not reconcile to net compensation." };
  }
  if (!dollarsEqual(sumDollars(rows.map((row) => row.operationsFee)), totals.operationsFees)) {
    return { ok: false, error: "Operations allocations do not reconcile to earned fees." };
  }
  return { ok: true, totals, rows };
}

/** Remaining Collaboration funding after each fully settled release batch (no tax/costs). */
export function remainingCampaignFunds(rows: MilestoneAllocation[]): Dollar[] {
  const total = sumDollars(rows.map((row) => row.reserved));
  let spent = zeroDollar();
  return rows.map((row) => {
    spent = addDollars(spent, row.reserved);
    return subDollars(total, spent);
  });
}

export function buildReleaseAuthorization(input: {
  agreementId: string;
  agreementVersion: number;
  milestoneName: string;
  currency: string;
  influencerNet: Dollar;
  operationsFee: Dollar;
  influencerBeneficiaryRef: string;
  operationsAccountRef: string;
  influencerMethod?: MovementMethod;
  operationsMethod?: MovementMethod;
}): ReleaseAuthorizationPlan {
  const legs: ReleaseLegPlan[] = [
    {
      purpose: "influencer",
      amount: input.influencerNet,
      beneficiaryRef: input.influencerBeneficiaryRef,
      movementMethod: input.influencerMethod ?? "direct_external_payout",
    },
    {
      purpose: "operations",
      amount: input.operationsFee,
      beneficiaryRef: input.operationsAccountRef,
      movementMethod: input.operationsMethod ?? "direct_wallet",
    },
  ];
  return {
    authorizationKey: `${input.agreementId}:v${input.agreementVersion}:${input.milestoneName}`,
    agreementVersion: input.agreementVersion,
    milestoneName: input.milestoneName,
    currency: input.currency,
    legs,
    total: addDollars(input.influencerNet, input.operationsFee),
  };
}

/**
 * Duplicate approval protection: one authorization key per agreement version + milestone.
 * A second plan with the same key is rejected.
 */
export function assertUniqueReleaseAuthorization(
  existingKeys: ReadonlySet<string>,
  plan: ReleaseAuthorizationPlan,
): { ok: true } | { ok: false; error: string } {
  if (existingKeys.has(plan.authorizationKey)) {
    return { ok: false, error: "Release authorization already exists for this milestone obligation." };
  }
  return { ok: true };
}

/** Apply tax once to a subscription base. Never double-add tax already included in total. */
export function subscriptionQuote(input: { base: Dollar; taxRateBps: number }): {
  base: Dollar;
  tax: Dollar;
  total: Dollar;
} {
  if (!Number.isInteger(input.taxRateBps) || input.taxRateBps < 0) {
    throw new Error("Tax rate must be a non-negative integer in basis points.");
  }
  if (input.taxRateBps > 10_000) {
    throw new Error("Tax rate cannot exceed 100%.");
  }
  const parts = allocateDollarsByWeight(input.base, [input.taxRateBps, 10_000 - input.taxRateBps]);
  if (!parts) {
    throw new Error("Unable to calculate subscription tax from the base amount.");
  }
  const taxAmount = parts[0]!;
  return {
    base: input.base,
    tax: taxAmount,
    total: addDollars(input.base, taxAmount),
  };
}

export function proveAcceptanceFixture(): {
  ok: boolean;
  checks: { id: string; ok: boolean; detail: string }[];
} {
  const allocated = allocateCollaborationMilestones(
    {
      currency: ACCEPTANCE_FIXTURE_USD.currency,
      gross: ACCEPTANCE_FIXTURE_USD.gross,
      businessFee: ACCEPTANCE_FIXTURE_USD.businessFee,
      influencerFee: ACCEPTANCE_FIXTURE_USD.influencerFee,
      tax: ACCEPTANCE_FIXTURE_USD.tax,
      disclosedCosts: ACCEPTANCE_FIXTURE_USD.disclosedCosts,
    },
    [...ACCEPTANCE_FIXTURE_USD.milestones],
  );
  const checks: { id: string; ok: boolean; detail: string }[] = [];
  if (!allocated.ok) {
    return { ok: false, checks: [{ id: "REL01", ok: false, detail: allocated.error }] };
  }
  const { totals, rows } = allocated;
  checks.push({
    id: "REL01-funds",
    ok: dollarsEqual(totals.businessFunds, ACCEPTANCE_FIXTURE_USD.expected.businessFunds),
    detail: `Business funds ${totals.businessFunds} vs ${ACCEPTANCE_FIXTURE_USD.expected.businessFunds}`,
  });
  checks.push({
    id: "REL01-net",
    ok: dollarsEqual(totals.influencerNet, ACCEPTANCE_FIXTURE_USD.expected.influencerNet),
    detail: `Influencer net ${totals.influencerNet} vs ${ACCEPTANCE_FIXTURE_USD.expected.influencerNet}`,
  });
  checks.push({
    id: "REL01-ops",
    ok: dollarsEqual(totals.operationsFees, ACCEPTANCE_FIXTURE_USD.expected.operationsFees),
    detail: `Operations ${totals.operationsFees} vs ${ACCEPTANCE_FIXTURE_USD.expected.operationsFees}`,
  });
  ACCEPTANCE_FIXTURE_USD.expected.rows.forEach((expected, index) => {
    const row = rows[index]!;
    checks.push({
      id: `REL01-m${index + 1}`,
      ok:
        dollarsEqual(row.influencerNet, expected.influencerNet) &&
        dollarsEqual(row.operationsFee, expected.operationsFee) &&
        dollarsEqual(row.reserved, expected.reserved),
      detail: `${row.name}: net ${row.influencerNet}/${expected.influencerNet}, ops ${row.operationsFee}/${expected.operationsFee}, reserved ${row.reserved}/${expected.reserved}`,
    });
  });
  const remaining = remainingCampaignFunds(rows);
  ACCEPTANCE_FIXTURE_USD.expected.remainingAfter.forEach((expected, index) => {
    checks.push({
      id: `REL01-rem${index + 1}`,
      ok: dollarsEqual(remaining[index]!, expected),
      detail: `Remaining after batch ${index + 1}: ${remaining[index]} vs ${expected}`,
    });
  });
  return { ok: checks.every((check) => check.ok), checks };
}
