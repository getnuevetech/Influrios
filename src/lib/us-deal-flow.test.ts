import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { prisma } from "./db";
import { setStripeTransportForTests } from "./stripe-admin";

/**
 * The live US agreement end to end on the ledger: $500 compensation, $25 business fee (+$26.25 tax),
 * $12.50 influencer fee (+$0.63 tax), milestones 40% / 60%. Business pays $551.25.
 */
const signedQuote = {
  agreementVersion: 1,
  currency: "USD",
  minorDigits: 2,
  grossInfluencerCompensationCents: 50_000,
  businessPlatformFeeCents: 2_500,
  influencerPlatformFeeCents: 1_250,
  platformFeesTotalCents: 3_750,
  businessTaxCents: 2_625,
  influencerTaxCents: 63,
  withholdingCents: 0,
  businessPaysCents: 55_125,
  influencerReceivesCents: 48_687,
  milestoneCount: 2,
  milestoneAllocations: [
    { grossCents: 20_000, businessCollaborationFeeCents: 1_000, influencerFeeCents: 500, influencerNetCents: 19_475 },
    { grossCents: 30_000, businessCollaborationFeeCents: 1_500, influencerFeeCents: 750, influencerNetCents: 29_212 },
  ],
  feeState: "reserved",
};

describe("US signed deal: fund, hold, release to influencer and Operations", () => {
  it("collects $551.25, pays milestone 1 net to the influencer and its fees to Operations, and keeps tax held", async (t) => {
    if (!process.env.DATABASE_URL) return t.skip("no database");
    const stamp = Date.now().toString(36);
    const previousKey = process.env.STRIPE_SECRET_KEY;
    process.env.STRIPE_SECRET_KEY = "sk_test_usdeal";
    const transfers: { destination: string; amount: number }[] = [];
    setStripeTransportForTests(async (url, init) => {
      const href = String(url);
      if (href.includes("/v1/accounts/")) {
        return new Response(JSON.stringify({ id: "acct_x", payouts_enabled: true, details_submitted: true, requirements: { currently_due: [] } }), { status: 200 });
      }
      if (href.includes("/v1/checkout/sessions/")) {
        return new Response(JSON.stringify({ id: "cs_test_us", payment_intent: { id: "pi_us", latest_charge: "ch_us1" } }), { status: 200 });
      }
      if (href.endsWith("/v1/transfers")) {
        const body = new URLSearchParams(String(init?.body ?? ""));
        transfers.push({ destination: body.get("destination") ?? "", amount: Number(body.get("amount")) });
        return new Response(JSON.stringify({ id: `tr_${stamp}_${transfers.length}` }), { status: 200 });
      }
      return new Response(JSON.stringify({ error: { message: `unexpected ${href}` } }), { status: 404 });
    });
    const creator = await prisma.creator.create({ data: { slug: `us-${stamp}`, displayName: "US Influencer", locationCountry: "United States" } as never });
    await prisma.influencerPayoutProfile.create({ data: { creatorId: creator.id, stripeConnectAccountId: "acct_usInfluencer", primaryStatus: "VERIFIED" } as never });
    await prisma.marketplaceSettings.upsert({
      where: { id: "default" },
      update: { operationsStripeAccountId: "acct_usOperations" },
      create: { id: "default", reviewWindowHours: 72, operationsStripeAccountId: "acct_usOperations" },
    });
    // Local copy only: a US jurisdiction with protected payments and a ready marketplace provider, as on live.
    const { encryptSecret } = await import("./provider-secrets");
    const priorJurisdiction = await prisma.collaborationJurisdiction.findUnique({ where: { code: "US" } });
    const priorProvider = await prisma.integrationProvider.findUnique({ where: { kind_code: { kind: "marketplace", code: "primary" } } });
    await prisma.collaborationJurisdiction.upsert({
      where: { code: "US" },
      update: { protectedPaymentsEnabled: true, legalReviewStatus: "APPROVED", currency: "USD", providerCode: "primary" },
      create: { code: "US", label: "United States", protectedPaymentsEnabled: true, legalReviewStatus: "APPROVED", currency: "USD", providerCode: "primary", fullPrefundingEnabled: true },
    });
    await prisma.integrationProvider.upsert({
      where: { kind_code: { kind: "marketplace", code: "primary" } },
      update: { enabled: true, webhookCipher: encryptSecret("whsec_local_test") },
      create: { kind: "marketplace", code: "primary", name: "Primary marketplace", enabled: true, webhookCipher: encryptSecret("whsec_local_test") },
    });
    let fundingId = "";
    try {
      const { requestPrefund, applyMarketplaceEvent } = await import("./marketplace-ledger");
      const prefund = await requestPrefund({
        jurisdictionCode: "US",
        businessName: "US Test Co",
        creatorSlug: creator.slug,
        title: `US deal ${stamp}`,
        grossCents: 50_000,
        serviceLevel: "contracted",
        customMilestones: [
          { title: "Draft approved", shareBps: 4_000 },
          { title: "Reel and Stories live", shareBps: 6_000 },
        ],
        financialPlan: { signedQuote },
        idempotencyKey: `us-deal-${stamp}`,
      });
      assert.equal(prefund.ok, true, JSON.stringify(prefund));
      if (!prefund.ok) return;
      fundingId = prefund.id;
      const funding = await prisma.collaborationFunding.findUniqueOrThrow({
        where: { id: fundingId },
        include: { milestones: { orderBy: { sortOrder: "asc" } } },
      });
      assert.equal(funding.grossCents, 55_125, "the business is charged $551.25");
      const amounts = funding.milestones.map((row) => row.amountCents);
      assert.equal(amounts[0]! + amounts[1]!, 48_687, "milestones pay the influencer's $486.87 net, split 40/60");
      const firstNet = amounts[0]!;

      await prisma.fundingDeposit.create({
        data: { fundingId, method: "card", status: "confirmed", amountCents: 55_125, currency: "USD", reference: "cs_test_us", confirmedAt: new Date() },
      });
      const held = await applyMarketplaceEvent({ provider: funding.providerCode, eventId: `held_${stamp}`, eventType: "funding.held", fundingId, amountCents: 55_125, currency: "USD" });
      assert.equal(held.applied, true, JSON.stringify(held));

      const first = funding.milestones[0]!;
      await prisma.fundingMilestone.update({ where: { id: first.id }, data: { status: "release_scheduled" } });
      const { releaseMilestoneOnStripe } = await import("./stripe-release");
      const released = await releaseMilestoneOnStripe({ fundingId, milestoneId: first.id, amountCents: firstNet });
      assert.equal(released.ok, true, JSON.stringify(released));
      assert.deepEqual(transfers, [
        { destination: "acct_usInfluencer", amount: firstNet },
        { destination: "acct_usOperations", amount: 1_500 },
      ]);

      const { loadContractLedger } = await import("./contract-ledger");
      const { rows } = await loadContractLedger({ q: stamp });
      const row = rows[0]!;
      assert.equal(row.collectedCents, 55_125);
      assert.equal(row.taxesCents, 2_688);
      assert.equal(row.paidToInfluencerCents, firstNet);
      assert.equal(row.platformRetainedCents, 1_500);
      assert.equal(row.heldCents, 55_125 - 2_688 - 1_500 - firstNet);
    } finally {
      if (priorJurisdiction) {
        const { code: _code, updatedAt: _updated, ...restore } = priorJurisdiction;
        await prisma.collaborationJurisdiction.update({ where: { code: "US" }, data: restore }).catch(() => undefined);
      } else {
        await prisma.collaborationJurisdiction.delete({ where: { code: "US" } }).catch(() => undefined);
      }
      if (priorProvider) {
        await prisma.integrationProvider
          .update({ where: { id: priorProvider.id }, data: { enabled: priorProvider.enabled, webhookCipher: priorProvider.webhookCipher } })
          .catch(() => undefined);
      }
      setStripeTransportForTests(null);
      if (previousKey === undefined) delete process.env.STRIPE_SECRET_KEY;
      else process.env.STRIPE_SECRET_KEY = previousKey;
      await prisma.marketplaceSettings.update({ where: { id: "default" }, data: { operationsStripeAccountId: "" } }).catch(() => undefined);
      if (fundingId) await prisma.collaborationFunding.delete({ where: { id: fundingId } }).catch(() => undefined);
      await prisma.creator.delete({ where: { id: creator.id } }).catch(() => undefined);
    }
  });
});
