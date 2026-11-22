import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { planSchedule } from "./schedule";

describe("funding schedule", () => {
  it("funds every collaboration once, in full", () => {
    const once = planSchedule({ grossCents: 250_000 });
    assert.equal(once.ok, true);
    if (once.ok) {
      assert.equal(once.kind, "once");
      assert.deepEqual(once.parts, [250_000]);
      assert.equal(once.trancheCount, 1);
    }
    assert.equal(planSchedule({ kind: "once", grossCents: 100 }).ok, true);
  });

  it("refuses staged and recurring schedules", () => {
    for (const kind of ["staged", "recurring"]) {
      const result = planSchedule({ kind, grossCents: 10_000 });
      assert.equal(result.ok, false);
      if (!result.ok) assert.match(result.error, /in full up front/);
    }
  });

  it("leaves no staged or recurring switches, sweeps or screens behind", () => {
    const files = [
      "src/lib/marketplace-ledger.ts",
      "src/app/admin/marketplace/settings/page.tsx",
      "src/app/admin/marketplace/actions.ts",
      "src/app/admin/payment-settings/country-routes-panel.tsx",
      "src/app/payments/payments-panel.tsx",
      "src/app/payments/actions.ts",
      "src/lib/payment-engine.ts",
      "src/lib/launch-gate.ts",
      "src/lib/sweep-clock.ts",
      "src/lib/payment-charge-switches.ts",
    ];
    for (const file of files) {
      const text = readFileSync(file, "utf8");
      assert.doesNotMatch(
        text,
        /stagedFundingEnabled|stagedPrefundingEnabled|recurringFundingEnabled|maxStages|maxRecurrences|sweepDueRecurrences|stopRecurringSeries|recurring_collection|Stop later tranches/,
        file,
      );
    }
    const schema = readFileSync("prisma/schema.prisma", "utf8");
    assert.doesNotMatch(schema, /stagedFundingEnabled|stagedPrefundingEnabled|recurringFundingEnabled|maxStages|maxRecurrences/);
    assert.equal(existsSync("scripts/staging-e8-recurring-evidence.sh"), false);
  });
});
