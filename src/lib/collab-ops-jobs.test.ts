import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  shouldRemindDisputeSla,
  shouldWarnProviderHold,
  shouldRetryFailedPayout,
  shouldFlagStaleFundingIntent,
  shouldFlagLedgerMismatch,
  canScheduleMilestoneRelease,
  shouldRequestScheduledRelease,
  isReleaseReadyMilestoneStatus,
  DEFAULT_DISPUTE_SLA_HOURS,
  DEFAULT_PROVIDER_HOLD_WARN_HOURS,
  DEFAULT_FAILED_PAYOUT_BACKOFF_HOURS,
  DEFAULT_FAILED_PAYOUT_MAX_ATTEMPTS,
  DEFAULT_STALE_FUNDING_HOURS,
} from "./collab-ops-jobs";
import { COLLAB_NOTIFICATION_KINDS, usesInfluencerTerminology } from "./collab-notifications";
import { marketplaceDisposition } from "./ledger";

describe("collab ops jobs (dispute SLA + hold warnings)", () => {
  it("registers notification kinds with Influencer terminology", () => {
    assert.ok(COLLAB_NOTIFICATION_KINDS.includes("dispute_sla_reminder"));
    assert.ok(COLLAB_NOTIFICATION_KINDS.includes("provider_hold_period_warning"));
    assert.ok(COLLAB_NOTIFICATION_KINDS.includes("payout_failed"));
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
        openedAt: new Date("2026-10-01T11:00:00.000Z"),
        now,
      }),
      false,
    );
  });

  it("warns only held fundings past the hold window", () => {
    const now = new Date("2026-10-04T12:00:00.000Z");
    assert.equal(
      shouldWarnProviderHold({
        fundingStatus: "held",
        heldAt: new Date("2026-09-20T12:00:00.000Z"),
        now,
        warnHours: DEFAULT_PROVIDER_HOLD_WARN_HOURS,
      }),
      true,
    );
    assert.equal(
      shouldWarnProviderHold({
        fundingStatus: "held",
        heldAt: new Date("2026-10-03T12:00:00.000Z"),
        now,
      }),
      false,
    );
    assert.equal(
      shouldWarnProviderHold({
        fundingStatus: "awaiting_provider",
        heldAt: new Date("2026-09-01T12:00:00.000Z"),
        now,
      }),
      false,
    );
  });
});

