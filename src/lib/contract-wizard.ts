/**
 * Collab OS P3 — Contract & milestone wizard.
 * Pure gates + financial plan snapshot; funding still goes through marketplace-ledger.
 */
import { splitGross } from "@/lib/ledger";

export const CONTRACT_WIZARD_STEPS = [
  "parties",
  "scope",
  "commercial",
  "milestones",
  "payment_readiness",
  "preview",
  "accept",
  "funding",
] as const;

export type ContractWizardStep = (typeof CONTRACT_WIZARD_STEPS)[number];

export type MilestoneDraft = {
  title: string;
  shareBps: number;
};

export type FinancialPlanMilestone = MilestoneDraft & {
  grossCents: number;
  creatorCents: number;
  platformFeeCents: number;
  /** W3.10 — when usage rights activate (default: on payment release). */
  rightsActivateOn?: "release" | "acceptance" | "custom";
};

export type CollaborationFinancialPlan = {
  contractCurrency: string;
  grossContractValueCents: number;
  feeRuleId: string | null;
  feeRuleVersion: number | null;
  feeMethod: string | null;
  feePercentBps: number | null;
  feeFixedCents: number | null;
  totalPlatformFeeCents: number;
  totalCreatorCompensationCents: number;
  feePayer: string;
  fundingCountry: string;
  creatorCountry: string;
  payoutCurrency: string;
  providerRouteVersion: string;
  roundingPolicy: "last_milestone_absorbs";
  contractVersion: number;
  createdAt: string;
  lockedAt: string | null;
  /** Default rights activation rule for the deal (Product §13). */
  rightsActivateOn: "release" | "acceptance" | "custom";
  milestones: FinancialPlanMilestone[];
  milestoneSource: "template" | "custom";
};

export type PreContractGateInput = {
  businessName: string;
  creatorSlug: string;
  identityVerified: boolean;
  creatorCountryKnown: boolean;
  /** Country Activation Corridor is active for the influencer country (P5). */
  corridorActive: boolean;
  paymentRouteReady: boolean;
  jurisdictionProtectedPayments: boolean;
  marketplaceProviderReady: boolean;
};

export type RouteReadyStatus = "ROUTE_READY" | "ROUTE_BLOCKED";

const MAX_CUSTOM_MILESTONES = 8;
const MIN_SHARE_BPS = 500; // 5%
const MAX_SHARE_BPS = 9_000; // 90%

export function isContractWizardStep(value: string): value is ContractWizardStep {
  return (CONTRACT_WIZARD_STEPS as readonly string[]).includes(value);
}

export function nextContractStep(step: ContractWizardStep): ContractWizardStep | null {
  const index = CONTRACT_WIZARD_STEPS.indexOf(step);
  if (index < 0 || index >= CONTRACT_WIZARD_STEPS.length - 1) return null;
  return CONTRACT_WIZARD_STEPS[index + 1];
}

export function previousContractStep(step: ContractWizardStep): ContractWizardStep | null {
  const index = CONTRACT_WIZARD_STEPS.indexOf(step);
  if (index <= 0) return null;
  return CONTRACT_WIZARD_STEPS[index - 1];
}

/** Percentages must sum to exactly 10000 bps; each share stays within admin-style bounds. */
export function validateMilestoneShares(
  milestones: MilestoneDraft[],
): { ok: true } | { ok: false; error: string } {
  if (!Array.isArray(milestones) || milestones.length === 0) {
    return { ok: false, error: "Add at least one milestone." };
  }
  if (milestones.length > MAX_CUSTOM_MILESTONES) {
    return { ok: false, error: `At most ${MAX_CUSTOM_MILESTONES} milestones are allowed.` };
  }
  for (const row of milestones) {
    const title = row.title.trim();
    if (!title) return { ok: false, error: "Every milestone needs a title." };
    if (!Number.isInteger(row.shareBps) || row.shareBps < MIN_SHARE_BPS || row.shareBps > MAX_SHARE_BPS) {
      return { ok: false, error: "Each milestone share must be between 5% and 90%." };
    }
  }
  const total = milestones.reduce((sum, row) => sum + row.shareBps, 0);
  if (total !== 10_000) {
    return { ok: false, error: "Milestone shares must add up to 100%." };
  }
  return { ok: true };
}

