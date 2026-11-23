import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { prisma } from "./db";
import { setStripeTransportForTests } from "./stripe-admin";
import { releaseMilestoneOnStripe, settleFeesToOperations, transferBody } from "./stripe-release";

describe("Stripe transfer body", () => {
  it("ties the transfer to the original charge and the deal", () => {
    const body = transferBody({
      amountCents: 142_800,
      currency: "USD",
      destination: "acct_influencer1",
      chargeId: "ch_123",
      fundingId: "fund_1",
      milestoneId: "ms_1",
      purpose: "influencer_payout",
    });
    assert.equal(body.get("amount"), "142800");
    assert.equal(body.get("currency"), "usd");
    assert.equal(body.get("destination"), "acct_influencer1");
    assert.equal(body.get("source_transaction"), "ch_123");
    assert.equal(body.get("transfer_group"), "fund_1");
    assert.equal(body.get("metadata[purpose]"), "influencer_payout");
    assert.throws(() => transferBody({ amountCents: 0, currency: "USD", destination: "acct_x1", chargeId: "ch_1", fundingId: "f", milestoneId: "m", purpose: "platform_fees" }));
    assert.throws(() => transferBody({ amountCents: 5, currency: "USD", destination: "bank_1", chargeId: "ch_1", fundingId: "f", milestoneId: "m", purpose: "platform_fees" }));
    assert.throws(() => transferBody({ amountCents: 5, currency: "USD", destination: "acct_x1", chargeId: "", fundingId: "f", milestoneId: "m", purpose: "platform_fees" }));
  });
});

