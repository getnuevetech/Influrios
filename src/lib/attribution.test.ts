import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  attributionExpiresAt,
  attributionWindowStart,
  canAttributeRepeat,
  canResolveAttributionClaim,
  normalizeAttributionExpiryDays,
  sameBusiness,
  serviceLevelForFeeResolution,
} from "./attribution";
import { prisma } from "./db";
import {
  fileAttributionClaim,
  listAttributionSources,
  resolveAttributionClaim,
  resolveDealAttribution,
  saveAttributionPolicy,
  saveAttributionSources,
} from "./deal-attribution";
import { requestPrefund } from "./marketplace-ledger";

const NOW = new Date("2026-09-30T12:00:00.000Z");

describe("deal attribution rules", () => {
  it("matches a business name without caring about case or extra spaces", () => {
    assert.equal(sameBusiness("Harbor Co", " harbor   co "), true);
    assert.equal(sameBusiness("Harbor Co", "Northwind"), false);
    assert.equal(sameBusiness("  ", "Harbor"), false);
  });

  it("never allows forever attribution expiry", () => {
    assert.throws(() => normalizeAttributionExpiryDays(0), /never forever/i);
    assert.throws(() => normalizeAttributionExpiryDays(Number.POSITIVE_INFINITY), /never forever/i);
    assert.equal(normalizeAttributionExpiryDays(90), 90);
    const expires = attributionExpiresAt(NOW, 30);
    assert.equal(expires.getTime(), NOW.getTime() + 30 * 24 * 60 * 60 * 1000);
  });

  it("maps fee service level away from managed modes for pre-existing attribution", () => {
    assert.equal(
      serviceLevelForFeeResolution({ requestedServiceLevel: "managed_intro", attributionStatus: "pre_existing" }),
      "contracted",
    );
    assert.equal(
      serviceLevelForFeeResolution({ requestedServiceLevel: "managed_intro", attributionStatus: "active" }),
      "managed_intro",
    );
  });

  it("resolves contest decisions only from open claims", () => {
    assert.equal(canResolveAttributionClaim({ status: "open", decision: "upheld" }).ok, true);
    assert.equal(canResolveAttributionClaim({ status: "upheld", decision: "rejected" }).ok, false);
  });

  it("repeats only a confirmed deal for the same parties inside the window and minimum", () => {
    const prior = {
      businessName: "Harbor Co",
      creatorSlug: "sofia-martinez",
      status: "held",
      grossCents: 20_000,
      createdAt: new Date("2026-09-01T12:00:00.000Z"),
    };
    const windowStart = attributionWindowStart(NOW, 90);
    assert.equal(
      canAttributeRepeat({
        prior,
        businessName: "harbor co",
        creatorSlug: "sofia-martinez",
        minGrossCents: 10_000,
        windowStart,
      }).ok,
      true,
    );
    assert.equal(
      canAttributeRepeat({
        prior: { ...prior, status: "awaiting_provider" },
        businessName: "Harbor Co",
        creatorSlug: "sofia-martinez",
        minGrossCents: 0,
        windowStart,
      }).ok,
      false,
    );
    assert.equal(
      canAttributeRepeat({
        prior: { ...prior, creatorSlug: "marcus-lee" },
        businessName: "Harbor Co",
        creatorSlug: "sofia-martinez",
        minGrossCents: 0,
        windowStart,
      }).ok,
      false,
    );
    assert.equal(
      canAttributeRepeat({
        prior,
        businessName: "Harbor Co",
        creatorSlug: "sofia-martinez",
        minGrossCents: 50_000,
        windowStart,
      }).ok,
      false,
    );
    assert.equal(
      canAttributeRepeat({
        prior,
        businessName: "Harbor Co",
        creatorSlug: "sofia-martinez",
        minGrossCents: 0,
        windowStart: attributionWindowStart(NOW, 10),
      }).ok,
      false,
    );
    assert.equal(
      canAttributeRepeat({
        prior: null,
        businessName: "Harbor Co",
        creatorSlug: "sofia-martinez",
        minGrossCents: 0,
        windowStart,
      }).ok,
      false,
    );
  });
});

