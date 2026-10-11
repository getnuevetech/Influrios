import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { formatMoney, formatStoredMoney, storedCurrencyCode } from "./money";

describe("formatMoney", () => {
  it("formats USD cents without fractional digits by default", () => {
    assert.equal(formatMoney(0), "$0");
    assert.equal(formatMoney(1_500), "$15");
    assert.equal(formatMoney(450_000), "$4,500");
  });

  it("respects a non-USD currency code", () => {
    assert.match(formatMoney(7_500, "GBP"), /£|GBP|7,500|75/);
  });

  it("leaves a blank stored currency unlabeled", () => {
    assert.equal(formatStoredMoney(1_500, ""), "15");
    assert.equal(formatStoredMoney(1_500, "  "), "15");
    assert.equal(formatStoredMoney(1_500, null), "15");
    assert.equal(formatStoredMoney(7_500, "gbp"), formatMoney(7_500, "GBP"));
  });

  it("reads a three-letter currency and leaves a blank code empty", () => {
    assert.equal(storedCurrencyCode("usd"), "USD");
    assert.equal(storedCurrencyCode(" gbp "), "GBP");
    assert.equal(storedCurrencyCode(""), null);
    assert.equal(storedCurrencyCode("US"), null);
    assert.equal(storedCurrencyCode(null), null);
    const ledger = readFileSync("src/lib/marketplace-ledger.ts", "utf8");
    assert.equal(ledger.includes('|| "USD"'), false);
    assert.match(ledger, /That jurisdiction has no currency\. Nothing was funded\./);
    assert.match(ledger, /That funding has no currency\. Nothing was changed\./);
  });
});
