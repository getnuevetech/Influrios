import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import {
  buildPayoutFeeFxQuote,
  choosePayoutOnboardingRail,
  PAYOUT_METHOD_LABELS,
  payoutProfileCurrency,
  primaryMethodFromCorridor,
} from "./payout-readiness";
import { prisma } from "./db";

const hasDbUrl = Boolean(process.env.DATABASE_URL);

async function requireDb(t: { skip: (msg?: string) => void }) {
  if (!hasDbUrl) {
    t.skip("DATABASE_URL not set");
    return false;
  }
  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch {
    t.skip("Postgres not reachable");
    return false;
  }
}

describe("buildPayoutFeeFxQuote", () => {
  it("returns net after fee with no FX when currencies match", () => {
    const result = buildPayoutFeeFxQuote({
      creatorGrossCents: 10_000,
      platformFeeCents: 750,
      fundingCurrency: "USD",
      payoutCurrency: "USD",
    });
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.quote.creatorNetCents, 9_250);
    assert.equal(result.quote.payoutMinor, 9_250);
    assert.equal(result.quote.fxApplied, false);
  });

  it("applies admin FX when payout currency differs", () => {
    const result = buildPayoutFeeFxQuote({
      creatorGrossCents: 10_000,
      platformFeeCents: 0,
      fundingCurrency: "USD",
      payoutCurrency: "KES",
      minorPerUsd: 13_000, // 130.00 KES per USD in minor×100 style via quoteFx
    });
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.quote.fxApplied, true);
    assert.equal(result.quote.fxSource, "admin");
    assert.ok(result.quote.payoutMinor > 0);
  });

  it("rejects fee larger than gross", () => {
    const result = buildPayoutFeeFxQuote({
      creatorGrossCents: 100,
      platformFeeCents: 200,
      fundingCurrency: "USD",
      payoutCurrency: "USD",
    });
    assert.equal(result.ok, false);
  });

  it("exposes friendly payout method labels", () => {
    assert.equal(PAYOUT_METHOD_LABELS.mpesa, "M-Pesa");
    assert.equal(PAYOUT_METHOD_LABELS.local_bank, "Local bank");
  });

  it("picks the primary method only from corridor config — never by country", () => {
    assert.equal(primaryMethodFromCorridor(["usd_bank", "local_bank"]), "usd_bank");
    assert.equal(primaryMethodFromCorridor(["flutterwave_payout"]), "flutterwave_payout");
    assert.equal(primaryMethodFromCorridor([]), null);
    assert.equal(primaryMethodFromCorridor(null), null);
    const source = readFileSync("src/lib/payout-readiness.ts", "utf8");
    assert.equal(source.includes('return "flutterwave_payout"'), false);
    assert.equal(source.includes('return "mpesa"'), false);
    assert.equal(source.includes("Seeded from default"), false);
    assert.equal(source.includes("DEFAULT_PAYMENT_ROUTES"), false);
    const providers = readFileSync("src/lib/providers.ts", "utf8");
    assert.equal(providers.includes("GATEWAY_SHELLS"), false);
    assert.equal(providers.includes('gateway: "flutterwave"'), false);
    assert.equal(providers.includes('gateway: "stripe"'), false);
    const payments = readFileSync("src/app/payments/page.tsx", "utf8");
    assert.match(payments, /JurisdictionPayoutMethodFields/);
  });

  it("uses the saved corridor currency, then the route, then the backup", () => {
    assert.equal(
      payoutProfileCurrency({ countryCode: "KE", corridorCurrency: "KES", fallbackCurrency: "USD" }),
      "KES",
    );
    assert.equal(
      payoutProfileCurrency({ countryCode: "KE", corridorCurrency: "EUR", fallbackCurrency: "USD" }),
      "EUR",
    );
    assert.equal(
      payoutProfileCurrency({ countryCode: "us", corridorCurrency: "USD", fallbackCurrency: "GBP" }),
      "USD",
    );
    assert.equal(
      payoutProfileCurrency({ countryCode: "US", corridorCurrency: "CAD", fallbackCurrency: "GBP" }),
      "CAD",
    );
    assert.equal(payoutProfileCurrency({ countryCode: "KE", corridorCurrency: null, fallbackCurrency: "EUR" }), "KES");
    // ISO country currency (not a baked payment gateway route).
    assert.equal(payoutProfileCurrency({ countryCode: "JP", corridorCurrency: null, fallbackCurrency: "USD" }), "JPY");
    assert.equal(payoutProfileCurrency({ countryCode: "JP", corridorCurrency: null, fallbackCurrency: "gbp" }), "JPY");
    assert.equal(payoutProfileCurrency({ countryCode: null, fallbackCurrency: "nope" }), "USD");
    assert.equal(payoutProfileCurrency({ countryCode: "", fallbackCurrency: null }), "USD");
    const source = readFileSync("src/lib/payout-readiness.ts", "utf8");
    assert.equal(source.includes('storedCurrencyCode(input.fallbackCurrency) ?? "USD"'), true);
    const page = readFileSync("src/app/admin/corridors/page.tsx", "utf8");
    assert.equal(page.includes("Backup currency"), true);
    assert.equal(page.includes("payoutFallbackCurrency"), true);
    const actions = readFileSync("src/app/admin/corridors/actions.ts", "utf8");
    assert.equal(actions.includes("savePayoutFallbackCurrency"), true);
  });
});

