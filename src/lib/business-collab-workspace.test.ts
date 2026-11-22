import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { activeRowForApplication, requestMatchesFilter, requestQueueRow } from "./business-collab-workspace";

describe("business collaboration workspace", () => {
  it("keeps View request and adds Open collaboration when someone is accepted", () => {
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
    assert.equal(row.actionLabel, "View");
    assert.match(row.actionHref, /tab=requests&request=/);
    assert.ok(row.openCollaborationHref);
    assert.match(row.openCollaborationHref ?? "", /tab=active/);
    assert.equal(row.status, "Open");
    assert.equal(row.visibility, "Invite only");
    assert.match(row.responses, /2 invited/);
    assert.match(row.responses, /1 accepted/);
  });

  it("keeps public visibility when invites are also sent", () => {
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
    assert.equal(row.status, "Open");
    assert.equal(row.visibility, "Public");
    assert.equal(row.facts.includes("Private"), false);
    assert.equal(row.actionLabel, "View");
    assert.equal(requestMatchesFilter(row.facts, "published"), true);
    assert.equal(requestMatchesFilter(row.facts, "drafts"), false);
    assert.equal(row.open, true);
    assert.equal(requestMatchesFilter(row.facts, "open", row.open), true);
    const draft = requestQueueRow({
      id: "brief-3",
      title: "Draft",
      briefStatus: "draft",
      published: false,
      inviteCount: 0,
      applicationCount: 0,
      acceptedCount: 0,
      updatedLabel: "Today",
    });
    assert.equal(draft.status, "Draft");
    assert.equal(draft.responses, "No invitations");
    assert.equal(draft.open, false);
    assert.equal(requestMatchesFilter(draft.facts, "open", draft.open), false);
  });

  it("leaves an unanswered invite off the active queue and separates contract funding payout", () => {
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
    assert.equal(accepted?.contractStatus, "Not signed");
    assert.equal(accepted?.fundingStatus, "Not started");
    assert.equal(accepted?.payoutStatus, "Not started");
    assert.equal(accepted?.nextAction, "Create the agreement");
    const funded = activeRowForApplication({
      id: "app-3",
      status: "ACCEPTED",
      title: "4th Test Campaign",
      influencer: "Ag Olomola",
      hasContract: true,
      fundingStatus: "held",
    });
    assert.equal(funded?.stage, "Content production");
    assert.equal(funded?.fundingStatus, "Confirmed");
    assert.equal(funded?.payoutStatus, "Processing");
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
    assert.equal(waiting?.fundingStatus, "Awaiting");
    assert.match(accepted?.href ?? "", /tab=active&deal=/);
  });
});

describe("request status after private invitations", () => {
  it("a draft that already sent invitations shows as Open, invite only", () => {
    const row = requestQueueRow({
      id: "b1", title: "Claude Second Invite", briefStatus: "draft", published: false,
      inviteCount: 3, applicationCount: 0, acceptedCount: 0, updatedLabel: "today",
    });
    assert.equal(row.status, "Open");
    assert.equal(row.visibility, "Invite only");
    const draft = requestQueueRow({
      id: "b2", title: "Unsent", briefStatus: "draft", published: false,
      inviteCount: 0, applicationCount: 0, acceptedCount: 0, updatedLabel: "today",
    });
    assert.equal(draft.status, "Draft");
  });
});
