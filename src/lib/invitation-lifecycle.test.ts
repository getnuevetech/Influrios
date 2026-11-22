import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { inviteeInvitationView, withdrawalReasonFromNote } from "./invitation-turn";
import { noticeNeedsAction } from "./notice-filters";
import { invitationNoticeSource } from "./notice-tasks";

describe("invitation lifecycle (S2 · P1-AUD-01..05)", () => {
  it("reads the recorded withdrawal reason and never invents one", () => {
    assert.equal(withdrawalReasonFromNote("[Withdrawn by business] The campaign moved to spring. "), "The campaign moved to spring");
    assert.equal(withdrawalReasonFromNote("[Withdrawn by business] Budget changed. We'll be in touch."), "Budget changed");
    assert.equal(withdrawalReasonFromNote("[Withdrawn by business] . "), null);
    assert.equal(withdrawalReasonFromNote("Opened for review"), null);
    assert.equal(withdrawalReasonFromNote(null), null);
  });

  it("withdrawn panel carries the reason from the WITHDRAWN event", () => {
    const view = inviteeInvitationView(
      {
        status: "WITHDRAWN",
        turn: "none",
        events: [
          { note: "Invitation sent", toStatus: "REQUESTED" },
          { note: "[Withdrawn by business] The campaign moved to spring. ", toStatus: "WITHDRAWN" },
        ],
      },
      "Northwind Studio",
    );
    assert.equal(view.closedAs, "withdrawn");
    assert.equal(view.label, "Withdrawn");
    assert.equal(view.withdrawnReason, "The campaign moved to spring");
    assert.equal(view.withdrawnMessage, null);
    const none = inviteeInvitationView({ status: "WITHDRAWN", turn: "none", events: [{ note: "", toStatus: "WITHDRAWN" }] }, "Northwind Studio");
    assert.equal(none.withdrawnReason, null);
  });

  it("past the Respond-by date shows Expired and allows nothing", () => {
    const view = inviteeInvitationView(
      { status: "VIEWED", turn: "invitee", responseDeadline: "2020-01-01T00:00:00.000Z" },
      "Northwind Studio",
      new Date("2026-11-22"),
    );
    assert.equal(view.kase, "closed");
    assert.equal(view.closedAs, "expired");
    assert.deepEqual(view.actions, { interested: false, ask: null, decline: false });
  });

  it("withdrawal / expiry notices are history, not Action required", () => {
    assert.equal(noticeNeedsAction("invitation", "Northwind invited you"), true);
    assert.equal(noticeNeedsAction("invitation_withdrawn", "Northwind withdrew an invitation"), false);
    assert.equal(noticeNeedsAction("invitation_expired", "An invitation expired"), false);
  });

  it("maps invitation notices to the task they track", () => {
    assert.deepEqual(invitationNoticeSource({ kind: "invitation", sourceId: "invitation:abc" }), { type: "application", id: "abc" });
    assert.deepEqual(invitationNoticeSource({ kind: "invitation", sourceId: "invitation:team:p1" }), { type: "team", id: "p1" });
    assert.equal(invitationNoticeSource({ kind: "agreement", sourceId: "agreement:c1" }), null);
  });
});
