import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { runSweepTick, sweepClockEnabled } from "./sweep-runner";

describe("background sweeps", () => {
  it("run in production unless turned off, and never during the build", () => {
    assert.equal(sweepClockEnabled({ NODE_ENV: "production" }), true);
    assert.equal(sweepClockEnabled({ NODE_ENV: "production", IN_PROCESS_SWEEPS: "0" }), false);
    assert.equal(sweepClockEnabled({ NODE_ENV: "development" }), false);
    assert.equal(sweepClockEnabled({ NODE_ENV: "production", NEXT_PHASE: "phase-production-build" }), false);
  });

  it("start from the server and share one runner with the cron route", () => {
    assert.match(readFileSync("src/instrumentation.ts", "utf8"), /instrumentation-node/);
    assert.match(readFileSync("src/instrumentation-node.ts", "utf8"), /startSweepClock/);
    assert.match(readFileSync("src/app/api/cron/sweeps/route.ts", "utf8"), /runSweepTick/);
  });

  it("lets only one run happen at a time", async (t) => {
    if (!process.env.DATABASE_URL) return t.skip("no database");
    const [a, b] = await Promise.all([runSweepTick(), runSweepTick()]);
    assert.equal([a.ran, b.ran].filter(Boolean).length, 1);
  });
});
