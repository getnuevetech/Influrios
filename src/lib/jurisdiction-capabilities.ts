/**
 * W3.3 — Jurisdiction payment capability depth (Dev Addendum §6 / §24; PA007).
 * Capability flags override feature availability even when fee rules / adapters exist.
 */

export const LEGAL_REVIEW_STATUSES = ["APPROVED", "PENDING", "BLOCKED"] as const;
export type LegalReviewStatus = (typeof LEGAL_REVIEW_STATUSES)[number];

export type JurisdictionCapabilities = {
  protectedPaymentsEnabled: boolean;
  escrowTermAllowed: boolean;
  fullPrefundingEnabled: boolean;
  stagedPrefundingEnabled: boolean;
  recurringFundingEnabled: boolean;
  managedIntroductionEnabled: boolean;
  managedNegotiationEnabled: boolean;
  /** Empty = any marketplace provider assigned on the jurisdiction row is fine. */
  approvedProviderIds: string[];
  legalReviewStatus: LegalReviewStatus;
  capabilityNotes?: string;
  capabilitiesEffectiveFrom?: Date | string | null;
  capabilitiesEffectiveTo?: Date | string | null;
};

export type ScheduleKindCapability = "once" | "staged" | "recurring";

export function asLegalReviewStatus(value: string | null | undefined): LegalReviewStatus {
  const raw = String(value ?? "").trim().toUpperCase();
  if ((LEGAL_REVIEW_STATUSES as readonly string[]).includes(raw)) return raw as LegalReviewStatus;
  return "PENDING";
}

export function parseApprovedProviderIds(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    return raw.map((v) => String(v).trim().toLowerCase()).filter(Boolean);
  }
  if (typeof raw === "string") {
    const trimmed = raw.trim();
    if (!trimmed) return [];
    try {
      const parsed = JSON.parse(trimmed) as unknown;
      if (Array.isArray(parsed)) {
        return parsed.map((v) => String(v).trim().toLowerCase()).filter(Boolean);
      }
    } catch {
      // fall through to CSV
    }
    return trimmed
      .split(/[,;\s]+/)
      .map((v) => v.trim().toLowerCase())
      .filter(Boolean);
  }
  return [];
}

export function serializeApprovedProviderIds(ids: string[]): string {
  const cleaned = [...new Set(ids.map((v) => v.trim().toLowerCase()).filter(Boolean))];
  return JSON.stringify(cleaned);
}

