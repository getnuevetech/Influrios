import assert from "node:assert/strict";
import { describe, it, beforeEach } from "node:test";
import {
  AUTH_LOCK_MAX_FAILS,
  AUTH_LOCKOUT_GENERIC_MESSAGE,
  lockoutMessage,
  recordAuthFailure,
  recordAuthSuccess,
  resetAuthLockoutsForTests,
} from "./auth-lockout";

describe("auth lockout", () => {
  beforeEach(() => {
    resetAuthLockoutsForTests();
  });

  it("locks after repeated failures in the window", () => {
    const scope = "admin-login" as const;
    const ip = "1.2.3.4";
    const id = "admin@example.com";
    for (let i = 0; i < AUTH_LOCK_MAX_FAILS; i++) {
      assert.equal(lockoutMessage(scope, ip, id), null);
      recordAuthFailure(scope, ip, id);
    }
    assert.equal(lockoutMessage(scope, ip, id), AUTH_LOCKOUT_GENERIC_MESSAGE);
  });

  it("clears on success", () => {
    const scope = "account-login" as const;
    const ip = "10.0.0.1";
    const id = "user@example.com";
    for (let i = 0; i < AUTH_LOCK_MAX_FAILS; i++) recordAuthFailure(scope, ip, id);
    assert.equal(lockoutMessage(scope, ip, id), AUTH_LOCKOUT_GENERIC_MESSAGE);
    recordAuthSuccess(scope, ip, id);
    assert.equal(lockoutMessage(scope, ip, id), null);
  });

  it("isolates scopes and identities", () => {
    for (let i = 0; i < AUTH_LOCK_MAX_FAILS; i++) {
      recordAuthFailure("admin-login", "1.1.1.1", "a@x.com");
    }
    assert.equal(lockoutMessage("admin-login", "1.1.1.1", "a@x.com"), AUTH_LOCKOUT_GENERIC_MESSAGE);
    assert.equal(lockoutMessage("account-login", "1.1.1.1", "a@x.com"), null);
    assert.equal(lockoutMessage("admin-login", "1.1.1.1", "b@x.com"), null);
  });
});
