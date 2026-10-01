import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { NextRequest } from "next/server";
import { POST } from "@/app/api/marketplace/webhook/route";
import { resolveFee } from "./collaboration-fees";
import { prisma } from "./db";
import { listAttributionSources } from "./deal-attribution";
import { convertFee, quoteFx, readFxSnapshot, readShareSnapshot, shareLines } from "./fx-share";
import { ledgerMovements, marketplaceSignature, reconcileLedger } from "./ledger";
import { applyMarketplaceEvent, requestPrefund } from "./marketplace-ledger";
import { encryptSecret } from "./provider-secrets";
import { listRevenueParties, saveRevenueParties } from "./settlement";
import { setWiseTransportForTests } from "./wise-quote";

describe("admin FX and revenue shares", () => {
  it("keeps USD as identity and converts other currencies with a saved rate", () => {
    const usd = quoteFx({ usdCents: 10_000, currency: "usd", minorPerUsd: null });
    assert.equal(usd.ok, true);
    if (usd.ok) {
      assert.equal(usd.convertedMinor, 10_000);
      assert.equal(usd.minorPerUsd, 100);
      assert.equal(usd.source, "identity");
    }
    const gbp = quoteFx({ usdCents: 10_000, currency: "GBP", minorPerUsd: 75 });
    assert.equal(gbp.ok, true);
    if (gbp.ok) assert.equal(gbp.convertedMinor, 7_500);
    const missing = quoteFx({ usdCents: 10_000, currency: "GBP", minorPerUsd: null });
    assert.equal(missing.ok, false);
    if (!missing.ok) assert.match(missing.error, /No admin FX rate/);
    assert.equal(convertFee(1_000, { currency: "GBP", minorPerUsd: 75 }), 750);
    assert.equal(convertFee(1_000, { currency: "USD", minorPerUsd: 100 }), 1_000);
  });

  it("splits a release into share lines that reconcile ignores", () => {
    const lines = shareLines(7_500, [
      { label: "Creator", shareBps: 8000 },
      { label: "Platform", shareBps: 2000 },
    ]);
    assert.ok(lines);
    assert.equal(lines?.reduce((sum, line) => sum + line.amountCents, 0), 7_500);
    const ledger = reconcileLedger(
      ledgerMovements([
        { kind: "hold", amountCents: 7_500 },
        { kind: "release", amountCents: 2_500 },
        { kind: "share", amountCents: 2_000 },
        { kind: "share", amountCents: 500 },
      ]),
      7_500,
    );
    assert.equal(ledger.heldCents, 5_000);
    assert.equal(ledger.releasedCents, 2_500);
    assert.equal(ledger.balanced, true);
  });
});