describe("choosePayoutOnboardingRail", () => {
  it("prefers the connected-account provider when the corridor collection route is that provider", () => {
    const choice = choosePayoutOnboardingRail({
      countryCode: "NG",
      corridorActive: true,
      collectionProviderCode: "airwallex",
      stripeConnectReady: true,
      providerReady: true,
      hasStripeConnectAccount: false,
      hasProviderAccount: false,
    });
    assert.equal(choice.rail, "provider");
    assert.equal(choice.showStripe, false);
    assert.equal(choice.showProvider, true);
    assert.equal(choice.emptyHint, null);
  });

  it("explains when the corridor is ready but provider credentials are not", () => {
    const choice = choosePayoutOnboardingRail({
      countryCode: "NG",
      corridorActive: true,
      collectionProviderCode: "airwallex",
      stripeConnectReady: true,
      providerReady: false,
      hasStripeConnectAccount: false,
      hasProviderAccount: false,
    });
    assert.equal(choice.rail, "none");
    assert.equal(choice.showProvider, false);
    assert.match(choice.emptyHint ?? "", /Payment gateways/i);
  });

  it("hides Stripe Connect for Flutterwave/M-Pesa corridors", () => {
    const choice = choosePayoutOnboardingRail({
      countryCode: "NG",
      corridorActive: true,
      collectionProviderCode: "flutterwave",
      stripeConnectReady: true,
      providerReady: true,
      hasStripeConnectAccount: false,
      hasProviderAccount: false,
    });
    assert.equal(choice.rail, "none");
    assert.equal(choice.showStripe, false);
    assert.equal(choice.showProvider, false);
  });

  it("uses Stripe when the corridor collection route is Stripe", () => {
    const choice = choosePayoutOnboardingRail({
      countryCode: "US",
      corridorActive: true,
      collectionProviderCode: "stripe",
      stripeConnectReady: true,
      providerReady: true,
      hasStripeConnectAccount: false,
      hasProviderAccount: false,
    });
    assert.equal(choice.rail, "stripe");
    assert.equal(choice.showStripe, true);
    assert.equal(choice.showProvider, false);
  });
});

describe("payout readiness corridors (db)", () => {
  it("uses admin-configured corridor methods and computes Global Payout Ready", async (t) => {
    if (!(await requireDb(t))) return;
    const {
      ensureInfluencerPayoutProfile,
      computePayoutReadiness,
      setInfluencerPayoutMethodStatus,
    } = await import("./payout-readiness");

    await prisma.countryActivationCorridor.upsert({
      where: { countryCode: "KE" },
      update: {
        active: true,
        currency: "KES",
        collectionProviderCode: null,
        payoutMethodsJson: ["mpesa", "local_bank"],
        holdingEnabled: true,
        fxEnabled: true,
        kycModel: "government_id",
        notes: "test corridor",
      },
      create: {
        countryCode: "KE",
        active: true,
        currency: "KES",
        collectionProviderCode: null,
        payoutMethodsJson: ["mpesa", "local_bank"],
        holdingEnabled: true,
        fxEnabled: true,
        kycModel: "government_id",
        notes: "test corridor",
      },
    });

    const slug = `p5-${Date.now().toString(36)}`;
    const creator = await prisma.creator.create({
      data: {
        slug,
        displayName: "P5 Tester",
        title: "Tester",
        bio: "P5 payout readiness",
        locationCountry: "Kenya",
        identityVerified: "VERIFIED",
        profileState: "VERIFIED",
        claimed: true,
      },
    });

    try {
      const profile = await ensureInfluencerPayoutProfile({
        creatorId: creator.id,
        locationCountry: creator.locationCountry,
      });
      assert.equal(profile.primaryMethod, "mpesa");
      assert.equal(profile.primaryStatus, "UNVERIFIED");
      assert.equal(profile.globalPayoutReady, false);

      // Sticky wrong method from another country must resync to this corridor.
      await prisma.influencerPayoutProfile.update({
        where: { creatorId: creator.id },
        data: { primaryMethod: "flutterwave_payout", primaryLabel: "Flutterwave payout", primaryStatus: "UNVERIFIED" },
      });
      const synced = await ensureInfluencerPayoutProfile({
        creatorId: creator.id,
        locationCountry: creator.locationCountry,
      });
      assert.equal(synced.primaryMethod, "mpesa");

      const blocked = await computePayoutReadiness({
        creatorId: creator.id,
        identityVerified: true,
        locationCountry: creator.locationCountry,
      });
      assert.equal(blocked.globalPayoutReady, false);
      assert.ok(blocked.blockers.some((b) => /verified payout method/i.test(b)));
      assert.equal(blocked.corridorActive, true);
      assert.equal(blocked.countryCode, "KE");

      await setInfluencerPayoutMethodStatus({
        creatorId: creator.id,
        which: "primary",
        status: "VERIFIED",
      });
      const ready = await computePayoutReadiness({
        creatorId: creator.id,
        identityVerified: true,
        locationCountry: creator.locationCountry,
      });
      if (ready.gateway?.ready) {
        assert.equal(ready.globalPayoutReady, true);
        assert.equal(ready.blockers.length, 0);
      } else {
        assert.equal(ready.hasVerifiedMethod, true);
        assert.equal(ready.globalPayoutReady, false);
        assert.ok(ready.blockers.some((b) => /route not ready|Payment route/i.test(b)));
      }
    } finally {
      await prisma.creator.delete({ where: { id: creator.id } }).catch(() => null);
    }
  });
});
