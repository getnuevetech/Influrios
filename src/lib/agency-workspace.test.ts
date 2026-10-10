import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { agencyWorkspaceIdForOwner, agencyWorkspaceNotes, parsePortfolioMetricLines } from "./agency";

describe("agency workspace identity", () => {
  it("gives each owner a distinct workspace id and never the shared demo id", () => {
    const a = agencyWorkspaceIdForOwner("user_a");
    const b = agencyWorkspaceIdForOwner("user_b");
    assert.equal(a, "agency_owner_user_a");
    assert.notEqual(a, b);
    assert.equal(a.includes("agency_demo"), false);
  });

  it("keeps only metrics that were entered", () => {
    assert.deepEqual(
      parsePortfolioMetricLines("Reach | 1200\nSaves\n | 8\nEngagement | —\nSaves | 40"),
      [
        { label: "Reach", value: "1200" },
        { label: "Saves", value: "40" },
      ],
    );
    assert.deepEqual(parsePortfolioMetricLines(""), []);
  });

  it("does not ship a sample campaign or case study", () => {
    const agency = readFileSync(new URL("./agency.ts", import.meta.url), "utf8");
    const admin = readFileSync(new URL("../app/admin/agency/page.tsx", import.meta.url), "utf8");
    const member = readFileSync(new URL("../app/agency/page.tsx", import.meta.url), "utf8");
    assert.equal(agency.includes("case-study stubs"), false);
    assert.equal(agency.includes('|| "lifestyle"'), false);
    assert.equal(agency.includes('|| "TBD"'), false);
    assert.equal(agency.includes('|| "Project"'), false);
    assert.equal(agency.includes('label: "Reach"'), false);
    assert.equal(admin.includes("Ops case study"), false);
    assert.equal(admin.includes("500K"), false);
    assert.equal(admin.includes("$10K"), false);
    assert.equal(admin.includes("Admin-created multi-creator campaign"), false);
    assert.equal(admin.includes("Admin added"), false);
    assert.equal(admin.includes('defaultValue="Project"'), false);
    assert.equal(member.includes('defaultValue="Project"'), false);
    assert.equal(agency.includes("Admin-created agency workspace"), false);
    assert.equal(agencyWorkspaceNotes("  Roster note  "), "Roster note");
    assert.equal(agencyWorkspaceNotes("   "), "");
    assert.equal(agencyWorkspaceNotes(), "");
  });
});
