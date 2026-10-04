import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  decideGuestCollabGate,
  guestCollabLimitsFromPlane,
} from "./guest-usage";
import { DEFAULT_COLLAB_CONTROL_PLANE } from "./collab-control-plane";
import { decideGuestGate } from "./account-policy";

describe("P6 guest collab propose/apply quotas", () => {
  it("maps control-plane thresholds into propose/apply soft-hard limits", () => {
    const limits = guestCollabLimitsFromPlane(DEFAULT_COLLAB_CONTROL_PLANE.guestCollab);
    assert.equal(limits.propose.soft, 1);
    assert.equal(limits.propose.hard, 2);
    assert.equal(limits.apply.soft, 2);
    assert.equal(limits.apply.hard, 3);
  });

  it("softens then hard-stops guest propose attempts", () => {
    const limits = guestCollabLimitsFromPlane(DEFAULT_COLLAB_CONTROL_PLANE.guestCollab).propose;
    assert.equal(decideGuestCollabGate(0, limits, false), "allow");
    assert.equal(decideGuestCollabGate(1, limits, false), "soft");
    assert.equal(decideGuestCollabGate(2, limits, false), "hard");
    assert.equal(decideGuestCollabGate(99, limits, true), "allow");
  });

  it("softens then hard-stops guest apply attempts", () => {
    const limits = guestCollabLimitsFromPlane(DEFAULT_COLLAB_CONTROL_PLANE.guestCollab).apply;
    assert.equal(decideGuestGate(1, limits, false), "allow");
    assert.equal(decideGuestCollabGate(2, limits, false), "soft");
    assert.equal(decideGuestCollabGate(3, limits, false), "hard");
  });
});
