import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { prisma } from "./db";
import {
  CATALOG_KINDS,
  DEFAULT_COLLAB_TYPES,
  DEFAULT_TIMEFRAMES,
  activateCatalogOption,
  deactivateCatalogOption,
  ensureCatalogDefaults,
  isCatalogKind,
  listCatalogOptions,
  saveCatalogOption,
} from "./catalog-options";

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

describe("catalog options defaults", () => {
  it("exposes exactly collab_type and timeframe kinds", () => {
    assert.deepEqual([...CATALOG_KINDS], ["collab_type", "timeframe"]);
    assert.equal(isCatalogKind("collab_type"), true);
    assert.equal(isCatalogKind("timeframe"), true);
    assert.equal(isCatalogKind("bogus"), false);
  });

  it("ships the documented default collaboration types", () => {
    assert.deepEqual(
      [...DEFAULT_COLLAB_TYPES],
      [
        "Sponsored Post",
        "Product Seeding",
        "Brand Ambassador",
        "UGC Creation",
        "Event Appearance",
        "Affiliate / Performance",
        "Whitelisting / Spark Ads",
        "Other",
      ],
    );
  });

  it("ships the documented default timeframes", () => {
    assert.deepEqual(
      [...DEFAULT_TIMEFRAMES],
      ["ASAP", "1–2 weeks", "2–4 weeks", "1–3 months", "3–6 months", "Ongoing / retainer", "Flexible / Other"],
    );
  });
});

describe("catalog options admin CRUD", () => {
  it("seeds defaults once, adds, deactivates, and restores an option", async (t) => {
    if (!(await requireDb(t))) return;
    await ensureCatalogDefaults();
    const collabTypes = await listCatalogOptions("collab_type");
    assert.ok(collabTypes.some((row) => row.label === "Sponsored Post"));
    const timeframes = await listCatalogOptions("timeframe");
    assert.ok(timeframes.some((row) => row.label === "ASAP"));

    // Seeding twice does not duplicate rows.
    const before = await prisma.catalogOption.count({ where: { kind: "collab_type" } });
    await ensureCatalogDefaults();
    const after = await prisma.catalogOption.count({ where: { kind: "collab_type" } });
    assert.equal(before, after);

    const stamp = Date.now().toString(36);
    const label = `Test Option ${stamp}`;
    const created = await saveCatalogOption({ kind: "collab_type", label });
    assert.equal(created.ok, true);
    if (!created.ok) return;

    const activeAfterCreate = await listCatalogOptions("collab_type");
    assert.ok(activeAfterCreate.some((row) => row.id === created.id && row.label === label));

    const deactivated = await deactivateCatalogOption(created.id);
    assert.equal(deactivated.ok, true);
    const activeAfterDeactivate = await listCatalogOptions("collab_type");
    assert.equal(
      activeAfterDeactivate.some((row) => row.id === created.id),
      false,
    );

    const restored = await activateCatalogOption(created.id);
    assert.equal(restored.ok, true);
    const activeAfterRestore = await listCatalogOptions("collab_type");
    assert.ok(activeAfterRestore.some((row) => row.id === created.id));

    await prisma.catalogOption.delete({ where: { id: created.id } });
  });

  it("rejects a blank label and an unknown kind", async (t) => {
    if (!(await requireDb(t))) return;
    const blank = await saveCatalogOption({ kind: "collab_type", label: "   " });
    assert.equal(blank.ok, false);
    const missing = await deactivateCatalogOption("does-not-exist");
    assert.equal(missing.ok, false);
  });
});