async function createPrior(status: string, createdAt = new Date()) {
  return prisma.collaborationFunding.create({
    data: {
      jurisdictionCode: "US",
      businessName: "Harbor Co",
      creatorSlug: "sofia-martinez",
      title: "Original launch",
      grossCents: 20_000,
      feeCents: 2_000,
      feeSnapshotJson: { feeCents: 2_000, ruleId: "frozen-rule" },
      serviceLevel: "contracted",
      status,
      providerCode: "primary",
      attributionLabel: "Direct brief",
      attributionStatus: "active",
      attributionExpiresAt: attributionExpiresAt(createdAt, 90),
      createdAt,
    },
  });
}

describe("attribution contest workflow", () => {
  it("files and upholds a pre-existing claim, blocking managed intro fees", async () => {
    const sources = await listAttributionSources();
    const source = sources.find((row) => row.active && !/pre-?existing/i.test(row.label));
    if (!source) throw new Error("expected source");
    const filed = await fileAttributionClaim({
      businessName: "Harbor Co",
      creatorSlug: "sofia-martinez",
      evidence: "We worked together off-platform in 2024 on a brand launch.",
      filedBy: "business",
    });
    assert.equal(filed.ok, true);
    if (!filed.ok) return;
    try {
      const contested = await resolveDealAttribution({
        businessName: "Harbor Co",
        creatorSlug: "sofia-martinez",
        sourceId: source.id,
      });
      assert.equal(contested.ok, true);
      if (contested.ok) assert.equal(contested.attributionStatus, "contested");

      const upheld = await resolveAttributionClaim({
        claimId: filed.id,
        decision: "upheld",
        adminNote: "Evidence accepted",
      });
      assert.equal(upheld.ok, true);

      const after = await resolveDealAttribution({
        businessName: "Harbor Co",
        creatorSlug: "sofia-martinez",
        sourceId: source.id,
      });
      assert.equal(after.ok, true);
      if (after.ok) assert.equal(after.attributionStatus, "pre_existing");
      assert.equal(
        serviceLevelForFeeResolution({
          requestedServiceLevel: "managed_intro",
          attributionStatus: after.ok ? after.attributionStatus : "active",
        }),
        "contracted",
      );
    } finally {
      await prisma.attributionClaim.deleteMany({
        where: { businessName: "Harbor Co", creatorSlug: "sofia-martinez" },
      });
    }
  });
});