/**
 * Custom schedules need plan entitlement, 100% validation, and influencer accept.
 * Standard templates skip the accept flag.
 */
export function customMilestonesGate(input: {
  entitled: boolean;
  usingCustom: boolean;
  milestones: MilestoneDraft[];
  influencerAccepted: boolean;
}): { ok: true } | { ok: false; error: string } {
  if (!input.usingCustom) {
    const check = validateMilestoneShares(input.milestones);
    return check;
  }
  if (!input.entitled) {
    return { ok: false, error: "Custom milestones require Business Pro or Agency." };
  }
  const check = validateMilestoneShares(input.milestones);
  if (!check.ok) return check;
  if (!input.influencerAccepted) {
    return { ok: false, error: "The influencer must accept the custom milestone schedule before funding." };
  }
  return { ok: true };
}

/** Pre-contract gates: identity, payout country, payment route, protected payments provider. */
export function evaluatePreContractGates(input: PreContractGateInput): {
  ok: boolean;
  status: RouteReadyStatus;
  blockers: string[];
} {
  const blockers: string[] = [];
  if (!input.businessName.trim()) blockers.push("Business party is missing.");
  if (!input.creatorSlug.trim()) blockers.push("Influencer party is missing.");
  if (!input.identityVerified) blockers.push("Influencer identity is not verified.");
  if (!input.creatorCountryKnown) blockers.push("Influencer payout country is unknown.");
  if (!input.corridorActive) blockers.push("Country corridor is not activated.");
  if (!input.paymentRouteReady) blockers.push("No ready payment route for the influencer country.");
  if (!input.jurisdictionProtectedPayments) blockers.push("Protected payments are off for this jurisdiction.");
  if (!input.marketplaceProviderReady) blockers.push("The marketplace provider is not ready.");
  const ok = blockers.length === 0;
  return { ok, status: ok ? "ROUTE_READY" : "ROUTE_BLOCKED", blockers };
}

export function canFundContract(input: {
  gates: ReturnType<typeof evaluatePreContractGates>;
  milestones: ReturnType<typeof customMilestonesGate>;
  accepted: boolean;
}): { ok: true } | { ok: false; error: string } {
  if (!input.gates.ok) {
    return { ok: false, error: input.gates.blockers[0] ?? "Payment readiness gates are not met." };
  }
  if (!input.milestones.ok) return input.milestones;
  if (!input.accepted) {
    return { ok: false, error: "Both parties must accept the contract preview before funding." };
  }
  return { ok: true };
}

