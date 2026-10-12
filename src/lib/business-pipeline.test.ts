import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { advanceLead, leadIsOpen, leadTransitions, storedInquiryStatus } from "./business";
import { splitSponsoredPlacements } from "./sponsored-placement";

describe("lead pipeline", () => {
  it("moves a new lead through the stored stages and leaves a won lead there", () => {
    assert.deepEqual(leadTransitions("lead_created"), ["contacted", "lost", "dormant"]);
    assert.equal(advanceLead("lead_created", "won").ok, false);
    assert.equal(advanceLead("qualified", "won").ok, true);
    assert.deepEqual(leadTransitions("won"), []);
    assert.deepEqual(leadTransitions("lost"), []);
    assert.equal(advanceLead("sent", "contacted").ok, true);
    assert.equal(advanceLead("declined", "contacted").ok, false);
    assert.equal(storedInquiryStatus("sent"), "sent");
    assert.equal(storedInquiryStatus("  "), "");
    assert.equal(leadIsOpen("lead_created"), true);
    assert.equal(leadIsOpen("won"), false);
    const business = readFileSync("src/lib/business.ts", "utf8");
    assert.match(business, /status: "lead_created"/);
    assert.equal(business.includes(': "sent"'), false);
  });
});

describe("sponsored placements", () => {
  it("keeps sponsored profiles out of the organic order", () => {
    const results = [
      { slug: "ada" },
      { slug: "ben" },
      { slug: "cam" },
    ];
    const split = splitSponsoredPlacements(results, ["cam", "missing", "ada"]);
    assert.deepEqual(split.sponsored.map((row) => row.slug), ["cam", "ada"]);
    assert.deepEqual(split.organic.map((row) => row.slug), ["ben"]);
    const discover = readFileSync("src/app/discover/page.tsx", "utf8");
    const matching = readFileSync("src/lib/managed-matching.ts", "utf8");
    const admin = readFileSync("src/app/admin/matching/page.tsx", "utf8");
    assert.match(discover, /Sponsored/);
    assert.match(discover, /organic\.map/);
    assert.equal(matching.includes('planTier !== "STARTER"'), false);
    assert.equal(admin.includes("c.specialties"), false);
    assert.equal(admin.includes("c.offer"), false);
  });
});
