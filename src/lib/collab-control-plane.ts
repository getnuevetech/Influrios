/**
 * Collab OS P6 — Admin Collaboration control plane.
 * Ops can suspend corridors, version thresholds, and inspect account purposes without a deploy.
 */
import { ACCOUNT_PURPOSES, type AccountPurpose } from "@/lib/account-purpose";
import { prisma } from "@/lib/db";
import {
  ensureCountryActivationCorridors,
  listCountryActivationCorridors,
  PAYOUT_METHODS,
  PAYOUT_METHOD_LABELS,
  type PayoutMethod,
} from "@/lib/payout-readiness";

export const COLLAB_CONTROL_PLANE_KEY = "collab.controlPlane";

export type MentorshipEligibility = {
  enabled: boolean;
  minFollowers: number;
  requireIdentityVerified: boolean;
  requireGlobalPayoutReady: boolean;
  notes: string;
};

export type GuestCollabThresholds = {
  proposeSoft: number;
  proposeHard: number;
  applySoft: number;
  applyHard: number;
};

/** W2.3c — marketplace application EXPIRED: manual UI only, or auto after N days. */
export type ApplicationExpirePolicy = {
  mode: "manual" | "auto";
  afterDays: number;
};

export type CollabControlPlane = {
  version: number;
  dualApprovalThresholdCents: number;
  mentorship: MentorshipEligibility;
  guestCollab: GuestCollabThresholds;
  applicationExpire: ApplicationExpirePolicy;
  updatedAt: string | null;
};

export const DEFAULT_COLLAB_CONTROL_PLANE: CollabControlPlane = {
  version: 1,
  dualApprovalThresholdCents: 500_00, // $500
  mentorship: {
    enabled: true,
    minFollowers: 1_000,
    requireIdentityVerified: true,
    requireGlobalPayoutReady: false,
    notes: "Mentors must meet admin eligibility before appearing in Find a Mentor.",
  },
  guestCollab: {
    proposeSoft: 1,
    proposeHard: 2,
    applySoft: 2,
    applyHard: 3,
  },
  applicationExpire: {
    mode: "manual",
    afterDays: 14,
  },
  updatedAt: null,
};

export const ACCOUNT_PURPOSE_LABELS: Record<AccountPurpose, string> = {
  OPERATIONS: "Influrios Operations",
  COLLABORATION_HOLDING: "Collaboration Holding",
  PLATFORM_FEE_CLEARING: "Platform Fee Clearing",
  REFUND_RESERVE: "Refund Reserve",
  REGIONAL_SETTLEMENT: "Regional Settlement",
};

export const ACCOUNT_PURPOSE_HINTS: Record<AccountPurpose, string> = {
  OPERATIONS: "Platform operating funds. Creator/protected money must not land here except earned fees.",
  COLLABORATION_HOLDING: "Provider-held collaboration funds until milestone release.",
  PLATFORM_FEE_CLEARING: "Transient fee clearing before Operations earn.",
  REFUND_RESERVE: "Reserve for refunds and chargebacks.",
  REGIONAL_SETTLEMENT: "Regional settlement wallets by corridor/currency.",
};

function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function asInt(value: unknown, fallback: number, min = 0) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.floor(n));
}

function parseControlPlane(raw: unknown): CollabControlPlane {
  const row = asObject(raw);
  const mentorship = asObject(row.mentorship);
  const guest = asObject(row.guestCollab);
  const expire = asObject(row.applicationExpire);
  const expireMode = expire.mode === "auto" ? "auto" : "manual";
  return {
    version: asInt(row.version, DEFAULT_COLLAB_CONTROL_PLANE.version, 1),
    dualApprovalThresholdCents: asInt(
      row.dualApprovalThresholdCents,
      DEFAULT_COLLAB_CONTROL_PLANE.dualApprovalThresholdCents,
      0,
    ),
    mentorship: {
      enabled: mentorship.enabled !== false,
      minFollowers: asInt(mentorship.minFollowers, DEFAULT_COLLAB_CONTROL_PLANE.mentorship.minFollowers, 0),
      requireIdentityVerified: mentorship.requireIdentityVerified !== false,
      requireGlobalPayoutReady: mentorship.requireGlobalPayoutReady === true,
      notes:
        typeof mentorship.notes === "string" && mentorship.notes.trim()
          ? mentorship.notes.trim().slice(0, 500)
          : DEFAULT_COLLAB_CONTROL_PLANE.mentorship.notes,
    },
    guestCollab: {
      proposeSoft: asInt(guest.proposeSoft, DEFAULT_COLLAB_CONTROL_PLANE.guestCollab.proposeSoft, 1),
      proposeHard: asInt(guest.proposeHard, DEFAULT_COLLAB_CONTROL_PLANE.guestCollab.proposeHard, 1),
      applySoft: asInt(guest.applySoft, DEFAULT_COLLAB_CONTROL_PLANE.guestCollab.applySoft, 1),
      applyHard: asInt(guest.applyHard, DEFAULT_COLLAB_CONTROL_PLANE.guestCollab.applyHard, 1),
    },
    applicationExpire: {
      mode: expireMode,
      afterDays: asInt(
        expire.afterDays,
        DEFAULT_COLLAB_CONTROL_PLANE.applicationExpire.afterDays,
        1,
      ),
    },
    updatedAt: typeof row.updatedAt === "string" ? row.updatedAt : null,
  };
}