function toDate(value: Date | string | null | undefined): Date | null {
  if (value == null || value === "") return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Effective-window + legal_review_status for the capability matrix. */
export function jurisdictionCapabilitiesActive(
  caps: Pick<
    JurisdictionCapabilities,
    "legalReviewStatus" | "capabilitiesEffectiveFrom" | "capabilitiesEffectiveTo"
  >,
  asOf: Date = new Date(),
): { ok: true } | { ok: false; error: string } {
  const status = asLegalReviewStatus(caps.legalReviewStatus);
  if (status === "BLOCKED") {
    return { ok: false, error: "This jurisdiction is blocked pending legal review." };
  }
  const from = toDate(caps.capabilitiesEffectiveFrom);
  const to = toDate(caps.capabilitiesEffectiveTo);
  if (from && asOf < from) {
    return { ok: false, error: "Jurisdiction capabilities are not yet effective." };
  }
  if (to && asOf > to) {
    return { ok: false, error: "Jurisdiction capabilities have expired." };
  }
  return { ok: true };
}

/**
 * Managed modes require both an APPROVED legal review and the feature flag.
 * Fee rules alone never authorize managed introduction / negotiation (§24).
 */
export function serviceLevelAllowedByJurisdiction(
  caps: Pick<
    JurisdictionCapabilities,
    | "managedIntroductionEnabled"
    | "managedNegotiationEnabled"
    | "legalReviewStatus"
    | "capabilitiesEffectiveFrom"
    | "capabilitiesEffectiveTo"
  >,
  serviceLevel: string,
  asOf: Date = new Date(),
): { ok: true } | { ok: false; error: string } {
  const level = serviceLevel.trim().toLowerCase();
  const active = jurisdictionCapabilitiesActive(caps, asOf);
  if (!active.ok) return active;

  if (level === "managed_intro") {
    if (asLegalReviewStatus(caps.legalReviewStatus) !== "APPROVED") {
      return {
        ok: false,
        error: "Managed introduction requires APPROVED legal review for this jurisdiction.",
      };
    }
    if (!caps.managedIntroductionEnabled) {
      return {
        ok: false,
        error: "Managed introduction is not enabled for this jurisdiction.",
      };
    }
    return { ok: true };
  }

  if (level === "managed_campaign") {
    if (asLegalReviewStatus(caps.legalReviewStatus) !== "APPROVED") {
      return {
        ok: false,
        error: "Managed campaign requires APPROVED legal review for this jurisdiction.",
      };
    }
    if (!caps.managedNegotiationEnabled) {
      return {
        ok: false,
        error: "Managed negotiation / campaign is not enabled for this jurisdiction.",
      };
    }
    return { ok: true };
  }

  return { ok: true };
}

export function scheduleKindAllowedByJurisdiction(
  caps: Pick<
    JurisdictionCapabilities,
    | "fullPrefundingEnabled"
    | "stagedPrefundingEnabled"
    | "recurringFundingEnabled"
    | "legalReviewStatus"
    | "capabilitiesEffectiveFrom"
    | "capabilitiesEffectiveTo"
  >,
  kind: string,
  asOf: Date = new Date(),
): { ok: true } | { ok: false; error: string } {
  const active = jurisdictionCapabilitiesActive(caps, asOf);
  if (!active.ok) return active;
  const schedule = (kind || "once").trim().toLowerCase() as ScheduleKindCapability | string;
  if (schedule === "once" || schedule === "full") {
    if (!caps.fullPrefundingEnabled) {
      return { ok: false, error: "Full prefunding is not enabled for this jurisdiction." };
    }
    return { ok: true };
  }
  if (schedule === "staged") {
    if (!caps.stagedPrefundingEnabled) {
      return { ok: false, error: "Staged prefunding is not enabled for this jurisdiction." };
    }
    return { ok: true };
  }
  if (schedule === "recurring") {
    if (!caps.recurringFundingEnabled) {
      return { ok: false, error: "Recurring funding is not enabled for this jurisdiction." };
    }
    return { ok: true };
  }
  return { ok: false, error: `Unknown funding schedule: ${schedule}.` };
}

export function providerApprovedByJurisdiction(
  caps: Pick<JurisdictionCapabilities, "approvedProviderIds">,
  providerCode: string,
): { ok: true } | { ok: false; error: string } {
  const allowed = caps.approvedProviderIds ?? [];
  if (allowed.length === 0) return { ok: true };
  const code = providerCode.trim().toLowerCase();
  if (!allowed.includes(code)) {
    return {
      ok: false,
      error: `Provider ${providerCode} is not on the approved list for this jurisdiction.`,
    };
  }
  return { ok: true };
}

/** UI helper — which service levels the jurisdiction currently offers. */
export function allowedServiceLevels(
  caps: Pick<
    JurisdictionCapabilities,
    | "managedIntroductionEnabled"
    | "managedNegotiationEnabled"
    | "legalReviewStatus"
    | "capabilitiesEffectiveFrom"
    | "capabilitiesEffectiveTo"
  >,
  allLevels: readonly string[],
  asOf: Date = new Date(),
): string[] {
  return allLevels.filter((level) => serviceLevelAllowedByJurisdiction(caps, level, asOf).ok);
}

export function evaluatePrefundCapabilities(input: {
  caps: JurisdictionCapabilities | null | undefined;
  serviceLevel: string;
  scheduleKind: string;
  providerCode: string;
  asOf?: Date;
}): { ok: true } | { ok: false; error: string } {
  if (!input.caps) {
    return { ok: false, error: "Unknown jurisdiction. Nothing was funded." };
  }
  const asOf = input.asOf ?? new Date();
  const active = jurisdictionCapabilitiesActive(input.caps, asOf);
  if (!active.ok) return active;
  if (!input.caps.protectedPaymentsEnabled) {
    return { ok: false, error: "Protected payments are off for this jurisdiction." };
  }
  const provider = providerApprovedByJurisdiction(input.caps, input.providerCode);
  if (!provider.ok) return provider;
  const service = serviceLevelAllowedByJurisdiction(input.caps, input.serviceLevel, asOf);
  if (!service.ok) return service;
  const schedule = scheduleKindAllowedByJurisdiction(input.caps, input.scheduleKind, asOf);
  if (!schedule.ok) return schedule;
  return { ok: true };
}

export function capabilitiesFromJurisdictionRow(row: {
  protectedPaymentsEnabled: boolean;
  escrowTermAllowed: boolean;
  fullPrefundingEnabled?: boolean | null;
  stagedPrefundingEnabled?: boolean | null;
  recurringFundingEnabled?: boolean | null;
  managedIntroductionEnabled?: boolean | null;
  managedNegotiationEnabled?: boolean | null;
  approvedProviderIds?: string | null;
  legalReviewStatus?: string | null;
  capabilityNotes?: string | null;
  capabilitiesEffectiveFrom?: Date | null;
  capabilitiesEffectiveTo?: Date | null;
}): JurisdictionCapabilities {
  return {
    protectedPaymentsEnabled: Boolean(row.protectedPaymentsEnabled),
    escrowTermAllowed: Boolean(row.escrowTermAllowed),
    fullPrefundingEnabled: row.fullPrefundingEnabled !== false,
    stagedPrefundingEnabled: Boolean(row.stagedPrefundingEnabled),
    recurringFundingEnabled: Boolean(row.recurringFundingEnabled),
    managedIntroductionEnabled: Boolean(row.managedIntroductionEnabled),
    managedNegotiationEnabled: Boolean(row.managedNegotiationEnabled),
    approvedProviderIds: parseApprovedProviderIds(row.approvedProviderIds),
    legalReviewStatus: asLegalReviewStatus(row.legalReviewStatus ?? "APPROVED"),
    capabilityNotes: row.capabilityNotes ?? "",
    capabilitiesEffectiveFrom: row.capabilitiesEffectiveFrom ?? null,
    capabilitiesEffectiveTo: row.capabilitiesEffectiveTo ?? null,
  };
}
