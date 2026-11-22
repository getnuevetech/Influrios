import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  businessInvitationActions,
  invitationPastDeadline,
  responseDeadlineEnd,
  invitationCase,
  invitationIsOpen,
  invitationWaitingForInvitee,
  inviteeActionsFor,
  planBusinessAnswer,
  planInviteeResponse,
  type InvitationState,
} from "./invitation-turn";
import { canTransitionApplication } from "./marketplace-listings";

const fresh: InvitationState = { status: "VIEWED", turn: "invitee", interestRecorded: false, openQuestion: false };

function walk(state: InvitationState, steps: string[]) {
  let from = state.status;
  for (const step of steps) {
    assert.equal(canTransitionApplication(from, step), true, `${from} → ${step} must be a legal transition`);
    from = step;
  }
}

describe("invitation action matrix (master-spec §2.2b)", () => {
  it("case 1 → I'm interested → case 4, turn business", () => {
    const plan = planInviteeResponse({ ...fresh, status: "REQUESTED" }, "interested");
    assert.ok(plan);
    assert.deepEqual(plan.steps, ["VIEWED", "RESPONDED"]);
    walk({ ...fresh, status: "REQUESTED" }, plan.steps);
    assert.equal(invitationCase(plan.next), 4);
    assert.equal(plan.next.turn, "business");
    assert.equal(plan.next.interestRecorded, true);
  });

  it("case 1 → question → case 2 without recording interest", () => {
    const plan = planInviteeResponse(fresh, "question");
    assert.ok(plan);
    assert.deepEqual(plan.steps, ["NEGOTIATING"]);
    walk(fresh, plan.steps);
    assert.equal(invitationCase(plan.next), 2);
    assert.equal(plan.next.interestRecorded, false);
    assert.deepEqual(inviteeActionsFor(2), { interested: false, ask: null, decline: true });
  });

  it("business answer before interest: case 2 → 3, turn back to invitee (P1-D1 path)", () => {
    const asked = planInviteeResponse(fresh, "question")!.next;
    const answered = planBusinessAnswer(asked);
    assert.ok(answered);
    assert.equal(invitationCase(answered.next), 3);
    assert.equal(answered.next.turn, "invitee");
    assert.equal(invitationWaitingForInvitee(answered.next), true);
    const interested = planInviteeResponse(answered.next, "interested");
    assert.ok(interested);
    assert.deepEqual(interested.steps, ["RESPONDED"]);
    walk(answered.next, interested.steps);
    assert.equal(invitationCase(interested.next), 4);
    const another = planInviteeResponse(answered.next, "question");
    assert.ok(another);
    assert.deepEqual(another.steps, []);
    assert.equal(invitationCase(another.next), 2);
  });

  it("follow-up after interest keeps turn with the business (cases 4 → 5 → 6)", () => {
    const interested = planInviteeResponse(fresh, "interested")!.next;
    const followUp = planInviteeResponse(interested, "question");
    assert.ok(followUp);
    assert.deepEqual(followUp.steps, ["NEGOTIATING"]);
    walk(interested, followUp.steps);
    assert.equal(invitationCase(followUp.next), 5);
    assert.equal(followUp.next.turn, "business");
    assert.equal(invitationWaitingForInvitee(followUp.next), false);
    const answered = planBusinessAnswer(followUp.next)!;
    assert.equal(invitationCase(answered.next), 6);
    assert.equal(answered.next.turn, "business");
    assert.equal(invitationWaitingForInvitee(answered.next), false);
    // Case 6 can ask another follow-up but never re-record interest.
    assert.equal(planInviteeResponse(answered.next, "interested"), null);
    assert.ok(planInviteeResponse(answered.next, "question"));
  });

  it("rejects actions the case doesn't allow", () => {
    const asked = planInviteeResponse(fresh, "question")!.next;
    assert.equal(planInviteeResponse(asked, "question"), null);
    assert.equal(planInviteeResponse(asked, "interested"), null);
    assert.ok(planInviteeResponse(asked, "decline"));
    const interested = planInviteeResponse(fresh, "interested")!.next;
    assert.equal(planInviteeResponse(interested, "interested"), null);
    assert.equal(planBusinessAnswer(interested), null);
  });

  it("closed and past-deadline invitations allow nothing and count nowhere", () => {
    for (const status of ["ACCEPTED", "COLLABORATION_DRAFTED", "DECLINED", "EXPIRED", "WITHDRAWN"]) {
      const state = { ...fresh, status, turn: "none" as const };
      assert.equal(invitationCase(state), "closed");
      assert.equal(planInviteeResponse(state, "decline"), null);
      assert.equal(invitationIsOpen(state), false);
    }
    const past = { ...fresh, responseDeadline: "2020-01-01T00:00:00.000Z" };
    assert.equal(invitationWaitingForInvitee(past, new Date("2026-11-21")), false);
    assert.equal(invitationIsOpen(past, new Date("2026-11-21")), false);
    assert.equal(planInviteeResponse(fresh, "interested", { responseDeadline: "2020-01-01", now: new Date("2026-11-21") }), null);
  });

  it("decline closes the invitation with no turn", () => {
    const plan = planInviteeResponse({ ...fresh, status: "REQUESTED" }, "decline")!;
    assert.deepEqual(plan.steps, ["DECLINED"]);
    assert.equal(plan.next.turn, "none");
    assert.equal(invitationCase(plan.next), "closed");
  });

  it("only the business accepts, and only after interest is recorded", () => {
    assert.deepEqual(businessInvitationActions(fresh).actions, ["WITHDRAWN"]);
    const asked = planInviteeResponse(fresh, "question")!.next;
    assert.deepEqual(businessInvitationActions(asked), { actions: ["DECLINED", "WITHDRAWN"], canAnswer: true });
    const interested = planInviteeResponse(fresh, "interested")!.next;
    assert.deepEqual(businessInvitationActions(interested), { actions: ["ACCEPTED", "DECLINED", "WITHDRAWN"], canAnswer: false });
    assert.equal(canTransitionApplication("RESPONDED", "ACCEPTED"), true);
    assert.equal(canTransitionApplication("NEGOTIATING", "ACCEPTED"), true);
  });

  it("projections: waiting = cases 1 and 3; open = cases 1–6", () => {
    const states: [InvitationState, boolean][] = [
      [fresh, true],
      [planInviteeResponse(fresh, "question")!.next, false],
      [planBusinessAnswer(planInviteeResponse(fresh, "question")!.next)!.next, true],
      [planInviteeResponse(fresh, "interested")!.next, false],
    ];
    for (const [state, waiting] of states) {
      assert.equal(invitationWaitingForInvitee(state), waiting);
      assert.equal(invitationIsOpen(state), true);
    }
  });
});

describe("Respond-by date covers its whole day", () => {
  it("a date-only deadline stays open until the end of that UTC day", () => {
    const due = "2026-11-22T00:00:00.000Z"; // how a Respond-by date of 22 Nov is stored
    const state = { status: "REQUESTED", turn: "invitee", interestRecorded: false, openQuestion: false, responseDeadline: due };
    assert.equal(invitationWaitingForInvitee(state, new Date("2026-11-22T02:32:00Z")), true);
    assert.equal(invitationWaitingForInvitee(state, new Date("2026-11-22T23:59:59Z")), true);
    assert.equal(invitationWaitingForInvitee(state, new Date("2026-11-23T00:00:01Z")), false);
    assert.equal(invitationPastDeadline("2026-11-22", new Date("2026-11-22T12:00:00Z")), false);
  });
  it("a deadline with a time of day is exact", () => {
    assert.equal(invitationPastDeadline("2026-11-22T10:00:00.000Z", new Date("2026-11-22T10:00:01Z")), true);
    assert.equal(responseDeadlineEnd(null), null);
  });
});
