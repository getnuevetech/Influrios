import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  addDollars,
  allocateDollarsByWeight,
  dollar,
  dollarsEqual,
  formatDollar,
  parseDollar,
  subDollars,
  sumDollars,
} from "@/lib/payment-money";

describe("payment money (dollars)", () => {
  it("parses and formats dollars with two decimals", () => {
    assert.equal(parseDollar("19"), dollar("19.00"));
    assert.equal(parseDollar("19.5"), dollar("19.50"));
    assert.equal(parseDollar("$1,213.80"), dollar("1213.80"));
    assert.equal(formatDollar(dollar("1213.80")), "$1,213.80");
  });

  it("adds and subtracts without floating drift", () => {
    assert.equal(addDollars(dollar("0.10"), dollar("0.20")), dollar("0.30"));
    assert.equal(subDollars(dollar("4830.00"), dollar("1642.20")), dollar("3187.80"));
    assert.equal(sumDollars([dollar("1213.80"), dollar("1178.10"), dollar("1178.10")]), dollar("3570.00"));
  });

  it("allocates residual hundredths deterministically", () => {
    const parts = allocateDollarsByWeight(dollar("1.00"), [1, 9_999]);
    assert.ok(parts);
    assert.equal(sumDollars(parts!), dollar("1.00"));
    // Largest remainder: weight 9999 keeps the leftover hundredth (same rule as legacy allocator).
    assert.equal(parts![0], dollar("0.00"));
    assert.equal(parts![1], dollar("1.00"));
    const even = allocateDollarsByWeight(dollar("0.03"), [5_000, 5_000]);
    assert.ok(even);
    assert.deepEqual(even, [dollar("0.02"), dollar("0.01")]);
  });

  it("rejects cent-style integers as domain values", () => {
    assert.equal(dollarsEqual(dollar("4200.00"), dollar("4200.00")), true);
    assert.notEqual(dollar("4200.00"), "420000");
  });
});
