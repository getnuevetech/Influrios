/**
 * Collab OS P5 — payout readiness & country activation corridors.
 */
import { prisma } from "@/lib/db";
import { quoteFx } from "@/lib/fx-share";
import { DEFAULT_PAYMENT_ROUTES, paymentRoutes, type GatewayReadiness } from "@/lib/providers";
import { countryCodeFromLocation } from "@/lib/contract-wizard";

export const PAYOUT_METHODS = ["local_bank", "usd_bank", "mpesa", "flutterwave_payout"] as const;
export type PayoutMethod = (typeof PAYOUT_METHODS)[number];

export const PAYOUT_METHOD_LABELS: Record<PayoutMethod, string> = {
  local_bank: "Local bank",
  usd_bank: "USD bank",
  mpesa: "M-Pesa",
  flutterwave_payout: "Flutterwave payout",
};

export type PayoutReadiness = {
  countryCode: string | null;
  corridorActive: boolean;
  gateway: GatewayReadiness | null;
  identityVerified: boolean;
  primaryMethod: string | null;
  primaryStatus: string | null;
  secondaryMethod: string | null;
  secondaryStatus: string | null;
  hasVerifiedMethod: boolean;
  globalPayoutReady: boolean;
  blockers: string[];
};

/** Exact fee/FX quote shown before payout confirmation (Collab OS §9.2). */
export type PayoutFeeFxQuote = {
  fundingCurrency: string;
  payoutCurrency: string;
  creatorGrossCents: number;
  platformFeeCents: number;
  creatorNetCents: number;
  payoutMinor: number;
  fxApplied: boolean;
  fxSource: "identity" | "admin" | null;
  minorPerUsd: number | null;
  summary: string;
};

export function buildPayoutFeeFxQuote(input: {
  creatorGrossCents: number;
  platformFeeCents: number;
  fundingCurrency: string;
  payoutCurrency: string;
  /** Admin FX: payout currency minor units per 1 USD (×100 style via quoteFx). */
  minorPerUsd?: number | null;
}): { ok: true; quote: PayoutFeeFxQuote } | { ok: false; error: string } {
  const fundingCurrency = input.fundingCurrency.trim().toUpperCase();
  const payoutCurrency = input.payoutCurrency.trim().toUpperCase();
  if (!Number.isInteger(input.creatorGrossCents) || input.creatorGrossCents < 0) {
    return { ok: false, error: "Creator gross must be a non-negative integer." };
  }
  if (!Number.isInteger(input.platformFeeCents) || input.platformFeeCents < 0) {
    return { ok: false, error: "Platform fee must be a non-negative integer." };
  }
  if (input.platformFeeCents > input.creatorGrossCents) {
    return { ok: false, error: "Platform fee cannot exceed creator gross." };
  }
  const creatorNetCents = input.creatorGrossCents - input.platformFeeCents;
  if (fundingCurrency === payoutCurrency) {
    return {
      ok: true,
      quote: {
        fundingCurrency,
        payoutCurrency,
        creatorGrossCents: input.creatorGrossCents,
        platformFeeCents: input.platformFeeCents,
        creatorNetCents,
        payoutMinor: creatorNetCents,
        fxApplied: false,
        fxSource: fundingCurrency === "USD" ? "identity" : null,
        minorPerUsd: fundingCurrency === "USD" ? 100 : null,
        summary: `Payout ${payoutCurrency} ${creatorNetCents} minor after ${input.platformFeeCents} fee (no FX).`,
      },
    };
  }
  // Convert net creator amount from funding currency → payout when funding is USD.
  if (fundingCurrency !== "USD") {
    return {
      ok: false,
      error: "Exact FX quote requires USD funding currency for this corridor preview.",
    };
  }
  const fx = quoteFx({
    usdCents: Math.max(creatorNetCents, 1),
    currency: payoutCurrency,
    minorPerUsd: input.minorPerUsd ?? null,
  });
  if (!fx.ok) return { ok: false, error: fx.error };
  const payoutMinor = creatorNetCents === 0 ? 0 : fx.convertedMinor;
  return {
    ok: true,
    quote: {
      fundingCurrency,
      payoutCurrency,
      creatorGrossCents: input.creatorGrossCents,
      platformFeeCents: input.platformFeeCents,
      creatorNetCents,
      payoutMinor,
      fxApplied: true,
      fxSource: fx.source === "admin" ? "admin" : "identity",
      minorPerUsd: fx.minorPerUsd,
      summary: `Payout ≈ ${payoutCurrency} ${payoutMinor} minor after ${input.platformFeeCents} fee (FX ${fx.source}).`,
    },
  };
}

function defaultMethodForCountry(countryCode: string | null): PayoutMethod {
  if (countryCode === "KE") return "mpesa";
  if (countryCode && ["NG", "GH", "ZA", "UG", "RW", "TZ", "CM"].includes(countryCode)) {
    return "flutterwave_payout";
  }
  if (countryCode === "US") return "usd_bank";
  return "local_bank";
}

