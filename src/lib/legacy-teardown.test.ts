import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { promises as fs } from "fs";
import path from "path";
import {
  influencerAliasForCreatorField,
  isCreatorCompatField,
  legacyInventorySnapshot,
  purgeLegacyDemoJsonFiles,
  recordCreatorFieldDeprecation,
} from "./legacy-teardown";
import { setProductSwitchForTests } from "./product-switches";
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

describe("legacy inventory", () => {
  it("lists demo endpoints and signing decision", () => {
    const snap = legacyInventorySnapshot();
    assert.ok(snap.endpoints.some((row) => row.path === "/admin/payments"));
    assert.match(snap.signingDecision, /non-goal/i);
    assert.match(snap.moneyEngine, /marketplace ledger/i);
  });

  it("maps creator_* compat fields to influencer aliases", () => {
    assert.equal(isCreatorCompatField("creator_plus"), true);
    assert.equal(influencerAliasForCreatorField("creator_plus"), "Influencer Plus");
    assert.equal(influencerAliasForCreatorField("creator_pro"), "Influencer Pro");
    assert.equal(influencerAliasForCreatorField("unknown"), null);
  });
});

describe("legacy teardown freeze (db)", () => {
  it("purges demo JSON when legacy switch is off and records deprecation telemetry", async (t) => {
    if (!(await requireDb(t))) return;
    setProductSwitchForTests("legacy_demo_payments", false);
    const dataDir = path.join(process.cwd(), "data");
    await fs.mkdir(dataDir, { recursive: true }).catch(() => null);
    const paymentsPath = path.join(dataDir, "protected-payments.json");
    const trustPath = path.join(dataDir, "trust.json");
    await fs.writeFile(paymentsPath, JSON.stringify({ deals: [], notes: "test" }), "utf8");
    await fs.writeFile(trustPath, JSON.stringify({ disputes: [], contracts: [], notes: "test" }), "utf8");

    const purged = await purgeLegacyDemoJsonFiles();
    assert.equal(purged.frozen, true);
    assert.ok(purged.removed.includes("protected-payments.json"));
    assert.ok(purged.removed.includes("trust.json"));

    await assert.rejects(() => fs.access(paymentsPath));
    await assert.rejects(() => fs.access(trustPath));

    const recorded = await recordCreatorFieldDeprecation({
      field: "creator_plus",
      source: "p8-test",
      actor: "p8-test@example.com",
    });
    assert.equal(recorded.recorded, true);
    assert.equal(recorded.alias, "Influencer Plus");

    const audit = await prisma.auditLog.findFirst({
      where: { action: "terminology.creator_field_deprecated", objectId: "creator_plus" },
      orderBy: { createdAt: "desc" },
    });
    assert.ok(audit);

    setProductSwitchForTests("legacy_demo_payments", null);
  });

  it("keeps JSON files when legacy demos are intentionally on", async (t) => {
    if (!(await requireDb(t))) return;
    setProductSwitchForTests("legacy_demo_payments", true);
    const dataDir = path.join(process.cwd(), "data");
    await fs.mkdir(dataDir, { recursive: true }).catch(() => null);
    const paymentsPath = path.join(dataDir, "protected-payments.json");
    await fs.writeFile(paymentsPath, JSON.stringify({ deals: [], notes: "keep" }), "utf8");

    const purged = await purgeLegacyDemoJsonFiles();
    assert.equal(purged.frozen, false);
    assert.equal(purged.removed.length, 0);
    await fs.access(paymentsPath);
    await fs.unlink(paymentsPath).catch(() => null);
    setProductSwitchForTests("legacy_demo_payments", null);
  });
});
