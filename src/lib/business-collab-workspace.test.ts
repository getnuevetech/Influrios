import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { activeRowForApplication, requestMatchesFilter, requestQueueRow } from "./business-collab-workspace";

describe("business collaboration workspace", () => {
  it("sends an accepted request to Active instead of the editor", () => {
    const row = requestQueueRow({
      id: "brief-1",
      title: "Weekend Edit",
      briefStatus: "active",
      published: false,
      inviteCount: 2,
      applicationCount: 0,
      acceptedCount: 1,
      updatedLabel: "Today",
    });
    assert.equal(row.actionLabel, "Open collaboration");
    assert.match(row.actionHref, /tab=active/);
    assert.equal(row.actionHref.includes("/request/"), false);
    assert.deepEqual(row.facts, ["Private"]);
    assert.match(row.activity, /1 accepted/);
  });

  it("keeps a public listing and private invites as separate facts", () => {
    const row = requestQueueRow({
      id: "brief-2",
      title: "Summer Launch",
      briefStatus: "active",
      published: true,
      inviteCount: 2,
      applicationCount: 3,
      acceptedCount: 0,
      updatedLabel: "Yesterday",
    });
    assert.deepEqual(row.facts, ["Public listing", "Private"]);
    assert.equal(row.actionLabel, "View responses");
    assert.equal(requestMatchesFilter(row.facts, "published"), true);
    assert.equal(requestMatchesFilter(row.facts, "drafts"), false);
  });

  it("leaves an unanswered invite off the active queue", () => {
    assert.equal(
      activeRowForApplication({
        id: "app-1",
        status: "REQUESTED",
        title: "Studio North",
        influencer: "Ava",
        hasContract: false,
      }),
      null,
    );
    const accepted = activeRowForApplication({
      id: "app-2",
      status: "ACCEPTED",
      title: "Spring Essentials",
      influencer: "Ella Brooks",
      hasContract: false,
    });
    assert.equal(accepted?.bucket, "needs_action");
    assert.equal(accepted?.stage, "Agreement review");
    const funded = activeRowForApplication({
      id: "app-3",
      status: "ACCEPTED",
      title: "4th Test Campaign",
      influencer: "Ag Olomola",
      hasContract: true,
      fundingStatus: "held",
    });
    assert.equal(funded?.stage, "Content production");
    assert.equal(funded?.badge, "In progress");
    assert.equal(funded?.bucket, "in_progress");
    const waiting = activeRowForApplication({
      id: "app-4",
      status: "ACCEPTED",
      title: "2nd Collaboration Test",
      influencer: "Ag Olomola",
      hasContract: true,
      fundingStatus: "awaiting_provider",
    });
    assert.equal(waiting?.badge, "Funds not confirmed");
    assert.match(accepted?.href ?? "", /tab=active&deal=/);
  });
});