export async function ensureCountryActivationCorridors() {
  const existing = await prisma.countryActivationCorridor.count();
  if (existing > 0) return;
  const now = new Date();
  for (const row of DEFAULT_PAYMENT_ROUTES) {
    await prisma.countryActivationCorridor.upsert({
      where: { countryCode: row.countryCode },
      update: {},
      create: {
        countryCode: row.countryCode,
        active: true,
        currency: row.currency,
        collectionProviderCode: row.gateway,
        payoutMethodsJson:
          row.gateway === "flutterwave"
            ? ["flutterwave_payout", "local_bank", "mpesa"]
            : ["local_bank", "usd_bank"],
        holdingEnabled: true,
        fxEnabled: row.currency !== "USD",
        kycModel: "identity_light",
        notes: `Seeded from default ${row.gateway} corridor`,
        updatedAt: now,
      },
    });
  }
}

export async function listCountryActivationCorridors() {
  await ensureCountryActivationCorridors();
  return prisma.countryActivationCorridor.findMany({ orderBy: { countryCode: "asc" } });
}

export async function ensureInfluencerPayoutProfile(input: {
  creatorId: string;
  locationCountry?: string | null;
}) {
  const countryCode = countryCodeFromLocation(input.locationCountry ?? null);
  const method = defaultMethodForCountry(countryCode);
  const currency =
    DEFAULT_PAYMENT_ROUTES.find((row) => row.countryCode === countryCode)?.currency ?? "USD";
  const existing = await prisma.influencerPayoutProfile.findUnique({
    where: { creatorId: input.creatorId },
  });
  if (existing) return existing;
  return prisma.influencerPayoutProfile.create({
    data: {
      creatorId: input.creatorId,
      primaryMethod: method,
      primaryLabel: PAYOUT_METHOD_LABELS[method],
      primaryStatus: "UNVERIFIED",
      primaryCountryCode: countryCode,
      primaryCurrency: currency,
      globalPayoutReady: false,
    },
  });
}

export async function setInfluencerPayoutMethodStatus(input: {
  creatorId: string;
  which: "primary" | "secondary";
  status: "UNVERIFIED" | "PENDING" | "VERIFIED" | "REJECTED";
}) {
  const profile = await prisma.influencerPayoutProfile.findUnique({ where: { creatorId: input.creatorId } });
  if (!profile) throw new Error("Payout profile not found");
  const data =
    input.which === "primary"
      ? { primaryStatus: input.status }
      : { secondaryStatus: input.status };
  const updated = await prisma.influencerPayoutProfile.update({
    where: { creatorId: input.creatorId },
    data,
  });
  return refreshGlobalPayoutReadyFlag(updated.creatorId);
}

export async function computePayoutReadiness(input: {
  creatorId: string;
  identityVerified: boolean;
  locationCountry?: string | null;
}): Promise<PayoutReadiness> {
  await ensureCountryActivationCorridors();
  const countryCode = countryCodeFromLocation(input.locationCountry ?? null);
  const profile = await ensureInfluencerPayoutProfile({
    creatorId: input.creatorId,
    locationCountry: input.locationCountry,
  });
  const corridor = countryCode
    ? await prisma.countryActivationCorridor.findUnique({ where: { countryCode } })
    : null;
  const routes = await paymentRoutes().catch(() => [] as GatewayReadiness[]);
  const gateway = countryCode ? routes.find((row) => row.countryCode === countryCode) ?? null : null;

  const hasVerifiedMethod =
    profile.primaryStatus === "VERIFIED" || profile.secondaryStatus === "VERIFIED";
  const blockers: string[] = [];
  if (!input.identityVerified) blockers.push("Influencer identity is not verified.");
  if (!countryCode) blockers.push("Influencer payout country is unknown.");
  if (countryCode && !corridor?.active) blockers.push("Country corridor is not activated.");
  if (countryCode && corridor?.active && !gateway?.ready) {
    blockers.push(`Payment route not ready (${gateway?.reason ?? "no_route"}).`);
  }
  if (!hasVerifiedMethod) blockers.push("No verified payout method (primary or secondary).");

  const globalPayoutReady = blockers.length === 0;

  if (profile.globalPayoutReady !== globalPayoutReady) {
    await prisma.influencerPayoutProfile.update({
      where: { creatorId: input.creatorId },
      data: { globalPayoutReady },
    });
  }

  return {
    countryCode,
    corridorActive: Boolean(corridor?.active),
    gateway,
    identityVerified: input.identityVerified,
    primaryMethod: profile.primaryMethod,
    primaryStatus: profile.primaryStatus,
    secondaryMethod: profile.secondaryMethod,
    secondaryStatus: profile.secondaryStatus,
    hasVerifiedMethod,
    globalPayoutReady,
    blockers,
  };
}

async function refreshGlobalPayoutReadyFlag(creatorId: string) {
  const creator = await prisma.creator.findUnique({ where: { id: creatorId } });
  if (!creator) throw new Error("Creator not found");
  return computePayoutReadiness({
    creatorId,
    identityVerified: creator.identityVerified === "VERIFIED",
    locationCountry: creator.locationCountry,
  });
}