describe("milestone release on Stripe", () => {
  it("pays the influencer from collaboration funds and moves that milestone's fees to Operations", async (t) => {
    if (!process.env.DATABASE_URL) return t.skip("no database");
    const stamp = Date.now().toString(36);
    const previousKey = process.env.STRIPE_SECRET_KEY;
    process.env.STRIPE_SECRET_KEY = "sk_test_releaseflow";
    const transfers: { destination: string; amount: number; key: string }[] = [];
    setStripeTransportForTests(async (url, init) => {
      const href = String(url);
      if (href.includes("/v1/accounts/")) {
        return new Response(JSON.stringify({ id: "acct_influencerTest", payouts_enabled: true, details_submitted: true, requirements: { currently_due: [] } }), { status: 200 });
      }
      if (href.includes("/v1/checkout/sessions/")) {
        return new Response(JSON.stringify({ id: "cs_test_rel", payment_intent: { id: "pi_1", latest_charge: "ch_rel1" } }), { status: 200 });
      }
      if (href.endsWith("/v1/transfers")) {
        const body = new URLSearchParams(String(init?.body ?? ""));
        const key = String((init?.headers as Record<string, string>)?.["Idempotency-Key"] ?? "");
        transfers.push({ destination: body.get("destination") ?? "", amount: Number(body.get("amount")), key });
        return new Response(JSON.stringify({ id: `tr_${stamp}_${transfers.length}`, object: "transfer" }), { status: 200 });
      }
      return new Response(JSON.stringify({ error: { message: "unexpected" } }), { status: 404 });
    });
    const creator = await prisma.creator.create({ data: { slug: `rel-${stamp}`, displayName: "Release Test" } as never });
    await prisma.influencerPayoutProfile.create({ data: { creatorId: creator.id, stripeConnectAccountId: "acct_influencerTest" } as never });
    await prisma.marketplaceSettings.upsert({
      where: { id: "default" },
      update: { operationsStripeAccountId: "acct_operationsTest" },
      create: { id: "default", reviewWindowHours: 72, operationsStripeAccountId: "acct_operationsTest" },
    });
    const signedQuote = {
      businessPaysCents: 100_000,
      influencerReceivesCents: 80_000,
      businessPlatformFeeCents: 10_000,
      influencerPlatformFeeCents: 10_000,
      businessTaxCents: 0,
      influencerTaxCents: 0,
      milestoneAllocations: [
        { grossCents: 40_000, businessCollaborationFeeCents: 4_000, influencerFeeCents: 4_000, influencerNetCents: 32_000 },
        { grossCents: 60_000, businessCollaborationFeeCents: 6_000, influencerFeeCents: 6_000, influencerNetCents: 48_000 },
      ],
    };
    const funding = await prisma.collaborationFunding.create({
      data: {
        jurisdictionCode: "US",
        businessName: "Release Test Co",
        creatorSlug: creator.slug,
        title: "Release flow",
        grossCents: 100_000,
        feeCents: 20_000,
        feeSnapshotJson: { financialPlan: { signedQuote } },
        serviceLevel: "contracted",
        providerCode: "stripe",
        status: "awaiting_provider",
        milestones: {
          create: [
            { title: "Draft", amountCents: 32_000, sortOrder: 0, status: "release_scheduled", reviewWindowHours: 72 },
            { title: "Live", amountCents: 48_000, sortOrder: 1, status: "pending", reviewWindowHours: 72 },
          ],
        },
        deposits: { create: { method: "card", status: "confirmed", amountCents: 100_000, currency: "USD", reference: "cs_test_rel", confirmedAt: new Date() } },
      },
      include: { milestones: { orderBy: { sortOrder: "asc" } } },
    });
    try {
      const { applyMarketplaceEvent } = await import("./marketplace-ledger");
      const held = await applyMarketplaceEvent({ provider: "stripe", eventId: `held_${stamp}`, eventType: "funding.held", fundingId: funding.id, amountCents: 100_000, currency: "USD" });
      assert.equal(held.applied, true, JSON.stringify(held));

      const first = funding.milestones[0]!;
      const result = await releaseMilestoneOnStripe({ fundingId: funding.id, milestoneId: first.id, amountCents: 32_000 });
      assert.equal(result.ok, true, JSON.stringify(result));

      assert.deepEqual(
        transfers.map((row) => [row.destination, row.amount]),
        [
          ["acct_influencerTest", 32_000],
          ["acct_operationsTest", 8_000],
        ],
      );
      const entries = await prisma.ledgerEntry.findMany({ where: { fundingId: funding.id } });
      const total = (kind: string) => entries.filter((row) => row.kind === kind).reduce((sum, row) => sum + row.amountCents, 0);
      assert.equal(total("release"), 32_000);
      assert.equal(total("fee_settled"), 8_000);
      assert.equal(entries.filter((row) => row.kind === "fee_settled").every((row) => row.accountPurpose === "OPERATIONS"), true);
      const milestone = await prisma.fundingMilestone.findUnique({ where: { id: first.id } });
      assert.equal(milestone?.status, "released");

      // Nothing more is due, so a retry sends nothing.
      const again = await settleFeesToOperations({ fundingId: funding.id, milestoneId: first.id });
      assert.equal(again.ok && again.settledCents, 0);
      assert.equal(transfers.length, 2);
    } finally {
      setStripeTransportForTests(null);
      if (previousKey === undefined) delete process.env.STRIPE_SECRET_KEY;
      else process.env.STRIPE_SECRET_KEY = previousKey;
      await prisma.marketplaceSettings.update({ where: { id: "default" }, data: { operationsStripeAccountId: "" } }).catch(() => undefined);
      await prisma.collaborationFunding.delete({ where: { id: funding.id } }).catch(() => undefined);
      await prisma.creator.delete({ where: { id: creator.id } }).catch(() => undefined);
    }
  });
  it("the release sweep sends a real Stripe deal to Stripe even when it has a settlement record", async (t) => {
    if (!process.env.DATABASE_URL) return t.skip("no database");
    const stamp = Date.now().toString(36);
    const previousKey = process.env.STRIPE_SECRET_KEY;
    process.env.STRIPE_SECRET_KEY = "sk_test_releaseflow";
    const transfers: { destination: string; amount: number; key: string }[] = [];
    setStripeTransportForTests(async (url, init) => {
      const href = String(url);
      if (href.includes("/v1/accounts/")) {
        return new Response(JSON.stringify({ id: "acct_influencerTest", payouts_enabled: true, details_submitted: true, requirements: { currently_due: [] } }), { status: 200 });
      }
      if (href.includes("/v1/checkout/sessions/")) {
        return new Response(JSON.stringify({ id: "cs_test_rel", payment_intent: { id: "pi_1", latest_charge: "ch_rel1" } }), { status: 200 });
      }
      if (href.endsWith("/v1/transfers")) {
        const body = new URLSearchParams(String(init?.body ?? ""));
        const key = String((init?.headers as Record<string, string>)?.["Idempotency-Key"] ?? "");
        transfers.push({ destination: body.get("destination") ?? "", amount: Number(body.get("amount")), key });
        return new Response(JSON.stringify({ id: `tr_${stamp}_${transfers.length}`, object: "transfer" }), { status: 200 });
      }
      return new Response(JSON.stringify({ error: { message: "unexpected" } }), { status: 404 });
    });
    const creator = await prisma.creator.create({ data: { slug: `rel-${stamp}`, displayName: "Release Test" } as never });
    await prisma.influencerPayoutProfile.create({ data: { creatorId: creator.id, stripeConnectAccountId: "acct_influencerTest" } as never });
    await prisma.marketplaceSettings.upsert({
      where: { id: "default" },
      update: { operationsStripeAccountId: "acct_operationsTest" },
      create: { id: "default", reviewWindowHours: 72, operationsStripeAccountId: "acct_operationsTest" },
    });
    const signedQuote = {
      businessPaysCents: 100_000,
      influencerReceivesCents: 80_000,
      businessPlatformFeeCents: 10_000,
      influencerPlatformFeeCents: 10_000,
      businessTaxCents: 0,
      influencerTaxCents: 0,
      milestoneAllocations: [
        { grossCents: 40_000, businessCollaborationFeeCents: 4_000, influencerFeeCents: 4_000, influencerNetCents: 32_000 },
        { grossCents: 60_000, businessCollaborationFeeCents: 6_000, influencerFeeCents: 6_000, influencerNetCents: 48_000 },
      ],
    };
    const funding = await prisma.collaborationFunding.create({
      data: {
        jurisdictionCode: "US",
        businessName: "Release Test Co",
        creatorSlug: creator.slug,
        title: "Release flow",
        grossCents: 100_000,
        feeCents: 20_000,
        feeSnapshotJson: { financialPlan: { signedQuote } },
        serviceLevel: "contracted",
        providerCode: "stripe",
        status: "awaiting_provider",
        milestones: {
          create: [
            { title: "Draft", amountCents: 32_000, sortOrder: 0, status: "release_scheduled", reviewWindowHours: 72, releaseScheduledAt: new Date(Date.now() - 60_000), releaseApprovedAt: new Date() },
            { title: "Live", amountCents: 48_000, sortOrder: 1, status: "pending", reviewWindowHours: 72 },
          ],
        },
        deposits: { create: { method: "card", status: "confirmed", amountCents: 100_000, currency: "USD", reference: "cs_test_rel", confirmedAt: new Date() } },
      },
      include: { milestones: { orderBy: { sortOrder: "asc" } } },
    });
    try {
      const { applyMarketplaceEvent } = await import("./marketplace-ledger");
      const held = await applyMarketplaceEvent({ provider: "stripe", eventId: `held_${stamp}`, eventType: "funding.held", fundingId: funding.id, amountCents: 100_000, currency: "USD" });
      assert.equal(held.applied, true, JSON.stringify(held));

      const first = funding.milestones[0]!;
      // Signing writes a settlement record; a real Stripe deal must still go through Stripe.
      await prisma.milestoneSettlementV4.create({
        data: {
          fundingId: funding.id,
          milestoneId: first.id,
          currency: "USD",
          grossCents: 40_000,
          businessFeeCents: 4_000,
          influencerFeeCents: 4_000,
          influencerNetCents: 32_000,
          operationsFeeCents: 8_000,
          idempotencyKey: `settle-${stamp}`,
        },
      });
      // Approval also recorded the release command, with the older net-plus-fees total and nothing sent.
      const { providerOperationKey } = await import("./provider-outbox");
      await prisma.providerCommand.create({
        data: {
          operationKey: providerOperationKey({ agreementVersion: 1, fundingId: funding.id, milestoneId: first.id, operation: "release" }),
          fundingId: funding.id,
          milestoneId: first.id,
          agreementVersion: 1,
          operation: "release",
          amountCents: 40_000,
          currency: "USD",
          status: "pending",
          attemptCount: 0,
        },
      });
      const { runScheduledReleaseSweep } = await import("./jobs");
      const swept = await runScheduledReleaseSweep(new Date(), first.id);
      assert.equal(swept.requested, 1, "a payout Stripe completed counts as sent");

      assert.deepEqual(
        transfers.map((row) => [row.destination, row.amount]),
        [
          ["acct_influencerTest", 32_000],
          ["acct_operationsTest", 8_000],
        ],
      );
      const entries = await prisma.ledgerEntry.findMany({ where: { fundingId: funding.id } });
      const total = (kind: string) => entries.filter((row) => row.kind === kind).reduce((sum, row) => sum + row.amountCents, 0);
      assert.equal(total("release"), 32_000);
      assert.equal(total("fee_settled"), 8_000);
      assert.equal(entries.filter((row) => row.kind === "fee_settled").every((row) => row.accountPurpose === "OPERATIONS"), true);
      const milestone = await prisma.fundingMilestone.findUnique({ where: { id: first.id } });
      assert.equal(milestone?.status, "released");

    } finally {
      setStripeTransportForTests(null);
      if (previousKey === undefined) delete process.env.STRIPE_SECRET_KEY;
      else process.env.STRIPE_SECRET_KEY = previousKey;
      await prisma.marketplaceSettings.update({ where: { id: "default" }, data: { operationsStripeAccountId: "" } }).catch(() => undefined);
      await prisma.collaborationFunding.delete({ where: { id: funding.id } }).catch(() => undefined);
      await prisma.creator.delete({ where: { id: creator.id } }).catch(() => undefined);
    }
  });
});
