import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  agencyInviteExpiry,
  agencyInvitePath,
  agencySeatAccessGate,
  asAgencySeatRole,
  canUseAgencySeatSession,
  isValidSeatEmail,
  normalizeSeatEmail,
  newAgencyInviteToken,
} from "./agency-seats";

describe("agency seat invite helpers (L3)", () => {
  it("normalizes email and validates shape", () => {
    assert.equal(normalizeSeatEmail("  Ops@Agency.Demo "), "ops@agency.demo");
    assert.equal(isValidSeatEmail("ops@agency.demo"), true);
    assert.equal(isValidSeatEmail("not-an-email"), false);
    assert.equal(asAgencySeatRole("owner"), "owner");
    assert.equal(asAgencySeatRole("intern"), "member");
  });

  it("builds invite path and expiry window", () => {
    const token = newAgencyInviteToken();
    assert.ok(token.length >= 20);
    assert.equal(agencyInvitePath(token), `/agency/invite/${token}`);
    const from = new Date("2026-10-04T00:00:00.000Z");
    assert.equal(agencyInviteExpiry(from, 14).toISOString(), "2026-10-18T00:00:00.000Z");
  });

  it("gates pending invites by expiry and refuses revoked", () => {
    const now = new Date("2026-10-10T00:00:00.000Z");
    assert.equal(
      agencySeatAccessGate({
        seatsEnabled: false,
        inviteStatus: "pending",
        active: true,
        expiresAt: null,
        now,
      }).ok,
      false,
    );
    assert.equal(
      agencySeatAccessGate({
        seatsEnabled: true,
        inviteStatus: "revoked",
        active: true,
        expiresAt: null,
        now,
      }).ok,
      false,
    );
    assert.equal(
      agencySeatAccessGate({
        seatsEnabled: true,
        inviteStatus: "pending",
        active: false,
        expiresAt: new Date("2026-10-20T00:00:00.000Z"),
        now,
      }).ok,
      true,
    );
    assert.equal(
      agencySeatAccessGate({
        seatsEnabled: true,
        inviteStatus: "pending",
        active: false,
        expiresAt: new Date("2026-10-01T00:00:00.000Z"),
        now,
      }).ok,
      false,
    );
  });

  it("only accepted active seats unlock session auth", () => {
    assert.equal(
      canUseAgencySeatSession({ seatsEnabled: true, inviteStatus: "accepted", active: true }),
      true,
    );
    assert.equal(
      canUseAgencySeatSession({ seatsEnabled: true, inviteStatus: "pending", active: true }),
      false,
    );
    assert.equal(
      canUseAgencySeatSession({ seatsEnabled: true, inviteStatus: "accepted", active: false }),
      false,
    );
    assert.equal(
      canUseAgencySeatSession({ seatsEnabled: false, inviteStatus: "accepted", active: true }),
      false,
    );
  });
});
