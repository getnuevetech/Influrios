import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  allowedCollaborationMoves,
  canReadCollaboration,
  collaborationMoveAllowed,
} from "./collaboration-access";

const proposal = {
  initiatorUserId: "user-a",
  initiatorSlug: "brand-a",
  recipientSlug: "maya",
  status: "sent",
};

describe("collaboration authorization", () => {
  it("denies an unrelated actor without treating their id as authority", () => {
    const actor = { userId: "unrelated-user-c", creatorSlug: "someone-else" };
    assert.equal(canReadCollaboration(proposal, actor), false);
    assert.equal(collaborationMoveAllowed(proposal, actor, "accepted").ok, false);
    assert.deepEqual(allowedCollaborationMoves(proposal, actor), []);
  });

  it("lets the recipient accept once and blocks the initiator from accepting", () => {
    assert.deepEqual(allowedCollaborationMoves(proposal, { userId: "user-a", creatorSlug: "brand-a" }), ["withdrawn"]);
    assert.equal(collaborationMoveAllowed(proposal, { userId: "user-a", creatorSlug: "brand-a" }, "accepted").ok, false);
    assert.deepEqual(allowedCollaborationMoves(proposal, { userId: "user-b", creatorSlug: "maya" }), [
      "accepted",
      "declined",
    ]);
  });

  it("does not let one account accept a proposal it also sent", () => {
    const self = { ...proposal, recipientSlug: "brand-a" };
    assert.equal(collaborationMoveAllowed(self, { userId: "user-a", creatorSlug: "brand-a" }, "accepted").ok, false);
  });
});
