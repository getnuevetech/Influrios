import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildPayoutFeeFxQuote, PAYOUT_METHOD_LABELS } from "./payout-readiness";
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
});

describe("payout readiness corridors (db)", () => {
  it("seeds corridors and computes Global Payout Ready", async (t) => {
    if (!(await requireDb(t))) return;
    const {
      ensureCountryActivationCorridors,
      ensureInfluencerPayoutProfile,
      computePayoutReadiness,
      setInfluencerPayoutMethodStatus,
    } = await import("./payout-readiness");

    await ensureCountryActivationCorridors();
    const corridors = await prisma.countryActivationCorridor.findMany();
    assert.ok(corridors.length >= 8);
    assert.ok(corridors.some((row) => row.countryCode === "US" && row.active));
    assert.ok(corridors.some((row) => row.countryCode === "KE" && row.active));

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
      // Gateway may still block if Flutterwave secret missing — Global Ready needs route too.
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