/** Build an immutable financial plan. Lock with lockedAt when parties accept. */
export function buildFinancialPlan(input: {
  grossCents: number;
  currency?: string;
  feeRuleId?: string | null;
  feeRuleVersion?: number | null;
  feeMethod?: string | null;
  feePercentBps?: number | null;
  feeFixedCents?: number | null;
  totalPlatformFeeCents: number;
  feePayer?: string;
  fundingCountry: string;
  creatorCountry: string;
  payoutCurrency?: string;
  providerRouteVersion?: string;
  milestones: MilestoneDraft[];
  milestoneSource: "template" | "custom";
  contractVersion?: number;
  createdAt?: string;
  lockedAt?: string | null;
  rightsActivateOn?: "release" | "acceptance" | "custom";
}): CollaborationFinancialPlan | null {
  if (!Number.isInteger(input.grossCents) || input.grossCents <= 0) return null;
  if (!Number.isInteger(input.totalPlatformFeeCents) || input.totalPlatformFeeCents < 0) return null;
  const shares = validateMilestoneShares(input.milestones);
  if (!shares.ok) return null;
  const grossParts = splitGross(input.grossCents, input.milestones.map((m) => m.shareBps));
  if (!grossParts) return null;
  const feeParts = splitGross(
    Math.max(input.totalPlatformFeeCents, 0) || 0,
    input.milestones.map((m) => m.shareBps),
  );
  // When fee is 0, allocate zeros without splitGross (which rejects 0 gross).
  const platformParts =
    input.totalPlatformFeeCents === 0
      ? input.milestones.map(() => 0)
      : feeParts;
  if (!platformParts) return null;

  const rightsActivateOn = input.rightsActivateOn ?? "release";
  const milestones: FinancialPlanMilestone[] = input.milestones.map((row, index) => {
    const grossCents = grossParts[index];
    const platformFeeCents = platformParts[index];
    return {
      title: row.title.trim(),
      shareBps: row.shareBps,
      grossCents,
      platformFeeCents,
      creatorCents: Math.max(0, grossCents - platformFeeCents),
      rightsActivateOn,
    };
  });

  const totalCreator = milestones.reduce((sum, row) => sum + row.creatorCents, 0);
  const totalFee = milestones.reduce((sum, row) => sum + row.platformFeeCents, 0);

  return {
    contractCurrency: (input.currency ?? "USD").toUpperCase(),
    grossContractValueCents: input.grossCents,
    feeRuleId: input.feeRuleId ?? null,
    feeRuleVersion: input.feeRuleVersion ?? null,
    feeMethod: input.feeMethod ?? null,
    feePercentBps: input.feePercentBps ?? null,
    feeFixedCents: input.feeFixedCents ?? null,
    totalPlatformFeeCents: totalFee,
    totalCreatorCompensationCents: totalCreator,
    feePayer: input.feePayer ?? "brand",
    fundingCountry: input.fundingCountry.trim().toUpperCase(),
    creatorCountry: input.creatorCountry.trim().toUpperCase(),
    payoutCurrency: (input.payoutCurrency ?? input.currency ?? "USD").toUpperCase(),
    providerRouteVersion: input.providerRouteVersion ?? "v1",
    roundingPolicy: "last_milestone_absorbs",
    contractVersion: input.contractVersion ?? 1,
    createdAt: input.createdAt ?? new Date().toISOString(),
    lockedAt: input.lockedAt ?? null,
    rightsActivateOn,
    milestones,
    milestoneSource: input.milestoneSource,
  };
}

export function lockFinancialPlan(
  plan: CollaborationFinancialPlan,
  lockedAt = new Date().toISOString(),
): CollaborationFinancialPlan {
  return { ...plan, lockedAt };
}

export function isFinancialPlanLocked(plan: CollaborationFinancialPlan | null | undefined): boolean {
  return Boolean(plan?.lockedAt);
}

/** Fee rule edits must not mutate a locked plan's fee identity. */
export function feeRuleChangeAffectsPlan(
  plan: CollaborationFinancialPlan,
  nextRule: { id: string; version: number },
): boolean {
  if (!plan.lockedAt) return true;
  if (!plan.feeRuleId) return false;
  return plan.feeRuleId !== nextRule.id || plan.feeRuleVersion !== nextRule.version;
}

export function parseMilestoneDraftsFromForm(raw: {
  titles: string[];
  percents: string[];
}): MilestoneDraft[] {
  const drafts: MilestoneDraft[] = [];
  const count = Math.max(raw.titles.length, raw.percents.length);
  for (let i = 0; i < count; i += 1) {
    const title = String(raw.titles[i] ?? "").trim();
    const percent = Number(String(raw.percents[i] ?? "").replace(/[^0-9.]/g, ""));
    if (!title && !Number.isFinite(percent)) continue;
    drafts.push({
      title,
      shareBps: Number.isFinite(percent) ? Math.round(percent * 100) : 0,
    });
  }
  return drafts;
}

export function countryCodeFromLocation(locationCountry: string | null | undefined): string | null {
  if (!locationCountry) return null;
  const raw = locationCountry.trim();
  if (/^[A-Za-z]{2}$/.test(raw)) return raw.toUpperCase();
  const map: Record<string, string> = {
    USA: "US",
    "UNITED STATES": "US",
    "UNITED STATES OF AMERICA": "US",
    UK: "GB",
    "UNITED KINGDOM": "GB",
    "GREAT BRITAIN": "GB",
    NIGERIA: "NG",
    CANADA: "CA",
    GERMANY: "DE",
    FRANCE: "FR",
    AUSTRALIA: "AU",
    KENYA: "KE",
    GHANA: "GH",
  };
  return map[raw.toUpperCase()] ?? null;
}
