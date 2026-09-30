import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { fitRankingLabel, managedMatchGate } from "./business-queue";

describe("managed match gate", () => {
  it("refuses when managed promotion is off", () => {
    const result = managedMatchGate({ flagEnabled: false, planAllows: true, alreadyQueued: false });
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.error, "Managed promotion is turned off.");
  });

  it("refuses when the plan is not Agency", () => {
    const result = managedMatchGate({ flagEnabled: true, planAllows: false, alreadyQueued: false });
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.error, "Managed matching is an Agency feature.");
  });

  it("refuses a brief that is already queued", () => {
    const result = managedMatchGate({ flagEnabled: true, planAllows: true, alreadyQueued: true });
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.error, "This brief is already in the managed queue.");
  });

  it("allows an Agency request while the flag is on", () => {
    assert.deepEqual(
      managedMatchGate({ flagEnabled: true, planAllows: true, alreadyQueued: false }),
      { ok: true },
    );
  });
});

describe("fit ranking label", () => {
  it("names the assigned pipeline", () => {
    assert.equal(fitRankingLabel("OpenAI"), "AI pipeline: OpenAI");
  });

  it("stays a platform rule when no live provider is assigned", () => {
    assert.equal(fitRankingLabel(null), "Platform rule — not an AI provider");
  });
});