export async function getCollabControlPlane(): Promise<CollabControlPlane> {
  const row = await prisma.platformSetting.findUnique({ where: { key: COLLAB_CONTROL_PLANE_KEY } }).catch(() => null);
  if (!row) return { ...DEFAULT_COLLAB_CONTROL_PLANE };
  return parseControlPlane(row.value);
}

export async function saveCollabControlPlane(
  input: Partial<CollabControlPlane> & {
    actor: string;
  },
): Promise<CollabControlPlane> {
  const prev = await getCollabControlPlane();
  const next: CollabControlPlane = {
    version: prev.version + 1,
    dualApprovalThresholdCents:
      input.dualApprovalThresholdCents != null
        ? asInt(input.dualApprovalThresholdCents, prev.dualApprovalThresholdCents, 0)
        : prev.dualApprovalThresholdCents,
    mentorship: {
      ...prev.mentorship,
      ...(input.mentorship ?? {}),
      minFollowers: asInt(
        input.mentorship?.minFollowers ?? prev.mentorship.minFollowers,
        prev.mentorship.minFollowers,
        0,
      ),
      notes: (input.mentorship?.notes ?? prev.mentorship.notes).trim().slice(0, 500),
    },
    guestCollab: {
      proposeSoft: asInt(
        input.guestCollab?.proposeSoft ?? prev.guestCollab.proposeSoft,
        prev.guestCollab.proposeSoft,
        1,
      ),
      proposeHard: asInt(
        input.guestCollab?.proposeHard ?? prev.guestCollab.proposeHard,
        prev.guestCollab.proposeHard,
        1,
      ),
      applySoft: asInt(input.guestCollab?.applySoft ?? prev.guestCollab.applySoft, prev.guestCollab.applySoft, 1),
      applyHard: asInt(input.guestCollab?.applyHard ?? prev.guestCollab.applyHard, prev.guestCollab.applyHard, 1),
    },
    applicationExpire: {
      mode: input.applicationExpire?.mode === "auto" ? "auto" : input.applicationExpire?.mode === "manual"
        ? "manual"
        : prev.applicationExpire.mode,
      afterDays: asInt(
        input.applicationExpire?.afterDays ?? prev.applicationExpire.afterDays,
        prev.applicationExpire.afterDays,
        1,
      ),
    },
    updatedAt: new Date().toISOString(),
  };
  // Soft ≤ hard for each pair.
  next.guestCollab.proposeSoft = Math.min(next.guestCollab.proposeSoft, next.guestCollab.proposeHard);
  next.guestCollab.applySoft = Math.min(next.guestCollab.applySoft, next.guestCollab.applyHard);
  next.applicationExpire.afterDays = Math.min(365, Math.max(1, next.applicationExpire.afterDays));

  await prisma.platformSetting.upsert({
    where: { key: COLLAB_CONTROL_PLANE_KEY },
    create: { key: COLLAB_CONTROL_PLANE_KEY, value: next },
    update: { value: next },
  });
  await prisma.auditLog.create({
    data: {
      actor: input.actor.slice(0, 120),
      action: "collab.control_plane.save",
      objectType: "CollabControlPlane",
      objectId: COLLAB_CONTROL_PLANE_KEY,
      before: prev as unknown as object,
      after: next as unknown as object,
    },
  });
  return next;
}

/** Manual financial overrides above this threshold need a second distinct approver. */
export function requiresDualApproval(amountCents: number, thresholdCents: number): boolean {
  if (!Number.isInteger(amountCents) || amountCents <= 0) return false;
  if (!Number.isInteger(thresholdCents) || thresholdCents <= 0) return false;
  return amountCents >= thresholdCents;
}

