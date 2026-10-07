import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { cronAuthorized, isSweepJobKind, SWEEP_JOB_KINDS } from "./sweep-clock";

describe("sweep clock", () => {
  it("lists every money sweep kind once", () => {
    assert.equal(new Set(SWEEP_JOB_KINDS).size, SWEEP_JOB_KINDS.length);
    assert.ok(isSweepJobKind("recurring_cycle_sweep"));
    assert.ok(isSweepJobKind("milestone_auto_approval"));
    assert.ok(isSweepJobKind("short_link_schedule_sweep"));
    assert.equal(isSweepJobKind("verification_email"), false);
  });

  it("rejects a missing or wrong cron secret", () => {
    assert.equal(cronAuthorized(null, "secret"), false);
    assert.equal(cronAuthorized("Bearer secret", undefined), false);
    assert.equal(cronAuthorized("secret", "secret"), false);
    assert.equal(cronAuthorized("Bearer wrong", "secret"), false);
    assert.equal(cronAuthorized("Bearer secret", "secret"), true);
  });
});
