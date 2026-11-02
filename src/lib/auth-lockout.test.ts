import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
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

  it("locks after repeated failures in the window", async () => {
    const scope = "admin-login" as const;
    const ip = "1.2.3.4";
    const id = "admin@example.com";
    for (let i = 0; i < AUTH_LOCK_MAX_FAILS; i++) {
      assert.equal(await lockoutMessage(scope, ip, id), null);
      await recordAuthFailure(scope, ip, id);
    }
    assert.equal(await lockoutMessage(scope, ip, id), AUTH_LOCKOUT_GENERIC_MESSAGE);
  });

  it("clears on success", async () => {
    const scope = "account-login" as const;
    const ip = "10.0.0.1";
    const id = "user@example.com";
    for (let i = 0; i < AUTH_LOCK_MAX_FAILS; i++) await recordAuthFailure(scope, ip, id);
    assert.equal(await lockoutMessage(scope, ip, id), AUTH_LOCKOUT_GENERIC_MESSAGE);
    await recordAuthSuccess(scope, ip, id);
    assert.equal(await lockoutMessage(scope, ip, id), null);
  });

  it("isolates scopes and identities", async () => {
    for (let i = 0; i < AUTH_LOCK_MAX_FAILS; i++) {
      await recordAuthFailure("admin-login", "1.1.1.1", "a@x.com");
    }
    assert.equal(await lockoutMessage("admin-login", "1.1.1.1", "a@x.com"), AUTH_LOCKOUT_GENERIC_MESSAGE);
    assert.equal(await lockoutMessage("account-login", "1.1.1.1", "a@x.com"), null);
    assert.equal(await lockoutMessage("admin-login", "1.1.1.1", "b@x.com"), null);
  });

  it("keeps collaboration money/collab layouts behind a signed-in session", () => {
    for (const file of [
      "src/app/collaboration/applications/layout.tsx",
      "src/app/collaboration/contracts/layout.tsx",
      "src/app/collaboration/team/layout.tsx",
    ]) {
      const text = readFileSync(file, "utf8");
      assert.match(text, /getAccountSession/);
      assert.match(text, /redirect\(/);
    }
    assert.match(
      readFileSync("src/app/collaboration/contract/layout.tsx", "utf8"),
      /requireBusinessSession\("\/collaboration\/contract"\)/,
    );
    const exportRoute = readFileSync("src/app/api/intelligence/export/route.ts", "utf8");
    assert.match(exportRoute, /isBusinessRole/);
    assert.match(exportRoute, /intelligence-export/);
    assert.match(exportRoute, /429/);
  });
});
