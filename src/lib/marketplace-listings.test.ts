import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  applicationTransitionLabel,
  canTransitionApplication,
  MARKETPLACE_APPLICATION_STATUSES,
  nextApplicationStatuses,
} from "./marketplace-listings";

describe("marketplace application state machine", () => {
  it("exposes the Collab OS invitation statuses", () => {
    assert.ok(MARKETPLACE_APPLICATION_STATUSES.includes("REQUESTED"));
    assert.ok(MARKETPLACE_APPLICATION_STATUSES.includes("COLLABORATION_DRAFTED"));
    assert.ok(MARKETPLACE_APPLICATION_STATUSES.includes("WITHDRAWN"));
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

  it("lists next statuses and readable transition labels (W2.3c)", () => {
    assert.deepEqual(nextApplicationStatuses("REQUESTED"), [
      "VIEWED",
      "DECLINED",
      "EXPIRED",
      "WITHDRAWN",
    ]);
    assert.deepEqual(nextApplicationStatuses("ACCEPTED"), ["COLLABORATION_DRAFTED", "WITHDRAWN"]);
    assert.equal(applicationTransitionLabel("COLLABORATION_DRAFTED"), "Draft contract");
    assert.equal(applicationTransitionLabel("VIEWED"), "Mark viewed");
  });
});
