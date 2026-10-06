const CONFIRMED = new Set(["held", "completed", "refunded"]);

export const ATTRIBUTION_STATUSES = [
  "active",
  "expired",
  "contested",
  "pre_existing",
] as const;
export type AttributionStatus = (typeof ATTRIBUTION_STATUSES)[number];

export const ATTRIBUTION_CLAIM_STATUSES = ["open", "under_review", "upheld", "rejected"] as const;
export type AttributionClaimStatus = (typeof ATTRIBUTION_CLAIM_STATUSES)[number];

/** Dev §15 — attribution_expiry must be finite; never infer forever. */
export const ATTRIBUTION_EXPIRY_MIN_DAYS = 1;
export const ATTRIBUTION_EXPIRY_MAX_DAYS = 3650;

export function sameBusiness(left: string, right: string) {
  const normalize = (value: string) => value.trim().replace(/\s+/g, " ").toLowerCase();
  return normalize(left) === normalize(right) && normalize(left).length > 0;
}

export function attributionWindowStart(now: Date, windowDays: number) {
  return new Date(now.getTime() - windowDays * 24 * 60 * 60 * 1000);
}

/** Validate and normalize attribution expiry days (never forever). */
export function normalizeAttributionExpiryDays(raw: number): number {
  const days = Math.round(raw);
  if (!Number.isFinite(days) || days < ATTRIBUTION_EXPIRY_MIN_DAYS || days > ATTRIBUTION_EXPIRY_MAX_DAYS) {
    throw new Error(
      `Attribution expiry must be between ${ATTRIBUTION_EXPIRY_MIN_DAYS} and ${ATTRIBUTION_EXPIRY_MAX_DAYS} days (never forever).`,
    );
  }
  return days;
}

export function attributionExpiresAt(from: Date, expiryDays: number) {
  const days = normalizeAttributionExpiryDays(expiryDays);
  return new Date(from.getTime() + days * 24 * 60 * 60 * 1000);
}

export function isAttributionExpired(expiresAt: Date | null | undefined, now: Date = new Date()) {
  if (!expiresAt) return true; // missing expiry → treat as expired (never forever)
  return expiresAt.getTime() <= now.getTime();
}

export function asAttributionStatus(value: string | null | undefined): AttributionStatus {
  const raw = String(value ?? "").trim().toLowerCase();
  if ((ATTRIBUTION_STATUSES as readonly string[]).includes(raw)) return raw as AttributionStatus;
  return "active";
}

/**
 * Fee resolution must honor attribution status (Dev §15 / Product §14).
 * Pre-existing relationships must not take managed introduction / campaign fees.
 */
export function serviceLevelForFeeResolution(input: {
  requestedServiceLevel: string;
  attributionStatus?: string | null;
}): string {
  const status = asAttributionStatus(input.attributionStatus);
  const level = String(input.requestedServiceLevel ?? "contracted").trim().toLowerCase() || "contracted";
  if (status === "pre_existing") {
    if (level === "managed_intro" || level === "managed_campaign") return "contracted";
  }
  return level;
}

export function canAttributeRepeat(input: {
  prior: {
    businessName: string;
    creatorSlug: string;
    status: string;
    grossCents: number;
    createdAt: Date;
  } | null;
  businessName: string;
  creatorSlug: string;
  minGrossCents: number;
  windowStart: Date;
}) {
  if (!input.prior) return { ok: false as const, error: "Choose a prior deal to repeat." };
  if (!sameBusiness(input.prior.businessName, input.businessName) || input.prior.creatorSlug !== input.creatorSlug.trim()) {
    return { ok: false as const, error: "A repeat must be the same business and creator." };
  }
  if (!CONFIRMED.has(input.prior.status)) {
    return { ok: false as const, error: "Repeat a deal only after the provider has confirmed it." };
  }
  if (input.prior.grossCents < input.minGrossCents) {
    return { ok: false as const, error: "That deal is below the repeat minimum." };
  }
  if (input.prior.createdAt < input.windowStart) {
    return { ok: false as const, error: "That deal is outside the attribution window." };
  }
  return { ok: true as const };
}

export function canResolveAttributionClaim(input: {
  status: string;
  decision: "upheld" | "rejected";
}): { ok: true; nextStatus: "upheld" | "rejected" } | { ok: false; error: string } {
  if (input.status !== "open" && input.status !== "under_review") {
    return { ok: false, error: "Only open or under-review claims can be resolved." };
  }
  if (input.decision !== "upheld" && input.decision !== "rejected") {
    return { ok: false, error: "Choose upheld or rejected." };
  }
  return { ok: true, nextStatus: input.decision };
}
