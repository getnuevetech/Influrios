import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

function source(path: string) {
  return readFileSync(path, "utf8");
}

describe("public sample surfaces", () => {
  it("draws the card page from published creators and saved plans", () => {
    const card = source("src/app/card/page.tsx");
    assert.equal(card.includes("sofia-martinez"), false);
    assert.equal(card.includes("$19"), false);
    assert.equal(card.includes("$29"), false);
    assert.match(card, /loadPlanMatrix\("creator"\)/);
  });

  it("does not paint invented follower counts on the homepage", () => {
    const home = source("src/app/page.tsx");
    assert.equal(home.includes("sofia-martinez"), false);
    assert.equal(home.includes("2.4M"), false);
    assert.equal(home.includes("3.1M"), false);
  });

  it("does not insert a sample introduction", () => {
    const matching = source("src/lib/managed-matching.ts");
    assert.equal(matching.includes("intro-demo-1"), false);
    assert.equal(matching.includes("demo-business"), false);
    assert.equal(matching.includes("Luminous Beauty"), false);
  });

  it("does not prefill a sample creator on a new deal", () => {
    const payments = source("src/app/payments/page.tsx");
    assert.equal(payments.includes("sofia-martinez"), false);
    assert.equal(payments.includes("Luminous Beauty"), false);
  });
});
