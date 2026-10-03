import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { prisma } from "./db";
import { listAttributionSources } from "./deal-attribution";
import { grossWithinCap, summarizeLedger } from "./ledger";
import { requestPrefund, setGrossCapForTests } from "./marketplace-ledger";

describe("gross cap and ledger totals", () => {
  it("treats a zero cap as no cap and refuses a larger USD gross", () => {
    assert.equal(grossWithinCap({ grossCents: 50_000, maxGrossCents: 0 }).ok, true);
    assert.equal(grossWithinCap({ grossCents: 5_000, maxGrossCents: 5_000 }).ok, true);
    const over = grossWithinCap({ grossCents: 5_001, maxGrossCents: 5_000 });
    assert.equal(over.ok, false);
    if (!over.ok) assert.match(over.error, /Nothing was funded/);
  });

  it("sums each currency and leaves fees and shares out of the held amount", () => {
    const totals = summarizeLedger([
      {
        currency: "usd",
        grossCents: 10_000,
        entries: [
          { kind: "hold", amountCents: 10_000 },
          { kind: "fee", amountCents: 1_000 },
          { kind: "share", amountCents: 8_000 },
          { kind: "release", amountCents: 2_000 },
        ],
      },
      {
        currency: "GBP",
        grossCents: 7_500,
        entries: [{ kind: "hold", amountCents: 7_500 }],
      },
      {
        currency: "USD",
        grossCents: 1_000,
        entries: [{ kind: "hold", amountCents: 1_500 }],
      },
    ]);
    const usd = totals.find((row) => row.currency === "USD");
    const gbp = totals.find((row) => row.currency === "GBP");
    assert.equal(usd?.heldCents, 7_000 + 1_500);
    assert.equal(usd?.releasedCents, 2_000);
    assert.equal(usd?.feeCents, 1_000);
    assert.equal(usd?.unbalanced, 1);
    assert.equal(gbp?.heldCents, 7_500);
    assert.equal(gbp?.feeCents, 0);
  });
});

describe("prefund gross cap", () => {
  it("creates no row above the cap and does not treat the cap as a provider failure", async () => {
    const sources = await listAttributionSources();
    const source = sources.find((row) => row.active);
    if (!source) throw new Error("marketplace settings are missing");
    const titles = ["Cap blocks", "Cap allows"];
    try {
      setGrossCapForTests(5_000);
      const blocked = await requestPrefund({
        jurisdictionCode: "US",
        businessName: "Harbor Co",
        creatorSlug: "sofia-martinez",
        title: "Cap blocks",
        grossCents: 10_000,
        sourceId: source.id,
      });
      assert.equal(blocked.ok, false);
      if (!blocked.ok) assert.match(blocked.error, /admin cap/);
      assert.equal(await prisma.collaborationFunding.count({ where: { title: "Cap blocks" } }), 0);
      const allowed = await requestPrefund({
        jurisdictionCode: "US",
        businessName: "Harbor Co",
        creatorSlug: "sofia-martinez",
        title: "Cap allows",
        grossCents: 5_000,
        sourceId: source.id,
      });
      if (!allowed.ok) assert.doesNotMatch(allowed.error, /admin cap/);
      if (allowed.ok) {
        const row = await prisma.collaborationFunding.findFirst({
          where: { title: "Cap allows" },
          include: { entries: true },
        });
        assert.equal(row?.status, "awaiting_provider");
        assert.equal(row?.entries.length, 0);
      }
    } finally {
      setGrossCapForTests(null);
      await prisma.collaborationFunding.deleteMany({ where: { title: { in: titles } } });
    }
  });
});
