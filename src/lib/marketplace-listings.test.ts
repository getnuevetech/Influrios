import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  applicationTransitionLabel,
  businessOwnsApplication,
  canTransitionApplication,
  creatorOwnsApplication,
  isWorkspaceOwnedRequestBrand,
  MARKETPLACE_APPLICATION_STATUSES,
  nextApplicationStatuses,
} from "./marketplace-listings";

describe("marketplace application state machine", () => {
  it("exposes the Collab OS invitation statuses", () => {
    assert.ok(MARKETPLACE_APPLICATION_STATUSES.includes("REQUESTED"));
    assert.ok(MARKETPLACE_APPLICATION_STATUSES.includes("COLLABORATION_DRAFTED"));
    assert.ok(MARKETPLACE_APPLICATION_STATUSES.includes("WITHDRAWN"));
    assert.ok(MARKETPLACE_APPLICATION_STATUSES.includes("EXPIRED"));
  });

  it("allows REQUESTED → VIEWED and blocks terminal re-entry", () => {
    assert.equal(canTransitionApplication("REQUESTED", "VIEWED"), true);
    assert.equal(canTransitionApplication("REQUESTED", "ACCEPTED"), false);
    assert.equal(canTransitionApplication("DECLINED", "REQUESTED"), false);
    assert.equal(canTransitionApplication("COLLABORATION_DRAFTED", "ACCEPTED"), false);
  });

  it("allows the happy path to collaboration draft", () => {
    assert.equal(canTransitionApplication("VIEWED", "RESPONDED"), true);
    assert.equal(canTransitionApplication("RESPONDED", "NEGOTIATING"), true);
    assert.equal(canTransitionApplication("NEGOTIATING", "ACCEPTED"), true);
    assert.equal(canTransitionApplication("ACCEPTED", "COLLABORATION_DRAFTED"), true);
  });

  it("lists next statuses including EXPIRED and readable transition labels (W2.3c)", () => {
    assert.deepEqual(nextApplicationStatuses("REQUESTED"), [
      "VIEWED",
      "DECLINED",
      "EXPIRED",
      "WITHDRAWN",
    ]);
    assert.deepEqual(nextApplicationStatuses("ACCEPTED"), ["COLLABORATION_DRAFTED", "WITHDRAWN"]);
    assert.equal(applicationTransitionLabel("COLLABORATION_DRAFTED"), "Draft contract");
    assert.equal(applicationTransitionLabel("VIEWED"), "Mark viewed");
    assert.equal(applicationTransitionLabel("EXPIRED"), "Mark expired");
  });
});

describe("marketplace application ownership guards (W2.3c)", () => {
  it("matches workspace-owned request brands", () => {
    assert.equal(isWorkspaceOwnedRequestBrand("Luminous Beauty", "Luminous Beauty"), true);
    assert.equal(isWorkspaceOwnedRequestBrand("Luminous Beauty Co.", "Luminous Beauty"), true);
    assert.equal(isWorkspaceOwnedRequestBrand("Other Brand", "Luminous Beauty"), false);
    assert.equal(isWorkspaceOwnedRequestBrand("", "Luminous Beauty"), false);
  });

  it("recognizes creator parties on either side", () => {
    assert.equal(creatorOwnsApplication({ fromSlug: "sofia-martinez", toSlug: null }, "sofia-martinez"), true);
    assert.equal(creatorOwnsApplication({ fromSlug: null, toSlug: "sofia-martinez" }, "sofia-martinez"), true);
    assert.equal(creatorOwnsApplication({ fromSlug: "other", toSlug: null }, "sofia-martinez"), false);
  });

  it("requires businessRequestId to be in the owned set", () => {
    assert.equal(businessOwnsApplication({ businessRequestId: "req-1" }, ["req-1", "req-2"]), true);
    assert.equal(businessOwnsApplication({ businessRequestId: "req-9" }, ["req-1"]), false);
    assert.equal(businessOwnsApplication({ businessRequestId: null }, ["req-1"]), false);
  });
});
