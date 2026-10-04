import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  shouldRemindDisputeSla,
  shouldWarnProviderHold,
  DEFAULT_DISPUTE_SLA_HOURS,
  DEFAULT_PROVIDER_HOLD_WARN_HOURS,
} from "./collab-ops-jobs";
import { COLLAB_NOTIFICATION_KINDS, usesInfluencerTerminology } from "./collab-notifications";

describe("collab ops jobs (dispute SLA + hold warnings)", () => {
  it("registers notification kinds with Influencer terminology", () => {
    assert.ok(COLLAB_NOTIFICATION_KINDS.includes("dispute_sla_reminder"));
    assert.ok(COLLAB_NOTIFICATION_KINDS.includes("provider_hold_period_warning"));
    assert.equal(usesInfluencerTerminology("dispute_sla_reminder"), true);
    assert.equal(usesInfluencerTerminology("provider_hold_period_warning"), true);
  });

  it("reminds only open/under_review disputes past the SLA", () => {
    const now = new Date("2026-10-04T12:00:00.000Z");
    assert.equal(
      shouldRemindDisputeSla({
        status: "open",
        openedAt: new Date("2026-10-01T11:00:00.000Z"),
        now,
        slaHours: DEFAULT_DISPUTE_SLA_HOURS,
      }),
      true,
    );
    assert.equal(
      shouldRemindDisputeSla({
        status: "open",
        openedAt: new Date("2026-10-04T06:00:00.000Z"),
        now,
        slaHours: DEFAULT_DISPUTE_SLA_HOURS,
      }),
      false,
    );
    assert.equal(
      shouldRemindDisputeSla({
        status: "resolved_release",
        openedAt: new Date("2026-09-01T00:00:00.000Z"),
        now,
      }),
      false,
    );
  });

  it("warns when held funds exceed the hold warning window", () => {
    const now = new Date("2026-10-10T00:00:00.000Z");
    assert.equal(
      shouldWarnProviderHold({
        fundingStatus: "held",
        heldAt: new Date("2026-10-01T00:00:00.000Z"),
        now,
        warnHours: DEFAULT_PROVIDER_HOLD_WARN_HOURS,
      }),
      true,
    );
    assert.equal(
      shouldWarnProviderHold({
        fundingStatus: "held",
        heldAt: new Date("2026-10-09T00:00:00.000Z"),
        now,
        warnHours: DEFAULT_PROVIDER_HOLD_WARN_HOURS,
      }),
      false,
    );
    assert.equal(
      shouldWarnProviderHold({
        fundingStatus: "awaiting_provider",
        heldAt: new Date("2026-09-01T00:00:00.000Z"),
        now,
      }),
      false,
    );
  });
});
