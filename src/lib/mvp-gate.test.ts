import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { bannedBrandHit, findBannedBrand } from "./brand-ban";
import { section33Failures, webhookRepeatsAreSkipped } from "./mvp-gate";

describe("section 33 checklist", () => {
  it("keeps every shipped MVP item in place", () => {
    assert.deepEqual(section33Failures(), []);
  });

  it("skips a duplicate webhook", () => {
    assert.equal(webhookRepeatsAreSkipped(), true);
  });
});

describe("brand ban", () => {
  it("finds the retired wordmark and leaves the product name alone", () => {
    const name = ["Influence", "Connect"].join(" ");
    assert.equal(bannedBrandHit(`Welcome to ${name}`), name);
    assert.equal(bannedBrandHit("Influrios profile"), null);
  });

  it("keeps the retired name out of application code", () => {
    assert.deepEqual(findBannedBrand("src"), []);
  });
});
