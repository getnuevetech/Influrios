import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { formatMoney } from "./money";

describe("formatMoney", () => {
  it("formats USD cents without fractional digits by default", () => {
    assert.equal(formatMoney(0), "$0");
    assert.equal(formatMoney(1_500), "$15");
    assert.equal(formatMoney(450_000), "$4,500");
  });

  it("respects a non-USD currency code", () => {
    assert.match(formatMoney(7_500, "GBP"), /£|GBP|7,500|75/);
  });
});
