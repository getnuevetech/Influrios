import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseBackoffHours, processTimingFromRow } from "./process-timing";

describe("process timing", () => {
  it("keeps the previous clocks when a row is missing", () => {
    const timing = processTimingFromRow(null);
    assert.equal(timing.reviewWindowHours, 72);
    assert.equal(timing.quoteValidHours, 168);
    assert.equal(timing.unknownCommandMinutes, 15);
    assert.equal(timing.providerCommandMaxAttempts, 3);
    assert.equal(timing.disputeSlaHours, 72);
    assert.equal(timing.providerHoldWarnHours, 168);
    assert.deepEqual(timing.failedPayoutBackoffHours, [1, 6, 24, 72]);
    assert.equal(timing.failedPayoutMaxAttempts, 4);
    assert.equal(timing.staleFundingHours, 48);
    assert.equal(timing.reviewDeadlineLeadHours, 12);
    assert.equal(timing.teamProposalLifeDays, 14);
  });

  it("rejects a backoff list that is empty or not whole hours", () => {
    assert.equal(parseBackoffHours(""), null);
    assert.equal(parseBackoffHours("1, 0, 24"), null);
    assert.deepEqual(parseBackoffHours("2, 12"), [2, 12]);
  });
});
