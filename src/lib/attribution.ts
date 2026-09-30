const CONFIRMED = new Set(["held", "completed", "refunded"]);

export function sameBusiness(left: string, right: string) {
  const normalize = (value: string) => value.trim().replace(/\s+/g, " ").toLowerCase();
  return normalize(left) === normalize(right) && normalize(left).length > 0;
}

export function attributionWindowStart(now: Date, windowDays: number) {
  return new Date(now.getTime() - windowDays * 24 * 60 * 60 * 1000);
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
