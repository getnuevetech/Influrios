/**
 * Collab OS P5 — payout readiness & country activation corridors.
 */
import { prisma } from "@/lib/db";
import { quoteFx } from "@/lib/fx-share";
import { storedCurrencyCode } from "@/lib/money";
import { isConnectedAccountCollectionProvider } from "@/lib/provider-collection";
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
        kycModel: "",
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

/** Currency on that country's catalog payment route. A country with no route returns null. */
export function payoutCurrencyForCountry(countryCode: string | null | undefined): string | null {
  const code = (countryCode ?? "").trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(code)) return null;
  return storedCurrencyCode(DEFAULT_PAYMENT_ROUTES.find((row) => row.countryCode === code)?.currency);
}

/**
 * Currency stored on a new payout profile.
 * A saved corridor wins, then the catalog route, then the admin backup (USD when that backup is blank).
 */
export function payoutProfileCurrency(input: {
  countryCode: string | null | undefined;
  corridorCurrency?: string | null;
  fallbackCurrency?: string | null;
}): string {
  const code = (input.countryCode ?? "").trim().toUpperCase();
  if (/^[A-Z]{2}$/.test(code)) {
    const corridor = storedCurrencyCode(input.corridorCurrency);
    if (corridor) return corridor;
    const route = payoutCurrencyForCountry(code);
    if (route) return route;
  }
  return storedCurrencyCode(input.fallbackCurrency) ?? "USD";
}

export async function loadPayoutFallbackCurrency(): Promise<string> {
  const settings = await prisma.marketplaceSettings.findUnique({ where: { id: "default" } });
  return storedCurrencyCode(settings?.payoutFallbackCurrency) ?? "USD";
}

export async function savePayoutFallbackCurrency(currency: string) {
  const code = storedCurrencyCode(currency);
  if (!code) throw new Error("Enter a three-letter backup currency.");
  await prisma.marketplaceSettings.upsert({
    where: { id: "default" },
    update: { payoutFallbackCurrency: code },
    create: { id: "default", payoutFallbackCurrency: code },
  });
  return code;
}

export async function ensureInfluencerPayoutProfile(input: {
  creatorId: string;
  locationCountry?: string | null;
}) {
  const countryCode = countryCodeFromLocation(input.locationCountry ?? null);
  const method = defaultMethodForCountry(countryCode);
  const existing = await prisma.influencerPayoutProfile.findUnique({
    where: { creatorId: input.creatorId },
  });
  if (existing) return existing;
  await ensureCountryActivationCorridors();
  const corridor = countryCode
    ? await prisma.countryActivationCorridor.findUnique({ where: { countryCode } })
    : null;
  const fallbackCurrency = await loadPayoutFallbackCurrency();
  const currency = payoutProfileCurrency({
    countryCode,
    corridorCurrency: corridor?.currency,
    fallbackCurrency,
  });
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

/**
 * Influencer payout *onboarding* rail (Stripe Connect vs connected-account provider).
 * Driven by the active country corridor's collection route — not by global Connect readiness alone.
 * Plan checkout still uses Payment gateways / Stripe separately.
 */
export type PayoutOnboardingRail = "stripe" | "provider" | "none";

export type PayoutOnboardingChoice = {
  rail: PayoutOnboardingRail;
  countryCode: string | null;
  collectionProviderCode: string | null;
  showStripe: boolean;
  showProvider: boolean;
  reason: string;
};

export function choosePayoutOnboardingRail(input: {
  countryCode: string | null;
  corridorActive: boolean;
  collectionProviderCode: string | null | undefined;
  stripeConnectReady: boolean;
  providerReady: boolean;
  hasStripeConnectAccount: boolean;
  hasProviderAccount: boolean;
}): PayoutOnboardingChoice {
  const collection = (input.collectionProviderCode ?? "").trim().toLowerCase() || null;
  const countryCode = input.countryCode;

  if (input.corridorActive && isConnectedAccountCollectionProvider(collection)) {
    const showProvider = input.providerReady || input.hasProviderAccount;
    return {
      rail: showProvider ? "provider" : "none",
      countryCode,
      collectionProviderCode: collection,
      showStripe: false,
      showProvider,
      reason: showProvider
        ? "Corridor collection route uses a connected-account provider."
        : "Corridor uses a connected-account provider, but those credentials are not ready.",
    };
  }

  if (input.corridorActive && collection === "stripe") {
    const showStripe = input.stripeConnectReady || input.hasStripeConnectAccount;
    return {
      rail: showStripe ? "stripe" : "none",
      countryCode,
      collectionProviderCode: collection,
      showStripe,
      showProvider: false,
      reason: showStripe
        ? "Corridor collection route is Stripe."
        : "Corridor is Stripe, but Stripe Connect is not ready.",
    };
  }

  if (input.corridorActive && (collection === "flutterwave" || collection === "mpesa")) {
    return {
      rail: "none",
      countryCode,
      collectionProviderCode: collection,
      showStripe: false,
      showProvider: false,
      reason: `Corridor collection route is ${collection}; connected-account setup is not used for this rail.`,
    };
  }

  // No corridor route: keep existing accounts reachable; otherwise prefer whichever rail is ready.
  if (input.hasProviderAccount && !input.hasStripeConnectAccount) {
    return {
      rail: "provider",
      countryCode,
      collectionProviderCode: collection,
      showStripe: false,
      showProvider: true,
      reason: "Existing connected-account payout profile.",
    };
  }
  if (input.hasStripeConnectAccount && !input.hasProviderAccount) {
    return {
      rail: "stripe",
      countryCode,
      collectionProviderCode: collection,
      showStripe: true,
      showProvider: false,
      reason: "Existing Stripe Connect account.",
    };
  }
  if (input.stripeConnectReady) {
    return {
      rail: "stripe",
      countryCode,
      collectionProviderCode: collection,
      showStripe: true,
      showProvider: false,
      reason: "No corridor rail; Stripe Connect is enabled.",
    };
  }
  if (input.providerReady) {
    return {
      rail: "provider",
      countryCode,
      collectionProviderCode: collection,
      showStripe: false,
      showProvider: true,
      reason: "No corridor rail; connected-account provider is enabled.",
    };
  }
  return {
    rail: "none",
    countryCode,
    collectionProviderCode: collection,
    showStripe: false,
    showProvider: false,
    reason: "No payout onboarding rail is ready.",
  };
}

export async function resolvePayoutOnboardingRail(input: {
  locationCountry?: string | null;
  stripeConnectReady: boolean;
  providerReady: boolean;
  hasStripeConnectAccount: boolean;
  hasProviderAccount: boolean;
}): Promise<PayoutOnboardingChoice> {
  await ensureCountryActivationCorridors();
  const countryCode = countryCodeFromLocation(input.locationCountry ?? null);
  const corridor = countryCode
    ? await prisma.countryActivationCorridor.findUnique({ where: { countryCode } })
    : null;
  return choosePayoutOnboardingRail({
    countryCode,
    corridorActive: Boolean(corridor?.active),
    collectionProviderCode: corridor?.collectionProviderCode,
    stripeConnectReady: input.stripeConnectReady,
    providerReady: input.providerReady,
    hasStripeConnectAccount: input.hasStripeConnectAccount,
    hasProviderAccount: input.hasProviderAccount,
  });
}
