import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { BILLING_CATALOG, getProduct, isBillingSku } from "./billing";

describe("billing catalog", () => {
  it("recognizes known SKUs and rejects unknown ones", () => {
    assert.equal(isBillingSku("creator_plus"), true);
    assert.equal(isBillingSku("agency"), true);
    assert.equal(isBillingSku("not_a_plan"), false);
    assert.equal(getProduct("creator_pro")?.name, "Creator Pro");
    assert.equal(getProduct("missing"), undefined);
  });

  it("keeps creator and business audiences in the catalog", () => {
    const audiences = new Set(BILLING_CATALOG.map((product) => product.audience));
    assert.ok(audiences.has("creator"));
    assert.ok(audiences.has("business"));
    assert.equal(BILLING_CATALOG.length, 4);
  });
});
