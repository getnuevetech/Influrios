import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  COLLAB_NOTIFICATION_KINDS,
  collabKindForMarketplaceEvent,
  renderCollabNotification,
  shouldNotifyReviewDeadline,
  usesInfluencerTerminology,
} from "./collab-notifications";

describe("collab notifications (W3.11)", () => {
  it("covers Dev §18 collaboration event kinds", () => {
    assert.ok(COLLAB_NOTIFICATION_KINDS.includes("funding_successful"));
    assert.ok(COLLAB_NOTIFICATION_KINDS.includes("milestone_submitted"));
    assert.ok(COLLAB_NOTIFICATION_KINDS.includes("dispute_opened"));
    assert.ok(COLLAB_NOTIFICATION_KINDS.includes("payout_completed"));
    assert.ok(COLLAB_NOTIFICATION_KINDS.includes("provider_jurisdiction_limitation"));
    assert.ok(COLLAB_NOTIFICATION_KINDS.includes("change_order_accepted"));
    assert.ok(COLLAB_NOTIFICATION_KINDS.includes("preexisting_relationship_claimed"));
  });

  it("renders Influencer terminology in templates", () => {
    for (const kind of COLLAB_NOTIFICATION_KINDS) {
      assert.equal(usesInfluencerTerminology(kind), true, kind);
    }
    const msg = renderCollabNotification("milestone_submitted", {
      business: "Harbor Co",
      influencer: "Sofia Martinez",
      title: "Launch collab",
      milestone: "Draft delivery",
    });
    assert.match(msg.subject, /Influencer submitted/i);
    assert.match(msg.text, /Sofia Martinez/);
    assert.equal(msg.audience, "business");
  });

  it("fills funding and payout copy", () => {
    const funded = renderCollabNotification("funding_successful", {
      business: "Harbor Co",
      influencer: "Sofia",
      title: "Spring deal",
    });
    assert.match(funded.text, /Harbor Co/);
    assert.match(funded.text, /Sofia/);
    assert.equal(funded.audience, "both");
    const payout = renderCollabNotification("payout_completed", {
      influencer: "Sofia",
      title: "Spring deal",
      milestone: "Kickoff",
    });
    assert.match(payout.text, /Influencer payout/i);
  });

  it("maps marketplace events to notification kinds", () => {
    assert.equal(collabKindForMarketplaceEvent("funding.held"), "funding_successful");
    assert.equal(collabKindForMarketplaceEvent("funding.failed"), "funding_failed");
    assert.equal(collabKindForMarketplaceEvent("payout.released"), "payout_completed");
    assert.equal(collabKindForMarketplaceEvent("payout.refunded"), "refund_completed");
    assert.equal(collabKindForMarketplaceEvent("unknown"), null);
  });

  it("flags review deadlines inside the lead window only", () => {
    const now = new Date("2026-10-04T12:00:00.000Z");
    assert.equal(
      shouldNotifyReviewDeadline({
        milestoneStatus: "submitted",
        autoApproveAt: new Date("2026-10-04T20:00:00.000Z"),
        now,
        leadHours: 12,
      }),
      true,
    );
    assert.equal(
      shouldNotifyReviewDeadline({
        milestoneStatus: "submitted",
        autoApproveAt: new Date("2026-10-05T12:00:00.000Z"),
        now,
        leadHours: 12,
      }),
      false,
    );
    assert.equal(
      shouldNotifyReviewDeadline({
        milestoneStatus: "approved",
        autoApproveAt: new Date("2026-10-04T14:00:00.000Z"),
        now,
        leadHours: 12,
      }),
      false,
    );
    assert.equal(
      shouldNotifyReviewDeadline({
        milestoneStatus: "submitted",
        autoApproveAt: new Date("2026-10-04T11:00:00.000Z"),
        now,
        leadHours: 12,
      }),
      false,
    );
  });
});
