import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { payoutStateFrom, payoutStateView } from "@/lib/payout-state";
import { openSetupReminders } from "@/lib/account-nav";

const base = {
  countryCode: "US",
  corridorActive: true,
  routeReady: true,
  identityVerified: false,
  primaryStatus: null as string | null,
  accountOnFile: false,
  payoutVerified: false,
};

describe("six payout states (master-spec 2.1)", () => {
  it("nothing started is setup required", () => {
    assert.equal(payoutStateFrom(base), "setup_required");
  });
  it("a saved but unverified account is never ready", () => {
    assert.equal(payoutStateFrom({ ...base, identityVerified: true, accountOnFile: true, primaryStatus: "UNVERIFIED" }), "setup_required");
  });
  it("everything submitted and under review is verification pending, with no action", () => {
    const state = payoutStateFrom({ ...base, identitySubmitted: true, accountOnFile: true, primaryStatus: "PENDING" });
    assert.equal(state, "verification_pending");
    const view = payoutStateView(state);
    assert.equal(view.action, null);
    assert.equal(view.needsAction, false);
    assert.doesNotMatch(view.message, /Complete setup|Continue|1–2 business days|We'll email/);
  });
  it("identity verified and provider verified is ready", () => {
    assert.equal(payoutStateFrom({ ...base, identityVerified: true, accountOnFile: true, primaryStatus: "VERIFIED", payoutVerified: true }), "ready");
  });
  it("a rejection asks for one action", () => {
    const state = payoutStateFrom({ ...base, identityVerified: true, accountOnFile: true, primaryStatus: "REJECTED" });
    assert.equal(state, "action_required");
    assert.equal(payoutStateView(state).needsAction, true);
  });
  it("no payout route in the country is not available", () => {
    const state = payoutStateFrom({ ...base, corridorActive: false });
    assert.equal(state, "not_available");
    assert.match(payoutStateView(state, { country: "Ghana" }).message, /aren't available in Ghana/);
  });
  it("status unavailable never claims ready or setup required", () => {
    const view = payoutStateView("status_unavailable");
    assert.equal(view.label, "Status unavailable");
    assert.equal(view.needsAction, false);
  });
  it("home reminds only for setup required and action required", () => {
    const reminder = (payoutState: Parameters<typeof openSetupReminders>[0]["payoutState"]) =>
      openSetupReminders({ emailVerified: true, published: true, socialConnected: true, payoutReady: false, payoutState }).map((row) => row.id);
    assert.deepEqual(reminder("setup_required"), ["payout"]);
    assert.deepEqual(reminder("action_required"), ["payout"]);
    assert.deepEqual(reminder("verification_pending"), []);
    assert.deepEqual(reminder("not_available"), []);
    assert.deepEqual(reminder("status_unavailable"), []);
    assert.deepEqual(reminder("ready"), []);
  });
});
