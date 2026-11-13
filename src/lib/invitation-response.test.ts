import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { applicationLinkPlan } from "./collaboration-links";
import { inviteeResponsePlan } from "./marketplace-listings";

describe("invitation popup response", () => {
  it("records interest from a new invitation without accepting the work", () => {
    const plan = inviteeResponsePlan({ status: "REQUESTED", intent: "interested" });
    assert.equal(plan.ok, true);
    if (!plan.ok) return;
    assert.deepEqual(plan.steps, ["VIEWED", "RESPONDED"]);
    assert.equal(plan.steps.includes("ACCEPTED"), false);
    assert.equal(plan.steps.includes("COLLABORATION_DRAFTED"), false);
    assert.equal(
      applicationLinkPlan({ id: "app", status: "RESPONDED", collaborationId: null, fromSlug: null, toSlug: "maya" }),
      "keep",
    );
  });

  it("asks a question only with a note and ends in negotiation", () => {
    const missing = inviteeResponsePlan({ status: "VIEWED", intent: "question", note: "short" });
    assert.equal(missing.ok, false);
    const plan = inviteeResponsePlan({
      status: "VIEWED",
      intent: "question",
      note: "Can the first post stay on the brief?",
    });
    assert.equal(plan.ok, true);
    if (!plan.ok) return;
    assert.deepEqual(plan.steps, ["RESPONDED", "NEGOTIATING"]);
    assert.equal(plan.note, "Can the first post stay on the brief?");
  });

  it("declines directly and rejects an expired invitation", () => {
    const decline = inviteeResponsePlan({ status: "REQUESTED", intent: "decline" });
    assert.equal(decline.ok, true);
    if (!decline.ok) return;
    assert.deepEqual(decline.steps, ["DECLINED"]);
    const expired = inviteeResponsePlan({
      status: "REQUESTED",
      intent: "interested",
      responseDeadline: "2020-01-01T00:00:00.000Z",
      now: new Date("2026-11-13T00:00:00.000Z"),
    });
    assert.equal(expired.ok, false);
    const closed = inviteeResponsePlan({ status: "ACCEPTED", intent: "decline" });
    assert.equal(closed.ok, false);
  });
});