describe("repeat prefund attribution", () => {
  it("does not create a funding when the provider is not ready", async () => {
    const prior = await createPrior("held");
    const sources = await listAttributionSources();
    const source = sources.find((row) => row.active && !/pre-?existing/i.test(row.label));
    if (!source) throw new Error("expected an attribution source");
    try {
      const titled = { title: { startsWith: "Repeat while provider is off" } };
      const before = await prisma.collaborationFunding.count({ where: titled });
      const result = await requestPrefund({
        jurisdictionCode: "US",
        businessName: "Harbor Co",
        creatorSlug: "sofia-martinez",
        title: "Repeat while provider is off",
        grossCents: 20_000,
        sourceId: source.id,
        repeatOfId: prior.id,
      });
      assert.equal(result.ok, false);
      if (!result.ok) assert.match(result.error, /not ready/);
      assert.equal(await prisma.collaborationFunding.count({ where: titled }), before);
    } finally {
      await prisma.collaborationFunding.delete({ where: { id: prior.id } }).catch(() => undefined);
    }
  });

  it("freezes the source label and does not copy the prior ledger or fee snapshot", async () => {
    const provider = await prisma.integrationProvider.findUnique({
      where: { kind_code: { kind: "marketplace", code: "primary" } },
    });
    const settings = await prisma.marketplaceSettings.findUnique({ where: { id: "default" } });
    const sources = await listAttributionSources();
    const source = sources.find((row) => row.active && !/pre-?existing/i.test(row.label));
    if (!source) throw new Error("expected an attribution source");
    const prior = await createPrior("completed", new Date(Date.now() - 2 * 24 * 60 * 60 * 1000));
    let repeatId = "";
    try {
      await prisma.integrationProvider.update({
        where: { kind_code: { kind: "marketplace", code: "primary" } },
        data: {
          enabled: true,
          webhookCipher: provider?.webhookCipher ?? "v1.dGVzdC1pdi1wYWRk.dGVzdC10YWc.dGVzdA",
        },
      });
      const refused = await resolveDealAttribution({
        businessName: "Other Co",
        creatorSlug: "sofia-martinez",
        sourceId: source.id,
        repeatOfId: prior.id,
      });
      assert.equal(refused.ok, false);
      const unconfirmed = await createPrior("awaiting_provider");
      const tooSoon = await resolveDealAttribution({
        businessName: "Harbor Co",
        creatorSlug: "sofia-martinez",
        sourceId: source.id,
        repeatOfId: unconfirmed.id,
      });
      assert.equal(tooSoon.ok, false);
      await prisma.collaborationFunding.delete({ where: { id: unconfirmed.id } });

      const created = await requestPrefund({
        jurisdictionCode: "US",
        businessName: "Harbor Co",
        creatorSlug: "sofia-martinez",
        title: "Spring repeat",
        grossCents: 25_000,
        sourceId: source.id,
        repeatOfId: prior.id,
      });
      assert.equal(created.ok, true);
      if (!created.ok) return;
      repeatId = created.id;
      const repeat = await prisma.collaborationFunding.findUnique({
        where: { id: created.id },
        include: { entries: true },
      });
      const priorAfter = await prisma.collaborationFunding.findUnique({ where: { id: prior.id } });
      assert.equal(repeat?.status, "awaiting_provider");
      assert.equal(repeat?.repeatOfId, prior.id);
      assert.equal(repeat?.attributionLabel, source.label);
      assert.equal(repeat?.attributionStatus, "active");
      assert.ok(repeat?.attributionExpiresAt);
      assert.equal(repeat?.entries.length, 0);
      assert.deepEqual(priorAfter?.feeSnapshotJson, { feeCents: 2_000, ruleId: "frozen-rule" });

      await saveAttributionSources(
        sources.map((row) => ({
          id: row.id,
          label: row.id === source.id ? "Renamed after the deal" : row.label,
          active: row.active,
        })),
      );
      const still = await prisma.collaborationFunding.findUnique({ where: { id: created.id } });
      assert.equal(still?.attributionLabel, source.label);

      await saveAttributionPolicy({ windowDays: 1, minGrossCents: settings?.repeatMinGrossCents ?? 0 });
      const outside = await requestPrefund({
        jurisdictionCode: "US",
        businessName: "Harbor Co",
        creatorSlug: "sofia-martinez",
        title: "Too late to repeat",
        grossCents: 25_000,
        sourceId: source.id,
        repeatOfId: prior.id,
      });
      assert.equal(outside.ok, false);
      const unchanged = await prisma.collaborationFunding.findUnique({ where: { id: created.id } });
      assert.equal(unchanged?.repeatOfId, prior.id);
    } finally {
      if (repeatId) await prisma.collaborationFunding.delete({ where: { id: repeatId } }).catch(() => undefined);
      await prisma.collaborationFunding.delete({ where: { id: prior.id } }).catch(() => undefined);
      await prisma.collaborationFunding.deleteMany({ where: { title: "Too late to repeat" } });
      await saveAttributionSources(sources.map((row) => ({ id: row.id, label: row.label, active: row.active })));
      if (settings) {
        await saveAttributionPolicy({
          windowDays: settings.attributionWindowDays,
          minGrossCents: settings.repeatMinGrossCents,
        });
      }
      if (provider) {
        await prisma.integrationProvider.update({
          where: { id: provider.id },
          data: { enabled: provider.enabled, webhookCipher: provider.webhookCipher, name: provider.name },
        });
      }
    }
  });
});