describe("marketplace FX prefund", () => {
  it("freezes the GB rate and posts share lines only on release", async () => {
    const provider = await prisma.integrationProvider.findUnique({
      where: { kind_code: { kind: "marketplace", code: "primary" } },
    });
    const gbp = await prisma.fxRate.findUnique({ where: { currency: "GBP" } });
    const parties = await listRevenueParties();
    const sources = await listAttributionSources();
    const source = sources.find((row) => row.active);
    const wise = await prisma.integrationProvider.findUnique({
      where: { kind_code: { kind: "fx", code: "wise" } },
    });
    if (!source || parties.length === 0) throw new Error("attribution or revenue parties are missing");
    const ids: string[] = [];
    try {
      await prisma.fxRate.upsert({
        where: { currency: "GBP" },
        update: { minorPerUsd: 75, active: true },
        create: { currency: "GBP", minorPerUsd: 75, active: true },
      });
      await prisma.integrationProvider.update({
        where: { kind_code: { kind: "marketplace", code: "primary" } },
        data: { enabled: true, webhookCipher: provider?.webhookCipher ?? "v1.dGVzdC1pdi1wYWRk.dGVzdC10YWc.dGVzdA" },
      });
      await prisma.integrationProvider.upsert({
        where: { kind_code: { kind: "fx", code: "wise" } },
        update: { enabled: false },
        create: { kind: "fx", code: "wise", name: "Wise", enabled: false, baseUrl: "https://api.wise.com" },
      });
      const titled = { title: { startsWith: "GB rate missing" } };
      const beforeReady = await prisma.collaborationFunding.count({ where: titled });
      const notReady = await requestPrefund({
        jurisdictionCode: "GB",
        businessName: "Harbor Co",
        creatorSlug: "sofia-martinez",
        title: "GB rate missing",
        grossCents: 10_000,
        sourceId: source.id,
      });
      assert.equal(notReady.ok, false);
      if (!notReady.ok) assert.match(notReady.error, /Wise is not ready/);
      assert.equal(await prisma.collaborationFunding.count({ where: titled }), beforeReady);

      await prisma.fxRate.update({ where: { currency: "GBP" }, data: { active: false } });
      await prisma.integrationProvider.upsert({
        where: { kind_code: { kind: "fx", code: "wise" } },
        update: {
          enabled: true,
          baseUrl: "https://api.wise.com",
          secretCipher: encryptSecret("wise-test-token"),
          extraJson: { profileId: "101", apiVersion: "v3" },
        },
        create: {
          kind: "fx",
          code: "wise",
          name: "Wise",
          enabled: true,
          baseUrl: "https://api.wise.com",
          secretCipher: encryptSecret("wise-test-token"),
          extraJson: { profileId: "101", apiVersion: "v3" },
        },
      });
      const beforeInactive = await prisma.collaborationFunding.count({ where: titled });
      const inactive = await requestPrefund({
        jurisdictionCode: "GB",
        businessName: "Harbor Co",
        creatorSlug: "sofia-martinez",
        title: "GB rate missing",
        grossCents: 10_000,
        sourceId: source.id,
      });
      assert.equal(inactive.ok, false);
      if (!inactive.ok) assert.match(inactive.error, /No Wise currency/);
      assert.equal(await prisma.collaborationFunding.count({ where: titled }), beforeInactive);
      await prisma.fxRate.update({ where: { currency: "GBP" }, data: { active: true, minorPerUsd: 75 } });

      let wiseCalls = 0;
      setWiseTransportForTests(async (url, init) => {
        wiseCalls += 1;
        assert.match(String(url), /^https:\/\/api\.wise\.com\/v3\/profiles\/101\/quotes$/);
        assert.equal(init?.redirect, "manual");
        const headers = new Headers(init?.headers);
        assert.equal(headers.get("authorization"), "Bearer wise-test-token");
        return new Response(
          JSON.stringify({
            id: "quote-gb-1",
            sourceCurrency: "USD",
            targetCurrency: "GBP",
            rate: 0.75,
            rateType: "FIXED",
            createdTime: "2026-09-30T12:00:00Z",
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      });
      const created = await requestPrefund({
        jurisdictionCode: "GB",
        businessName: "Harbor Co",
        creatorSlug: "sofia-martinez",
        title: "GB launch",
        grossCents: 10_000,
        sourceId: source.id,
      });
      assert.equal(created.ok, true);
      if (!created.ok) return;
      ids.push(created.id);
      const row = await prisma.collaborationFunding.findUnique({
        where: { id: created.id },
        include: { milestones: true },
      });
      if (!row) throw new Error("funding was not stored");
      const quote = await resolveFee({ jurisdiction: "GB", serviceLevel: "contracted", grossValueCents: 10_000 });
      assert.equal(row.grossCents, 7_500);
      assert.equal(row.currency, "GBP");
      assert.equal(row.providerCode, "primary");
      assert.equal(row.feeCents, convertFee(quote.feeCents, { currency: "GBP", minorPerUsd: 75, rate: 0.75, minorDigits: 2 }));
      assert.equal(row.milestones.reduce((sum, milestone) => sum + milestone.amountCents, 0), 7_500);
      const fx = readFxSnapshot(row.fxSnapshotJson);
      assert.equal(fx?.minorPerUsd, 75);
      assert.equal(fx?.usdCents, 10_000);
      assert.equal(fx?.source, "wise");
      assert.equal(fx?.rate, 0.75);
      assert.equal(fx?.quoteId, "quote-gb-1");
      assert.equal(wiseCalls, 1);
      const frozenShares = readShareSnapshot(row.shareSnapshotJson);
      assert.equal(frozenShares?.[0]?.label, "Creator");

      await prisma.fxRate.update({ where: { currency: "GBP" }, data: { minorPerUsd: 80 } });
      await saveRevenueParties(
        parties.map((party) => ({
          id: party.id,
          label: `${party.label} later`,
          sharePercent: party.shareBps / 100,
          active: party.active,
        })),
      );
      const frozen = await prisma.collaborationFunding.findUnique({ where: { id: row.id } });
      assert.equal(readFxSnapshot(frozen?.fxSnapshotJson)?.minorPerUsd, 75);
      assert.equal(readFxSnapshot(frozen?.fxSnapshotJson)?.rate, 0.75);
      assert.equal(frozen?.grossCents, 7_500);
      setWiseTransportForTests(async () => new Response("no", { status: 503 }));
      const failed = await requestPrefund({
        jurisdictionCode: "GB",
        businessName: "Harbor Co",
        creatorSlug: "sofia-martinez",
        title: "GB quote failed",
        grossCents: 10_000,
        sourceId: source.id,
      });
      assert.equal(failed.ok, false);
      if (!failed.ok) assert.match(failed.error, /did not return a user rate/);
      assert.equal(await prisma.collaborationFunding.count({ where: { title: "GB quote failed" } }), 0);
      assert.equal(readShareSnapshot(frozen?.shareSnapshotJson)?.[0]?.label, "Creator");

      const wrong = await applyMarketplaceEvent({
        provider: "primary",
        eventId: `hold-usd-${row.id}`,
        eventType: "funding.held",
        fundingId: row.id,
        amountCents: 10_000,
      });
      assert.equal(wrong.applied, false);
      assert.equal(wrong.result, "rejected");
      const held = await applyMarketplaceEvent({
        provider: "primary",
        eventId: `hold-${row.id}`,
        eventType: "funding.held",
        fundingId: row.id,
        amountCents: 7_500,
      });
      assert.equal(held.applied, true);
      const milestone = row.milestones[0];
      await prisma.fundingMilestone.update({ where: { id: milestone.id }, data: { status: "approved" } });
      const release = await applyMarketplaceEvent({
        provider: "primary",
        eventId: `release-${row.id}`,
        eventType: "payout.released",
        fundingId: row.id,
        amountCents: milestone.amountCents,
        milestoneId: milestone.id,
      });
      assert.equal(release.applied, true);
      const finished = await prisma.collaborationFunding.findUnique({
        where: { id: row.id },
        include: { entries: true },
      });
      const shareEntries = finished?.entries.filter((entry) => entry.kind === "share") ?? [];
      assert.equal(shareEntries.reduce((sum, entry) => sum + entry.amountCents, 0), milestone.amountCents);
      assert.equal(shareEntries.some((entry) => entry.party.includes("later")), false);
      const ledger = reconcileLedger(ledgerMovements(finished?.entries ?? []), 7_500);
      assert.equal(ledger.releasedCents, milestone.amountCents);
      assert.equal(ledger.heldCents, 7_500 - milestone.amountCents);
      assert.equal(ledger.balanced, true);
    } finally {
      setWiseTransportForTests(null);
      if (ids.length) {
        await prisma.processedWebhook.deleteMany({
          where: { OR: ids.map((id) => ({ eventId: { contains: id } })) },
        });
        await prisma.collaborationFunding.deleteMany({ where: { id: { in: ids } } });
      }
      await prisma.collaborationFunding.deleteMany({ where: { title: { in: ["GB rate missing", "GB launch", "GB quote failed"] } } });
      if (wise) {
        await prisma.integrationProvider.update({
          where: { id: wise.id },
          data: {
            enabled: wise.enabled,
            secretCipher: wise.secretCipher,
            baseUrl: wise.baseUrl,
            extraJson: wise.extraJson ?? undefined,
            name: wise.name,
          },
        });
      } else {
        await prisma.integrationProvider.deleteMany({ where: { kind: "fx", code: "wise" } });
      }
      await prisma.fxRate.upsert({
        where: { currency: "GBP" },
        update: { minorPerUsd: gbp?.minorPerUsd ?? 75, active: gbp?.active ?? true },
        create: { currency: "GBP", minorPerUsd: gbp?.minorPerUsd ?? 75, active: gbp?.active ?? true },
      });
      if (parties.length) {
        await saveRevenueParties(
          parties.map((party) => ({
            id: party.id,
            label: party.label,
            sharePercent: party.shareBps / 100,
            active: party.active,
          })),
        );
      }
      if (provider) {
        await prisma.integrationProvider.update({
          where: { id: provider.id },
          data: { enabled: provider.enabled, webhookCipher: provider.webhookCipher, name: provider.name },
        });
      }
    }
  });

  it("uses the jurisdiction provider and accepts only that webhook secret", async () => {
    const primary = await prisma.integrationProvider.findUnique({
      where: { kind_code: { kind: "marketplace", code: "primary" } },
    });
    const sources = await listAttributionSources();
    const source = sources.find((row) => row.active);
    if (!source || !primary) throw new Error("marketplace provider is missing");
    const ids: string[] = [];
    const harborSecret = "harbor-webhook-secret";
    const primarySecret = "primary-webhook-secret";
    try {
      await prisma.integrationProvider.create({
        data: { kind: "marketplace", code: "harbor", name: "Harbor", enabled: false },
      });
      await prisma.collaborationJurisdiction.upsert({
        where: { code: "ZZ" },
        update: {
          label: "Test zone",
          protectedPaymentsEnabled: true,
          escrowTermAllowed: false,
          currency: "USD",
          providerCode: "harbor",
        },
        create: {
          code: "ZZ",
          label: "Test zone",
          protectedPaymentsEnabled: true,
          escrowTermAllowed: false,
          currency: "USD",
          providerCode: "harbor",
        },
      });
      const harborTitle = { title: { startsWith: "Harbor while off" } };
      const before = await prisma.collaborationFunding.count({ where: harborTitle });
      const refused = await requestPrefund({
        jurisdictionCode: "ZZ",
        businessName: "Harbor Co",
        creatorSlug: "sofia-martinez",
        title: "Harbor while off",
        grossCents: 5_000,
        sourceId: source.id,
      });
      assert.equal(refused.ok, false);
      if (!refused.ok) assert.match(refused.error, /not ready/);
      assert.equal(await prisma.collaborationFunding.count({ where: harborTitle }), before);

      await prisma.integrationProvider.update({
        where: { kind_code: { kind: "marketplace", code: "harbor" } },
        data: { enabled: true, webhookCipher: encryptSecret(harborSecret) },
      });
      await prisma.integrationProvider.update({
        where: { kind_code: { kind: "marketplace", code: "primary" } },
        data: { enabled: true, webhookCipher: encryptSecret(primarySecret) },
      });
      const funding = await prisma.collaborationFunding.create({
        data: {
          jurisdictionCode: "ZZ",
          businessName: "Harbor Co",
          creatorSlug: "sofia-martinez",
          title: "Harbor prefund",
          currency: "USD",
          grossCents: 5_000,
          feeCents: 0,
          feeSnapshotJson: { feeCents: 0 },
          serviceLevel: "contracted",
          status: "awaiting_provider",
          providerCode: "harbor",
          milestones: {
            create: [{ title: "Only", amountCents: 5_000, sortOrder: 1, status: "pending", reviewWindowHours: 72 }],
          },
        },
      });
      ids.push(funding.id);
      const body = JSON.stringify({
        id: `hold-${funding.id}`,
        type: "funding.held",
        fundingId: funding.id,
        amountCents: 5_000,
        provider: "harbor",
      });
      const wrong = await POST(
        new NextRequest("http://127.0.0.1/api/marketplace/webhook", {
          method: "POST",
          body,
          headers: { "x-influrios-signature": marketplaceSignature(body, primarySecret) },
        }),
      );
      assert.equal(wrong.status, 401);
      const unknown = await POST(
        new NextRequest("http://127.0.0.1/api/marketplace/webhook", {
          method: "POST",
          body: JSON.stringify({ id: "missing", type: "funding.held", fundingId: funding.id, amountCents: 1, provider: "missing-provider" }),
          headers: { "x-influrios-signature": "abc" },
        }),
      );
      assert.equal(unknown.status, 404);
      const accepted = await POST(
        new NextRequest("http://127.0.0.1/api/marketplace/webhook", {
          method: "POST",
          body,
          headers: {
            "x-influrios-signature": marketplaceSignature(body, harborSecret),
            "x-influrios-provider": "harbor",
          },
        }),
      );
      assert.equal(accepted.status, 200);
      const payload = (await accepted.json()) as { applied?: boolean };
      assert.equal(payload.applied, true);
      const stored = await prisma.collaborationFunding.findUnique({ where: { id: funding.id } });
      assert.equal(stored?.status, "held");

      const primaryFunding = await prisma.collaborationFunding.create({
        data: {
          jurisdictionCode: "US",
          businessName: "Harbor Co",
          creatorSlug: "sofia-martinez",
          title: "Primary prefund",
          currency: "USD",
          grossCents: 4_000,
          feeCents: 0,
          feeSnapshotJson: { feeCents: 0 },
          serviceLevel: "contracted",
          status: "awaiting_provider",
          providerCode: "primary",
          milestones: {
            create: [{ title: "Only", amountCents: 4_000, sortOrder: 1, status: "pending", reviewWindowHours: 72 }],
          },
        },
      });
      ids.push(primaryFunding.id);
      const primaryBody = JSON.stringify({
        id: `hold-${primaryFunding.id}`,
        type: "funding.held",
        fundingId: primaryFunding.id,
        amountCents: 4_000,
      });
      const primaryAccepted = await POST(
        new NextRequest("http://127.0.0.1/api/marketplace/webhook", {
          method: "POST",
          body: primaryBody,
          headers: { "x-influrios-signature": marketplaceSignature(primaryBody, primarySecret) },
        }),
      );
      assert.equal(primaryAccepted.status, 200);
    } finally {
      if (ids.length) {
        await prisma.processedWebhook.deleteMany({
          where: { OR: ids.map((id) => ({ eventId: { contains: id } })) },
        });
        await prisma.collaborationFunding.deleteMany({ where: { id: { in: ids } } });
      }
      await prisma.collaborationFunding.deleteMany({
        where: { title: { in: ["Harbor while off", "Harbor prefund", "Primary prefund"] } },
      });
      await prisma.collaborationJurisdiction.deleteMany({ where: { code: "ZZ" } });
      await prisma.integrationProvider.deleteMany({ where: { kind: "marketplace", code: "harbor" } });
      await prisma.integrationProvider.update({
        where: { id: primary.id },
        data: { enabled: primary.enabled, webhookCipher: primary.webhookCipher, name: primary.name },
      });
    }
  });
});
