import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { parseTestEmails, sandboxTestFundingAllowed } from "./launch-gate";

const base = {
  stripeMode: "sandbox",
  collectionProviderCode: "stripe",
  partyEmails: ["biz@example.com", "Creator@Example.com"],
  testEmails: ["biz@example.com", "creator@example.com"],
};

describe("test deals before launch", () => {
  it("allows funding only with Stripe test keys, Stripe collection, and every party listed", () => {
    assert.equal(sandboxTestFundingAllowed(base), true);
    assert.equal(sandboxTestFundingAllowed({ ...base, stripeMode: "live" }), false);
    assert.equal(sandboxTestFundingAllowed({ ...base, stripeMode: "rejected" }), false);
    assert.equal(sandboxTestFundingAllowed({ ...base, collectionProviderCode: "flutterwave" }), false);
    assert.equal(sandboxTestFundingAllowed({ ...base, collectionProviderCode: null }), false);
    assert.equal(sandboxTestFundingAllowed({ ...base, testEmails: ["biz@example.com"] }), false);
    assert.equal(sandboxTestFundingAllowed({ ...base, testEmails: [] }), false);
    assert.equal(sandboxTestFundingAllowed({ ...base, partyEmails: [] }), false);
  });

  it("reads a pasted list of emails", () => {
    assert.deepEqual(parseTestEmails(" A@x.com, b@y.org\nnot-an-email a@x.com "), ["a@x.com", "b@y.org"]);
  });

  it("checks the list only after the normal launch block", () => {
    const apply = readFileSync("src/lib/signed-funding-apply.ts", "utf8");
    const block = apply.indexOf("if (liveFunding) {");
    assert.ok(block > 0);
    assert.ok(apply.indexOf("sandboxTestFundingAllowed", block) > block);
    assert.match(apply, /if \(!testDeal\) return \{ ok: false as const, error: liveFunding \};/);
  });
});
