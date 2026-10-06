import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  milestoneLifecycleLabel,
  resolveLifecycleSnapshot,
  revisionLimitExhausted,
  REVISION_EXHAUSTED_MESSAGE,
} from "./milestone-lifecycle";
import { requestRevision } from "./ledger";

describe("milestone lifecycle (W3.5)", () => {
  it("maps ledger statuses to Dev §8 labels", () => {
    assert.equal(milestoneLifecycleLabel("pending"), "IN_PROGRESS");
    assert.equal(milestoneLifecycleLabel("submitted"), "SUBMITTED");
    assert.equal(milestoneLifecycleLabel("approved"), "APPROVED");
    assert.equal(milestoneLifecycleLabel("released"), "RELEASED");
  });

  it("prefers financial plan snapshot over jurisdiction and settings", () => {
    const snap = resolveLifecycleSnapshot({
      planReviewWindowHours: 48,
      planRevisionLimit: 1,
      jurisdictionReviewWindowHours: 96,
      jurisdictionMaxRevisions: 4,
      settingsReviewWindowHours: 72,
      settingsMaxRevisions: 2,
    });
    assert.equal(snap.source, "financial_plan");
    assert.equal(snap.reviewWindowHours, 48);
    assert.equal(snap.revisionLimit, 1);
  });

  it("uses jurisdiction when plan has no lifecycle fields", () => {
    const snap = resolveLifecycleSnapshot({
      jurisdictionReviewWindowHours: 24,
      jurisdictionMaxRevisions: 0,
      settingsReviewWindowHours: 72,
      settingsMaxRevisions: 2,
    });
    assert.equal(snap.source, "jurisdiction");
    assert.equal(snap.reviewWindowHours, 24);
    assert.equal(snap.revisionLimit, 0);
  });

  it("falls back to marketplace settings", () => {
    const snap = resolveLifecycleSnapshot({
      settingsReviewWindowHours: 96,
      settingsMaxRevisions: 3,
    });
    assert.equal(snap.source, "marketplace_settings");
    assert.equal(snap.reviewWindowHours, 96);
    assert.equal(snap.revisionLimit, 3);
  });

  it("requires change order or dispute when revision limit is exhausted (§22.6)", () => {
    const hit = revisionLimitExhausted({ revisionCount: 2, revisionLimit: 2 });
    assert.equal(hit.exhausted, true);
    if (hit.exhausted) {
      assert.equal(hit.next, "change_order_or_dispute");
      assert.equal(hit.error, REVISION_EXHAUSTED_MESSAGE);
    }
    const open = revisionLimitExhausted({ revisionCount: 1, revisionLimit: 2 });
    assert.equal(open.exhausted, false);

    const blocked = requestRevision({
      fundingStatus: "held",
      milestoneStatus: "submitted",
      revisionCount: 1,
      revisionLimit: 1,
      disputeOpen: false,
    });
    assert.equal(blocked.ok, false);
    if (!blocked.ok) assert.match(blocked.error, /dispute|change order/i);
  });
});