describe("failed payout retry + funding recon (Dev §16)", () => {
  it("retries payout_failed only after backoff when no release ledger exists", () => {
    const now = new Date("2026-10-04T12:00:00.000Z");
    assert.equal(
      shouldRetryFailedPayout({
        milestoneStatus: "payout_failed",
        hasReleaseLedgerEntry: false,
        payoutFailedAt: new Date("2026-10-04T10:00:00.000Z"),
        payoutRetryCount: 0,
        now,
        backoffHours: DEFAULT_FAILED_PAYOUT_BACKOFF_HOURS,
      }),
      true,
    );
    assert.equal(
      shouldRetryFailedPayout({
        milestoneStatus: "payout_failed",
        hasReleaseLedgerEntry: false,
        payoutFailedAt: new Date("2026-10-04T11:30:00.000Z"),
        payoutRetryCount: 0,
        now,
      }),
      false,
    );
    assert.equal(
      shouldRetryFailedPayout({
        milestoneStatus: "payout_failed",
        hasReleaseLedgerEntry: true,
        payoutFailedAt: new Date("2026-10-01T12:00:00.000Z"),
        payoutRetryCount: 0,
        now,
      }),
      false,
    );
    assert.equal(
      shouldRetryFailedPayout({
        milestoneStatus: "approved",
        hasReleaseLedgerEntry: false,
        payoutFailedAt: new Date("2026-10-01T12:00:00.000Z"),
        payoutRetryCount: 0,
        now,
      }),
      false,
    );
    assert.equal(
      shouldRetryFailedPayout({
        milestoneStatus: "payout_failed",
        hasReleaseLedgerEntry: false,
        payoutFailedAt: new Date("2026-09-01T12:00:00.000Z"),
        payoutRetryCount: DEFAULT_FAILED_PAYOUT_MAX_ATTEMPTS,
        now,
      }),
      false,
    );
  });

  it("flags stale awaiting_provider intents and unbalanced held ledgers", () => {
    const now = new Date("2026-10-04T12:00:00.000Z");
    assert.equal(
      shouldFlagStaleFundingIntent({
        fundingStatus: "awaiting_provider",
        createdAt: new Date("2026-10-01T12:00:00.000Z"),
        now,
        staleHours: DEFAULT_STALE_FUNDING_HOURS,
      }),
      true,
    );
    assert.equal(
      shouldFlagStaleFundingIntent({
        fundingStatus: "held",
        createdAt: new Date("2026-10-01T12:00:00.000Z"),
        now,
      }),
      false,
    );
    assert.equal(shouldFlagLedgerMismatch({ balanced: false, fundingStatus: "held" }), true);
    assert.equal(shouldFlagLedgerMismatch({ balanced: true, fundingStatus: "held" }), false);
    assert.equal(shouldFlagLedgerMismatch({ balanced: false, fundingStatus: "completed" }), false);
  });

  it("accepts payout.failed on approved milestones and release after payout_failed", () => {
    assert.equal(
      marketplaceDisposition({
        eventType: "payout.failed",
        fundingStatus: "held",
        amountCents: 5_000,
        expectedCents: 5_000,
        heldCents: 10_000,
        milestoneStatus: "approved",
      }),
      "apply",
    );
    assert.equal(
      marketplaceDisposition({
        eventType: "payout.released",
        fundingStatus: "held",
        amountCents: 5_000,
        expectedCents: 5_000,
        heldCents: 10_000,
        milestoneStatus: "payout_failed",
      }),
      "apply",
    );
  });
});

describe("scheduled release (Dev §8 / §16)", () => {
  it("schedules only approved held milestones without open disputes", () => {
    assert.equal(
      canScheduleMilestoneRelease({
        milestoneStatus: "approved",
        fundingStatus: "held",
      }).ok,
      true,
    );
    assert.equal(
      canScheduleMilestoneRelease({
        milestoneStatus: "submitted",
        fundingStatus: "held",
      }).ok,
      false,
    );
    assert.equal(
      canScheduleMilestoneRelease({
        milestoneStatus: "approved",
        fundingStatus: "payment_risk",
      }).ok,
      false,
    );
    assert.equal(
      canScheduleMilestoneRelease({
        milestoneStatus: "approved",
        fundingStatus: "held",
        disputeOpen: true,
      }).ok,
      false,
    );
  });

  it("requests provider release only when release_scheduled is due", () => {
    const now = new Date("2026-10-04T12:00:00.000Z");
    assert.equal(
      shouldRequestScheduledRelease({
        milestoneStatus: "release_scheduled",
        releaseScheduledAt: new Date("2026-10-04T11:00:00.000Z"),
        now,
      }),
      true,
    );
    assert.equal(
      shouldRequestScheduledRelease({
        milestoneStatus: "release_scheduled",
        releaseScheduledAt: new Date("2026-10-04T13:00:00.000Z"),
        now,
      }),
      false,
    );
    assert.equal(
      shouldRequestScheduledRelease({
        milestoneStatus: "approved",
        releaseScheduledAt: new Date("2026-10-04T11:00:00.000Z"),
        now,
      }),
      false,
    );
  });

  it("accepts payout.released for release_scheduled and release_requested", () => {
    assert.ok(isReleaseReadyMilestoneStatus("release_requested"));
    assert.equal(
      marketplaceDisposition({
        eventType: "payout.released",
        fundingStatus: "held",
        amountCents: 5_000,
        expectedCents: 5_000,
        heldCents: 5_000,
        milestoneStatus: "release_requested",
      }),
      "apply",
    );
    assert.equal(
      marketplaceDisposition({
        eventType: "payout.failed",
        fundingStatus: "held",
        amountCents: 5_000,
        expectedCents: 5_000,
        heldCents: 5_000,
        milestoneStatus: "release_scheduled",
      }),
      "apply",
    );
  });
});
