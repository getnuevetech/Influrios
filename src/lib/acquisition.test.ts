import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import {
  acquisitionFunnel,
  acquisitionSource,
  agencyRowSource,
  applyTouch,
  parseAgencyCsv,
} from "./acquisition";

describe("acquisition touches", () => {
  it("keeps the first source and replaces only the last", () => {
    const blank = { firstSource: "", firstAt: "", lastSource: "", lastAt: "" };
    const first = applyTouch(blank, "  ", "2026-10-12T00:00:00.000Z");
    assert.equal(first.firstSource, "");
    const instagram = applyTouch(blank, "instagram", "2026-10-12T00:00:00.000Z");
    const later = applyTouch(instagram, "agency roster", "2026-10-12T01:00:00.000Z");
    assert.equal(later.firstSource, "instagram");
    assert.equal(later.firstAt, "2026-10-12T00:00:00.000Z");
    assert.equal(later.lastSource, "agency roster");
    assert.equal(acquisitionSource({ source: "", utmSource: "newsletter", utmCampaign: "october" }), "newsletter / october");
    assert.equal(acquisitionSource({}), "");
  });
});

describe("agency csv", () => {
  it("stores the cells that were entered and reports a missing handle", () => {
    const parsed = parseAgencyCsv('handle,name,email,platform,source\nada,Ada,ada@example.com,instagram,roster\n,Missing,missing@example.com,,\n');
    assert.equal(parsed.rows.length, 1);
    assert.equal(parsed.rows[0]?.handle, "ada");
    assert.equal(parsed.rows[0]?.name, "Ada");
    assert.equal(parsed.rows[0]?.platform, "instagram");
    assert.equal(parsed.rows[0]?.source, "roster");
    assert.equal(parsed.errors[0], "Row 3 needs a handle.");
    assert.equal(agencyRowSource("", "Talent Co"), "Talent Co");
    assert.equal(agencyRowSource("roster", "Talent Co"), "roster");
    assert.equal(parseAgencyCsv("name,email\nAda,ada@example.com").errors[0], "The CSV needs a handle column.");
  });
});

describe("acquisition funnel", () => {
  it("counts stored invitations and drafts without renaming a blank source", () => {
    const rows = acquisitionFunnel({
      invitations: [{ source: "roster" }, { source: "" }],
      sessions: [
        { source: "roster", state: "PUBLISHED", verified: true, published: true },
        { source: "", state: "DRAFT", verified: false, published: false },
        { source: "instagram", state: "CLAIMED", verified: false, published: false },
      ],
    });
    const roster = rows.find((row) => row.source === "roster");
    const blank = rows.find((row) => row.source === "");
    const instagram = rows.find((row) => row.source === "instagram");
    assert.equal(roster?.invited, 1);
    assert.equal(roster?.previewed, 1);
    assert.equal(roster?.claimed, 1);
    assert.equal(roster?.published, 1);
    assert.equal(blank?.invited, 1);
    assert.equal(blank?.previewed, 1);
    assert.equal(blank?.claimed, 0);
    assert.equal(instagram?.claimed, 1);
    assert.equal(instagram?.verified, 0);
    assert.equal(rows.at(-1)?.source, "");
    const page = readFileSync("src/app/admin/invitations/page.tsx", "utf8");
    const claim = readFileSync("src/app/claim/page.tsx", "utf8");
    assert.match(page, /actionImportAgencyCsv/);
    assert.match(page, /acquisition\.funnel/);
    assert.match(claim, /utm_source/);
    assert.equal(claim.includes("Organic"), false);
  });
});