export function evaluateDualApproval(input: {
  amountCents: number;
  thresholdCents: number;
  primaryActor: string;
  secondaryActor?: string | null;
}): { ok: true } | { ok: false; error: string; required: boolean } {
  const required = requiresDualApproval(input.amountCents, input.thresholdCents);
  if (!required) return { ok: true };
  const primary = input.primaryActor.trim().toLowerCase();
  const secondary = (input.secondaryActor ?? "").trim().toLowerCase();
  if (!secondary) {
    return {
      ok: false,
      required: true,
      error: `Dual approval required for overrides ≥ ${input.thresholdCents}¢. Enter a second approver.`,
    };
  }
  if (!primary || secondary === primary) {
    return {
      ok: false,
      required: true,
      error: "Second approver must be a different admin than the primary actor.",
    };
  }
  return { ok: true };
}

export function mentorshipEligibilityOk(input: {
  settings: MentorshipEligibility;
  followers: number;
  identityVerified: boolean;
  globalPayoutReady: boolean;
}): { ok: true } | { ok: false; blockers: string[] } {
  if (!input.settings.enabled) {
    return { ok: false, blockers: ["Mentorship is disabled by admin."] };
  }
  const blockers: string[] = [];
  if (input.followers < input.settings.minFollowers) {
    blockers.push(`Need at least ${input.settings.minFollowers} followers.`);
  }
  if (input.settings.requireIdentityVerified && !input.identityVerified) {
    blockers.push("Influencer identity must be verified.");
  }
  if (input.settings.requireGlobalPayoutReady && !input.globalPayoutReady) {
    blockers.push("Global Payout Ready is required.");
  }
  return blockers.length ? { ok: false, blockers } : { ok: true };
}

export async function listCorridorsForAdmin() {
  await ensureCountryActivationCorridors();
  return listCountryActivationCorridors();
}

export async function setCorridorActive(input: {
  countryCode: string;
  active: boolean;
  actor: string;
}) {
  const code = input.countryCode.trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(code)) throw new Error("Use a two-letter country code.");
  await ensureCountryActivationCorridors();
  const before = await prisma.countryActivationCorridor.findUnique({ where: { countryCode: code } });
  if (!before) throw new Error(`Corridor ${code} was not found.`);
  const after = await prisma.countryActivationCorridor.update({
    where: { countryCode: code },
    data: { active: input.active },
  });
  await prisma.auditLog.create({
    data: {
      actor: input.actor.slice(0, 120),
      action: input.active ? "corridor.activate" : "corridor.suspend",
      objectType: "CountryActivationCorridor",
      objectId: code,
      before: before as unknown as object,
      after: after as unknown as object,
    },
  });
  return after;
}

export async function updateCorridor(input: {
  countryCode: string;
  actor: string;
  currency?: string;
  collectionProviderCode?: string | null;
  holdingEnabled?: boolean;
  fxEnabled?: boolean;
  kycModel?: string;
  notes?: string;
  payoutMethods?: string[];
}) {
  const code = input.countryCode.trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(code)) throw new Error("Use a two-letter country code.");
  await ensureCountryActivationCorridors();
  const before = await prisma.countryActivationCorridor.findUnique({ where: { countryCode: code } });
  if (!before) throw new Error(`Corridor ${code} was not found.`);

  const currency = (input.currency ?? before.currency).trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(currency)) throw new Error("Use a three-letter currency.");

  const methods =
    input.payoutMethods ??
    (Array.isArray(before.payoutMethodsJson) ? (before.payoutMethodsJson as string[]) : []);
  const cleanedMethods = methods
    .map((m) => String(m).trim())
    .filter((m): m is PayoutMethod => (PAYOUT_METHODS as readonly string[]).includes(m));

  const after = await prisma.countryActivationCorridor.update({
    where: { countryCode: code },
    data: {
      currency,
      collectionProviderCode:
        input.collectionProviderCode === undefined
          ? before.collectionProviderCode
          : input.collectionProviderCode?.trim() || null,
      holdingEnabled: input.holdingEnabled ?? before.holdingEnabled,
      fxEnabled: input.fxEnabled ?? before.fxEnabled,
      kycModel: (input.kycModel ?? before.kycModel).trim().slice(0, 80) || "identity_light",
      notes: (input.notes ?? before.notes).trim().slice(0, 500),
      payoutMethodsJson: cleanedMethods,
    },
  });
  await prisma.auditLog.create({
    data: {
      actor: input.actor.slice(0, 120),
      action: "corridor.update",
      objectType: "CountryActivationCorridor",
      objectId: code,
      before: before as unknown as object,
      after: after as unknown as object,
    },
  });
  return after;
}

export function accountPurposeCatalog() {
  return ACCOUNT_PURPOSES.map((purpose) => ({
    purpose,
    label: ACCOUNT_PURPOSE_LABELS[purpose],
    hint: ACCOUNT_PURPOSE_HINTS[purpose],
  }));
}

export function payoutMethodOptions() {
  return PAYOUT_METHODS.map((method) => ({
    method,
    label: PAYOUT_METHOD_LABELS[method],
  }));
}
