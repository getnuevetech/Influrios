import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it, beforeEach } from "node:test";
import {
  AUTH_LOCK_MAX_FAILS,
  AUTH_SUBJECT_MAX_FAILS,
  AUTH_LOCKOUT_GENERIC_MESSAGE,
  lockoutMessage,
  recordAuthFailure,
  recordAuthSuccess,
  resetAuthLockoutsForTests,
} from "./auth-lockout";
import { clientIpFrom } from "./client-ip";

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
      "src/app/collaboration/work/[fundingId]/layout.tsx",
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

  it("caps failures per email across IP addresses", async () => {
    // A forged or rotating IP gets a fresh per-IP bucket each time; the per-email cap still locks.
    for (let i = 0; i < AUTH_SUBJECT_MAX_FAILS; i++) {
      await recordAuthFailure("account-login", `10.0.0.${i}`, "rotate@x.com");
    }
    assert.equal(await lockoutMessage("account-login", "10.9.9.9", "rotate@x.com"), AUTH_LOCKOUT_GENERIC_MESSAGE);
    assert.equal(await lockoutMessage("account-login", "10.9.9.9", "other@x.com"), null);
  });

  it("reads the client IP from X-Real-IP or the last X-Forwarded-For entry", () => {
    const h = (entries: Record<string, string>) => new Headers(entries);
    assert.equal(clientIpFrom(h({ "x-real-ip": "198.51.100.4", "x-forwarded-for": "1.2.3.4, 198.51.100.4" })), "198.51.100.4");
    assert.equal(clientIpFrom(h({ "x-forwarded-for": "1.2.3.4, 198.51.100.4" })), "198.51.100.4");
    assert.equal(clientIpFrom(h({})), "unknown");
    for (const file of [
      "src/app/account/actions.ts",
      "src/app/admin/actions-auth.ts",
      "src/app/business/signup-actions.ts",
      "src/app/claim/actions.ts",
      "src/app/api/intelligence/export/route.ts",
    ]) {
      const text = readFileSync(file, "utf8");
      assert.doesNotMatch(text, /x-forwarded-for"\)\?\.split\(","\)\[0\]/, file);
      assert.match(text, /clientIpFrom/, file);
    }
  });

  it("only lets the draft's own visitor or account claim it", () => {
    const claim = readFileSync("src/lib/claim.ts", "utf8");
    const body = claim.slice(claim.indexOf("export async function claimDraft("));
    assert.ok(body.indexOf("assertCanMutateDraft(input.draftId)") > -1);
    assert.ok(body.indexOf("assertCanMutateDraft(input.draftId)") < body.indexOf("advanceClaimStage("));
    const actions = readFileSync("src/app/claim/actions.ts", "utf8");
    const media = actions.slice(actions.indexOf("export async function actionUpdateProfileMedia"));
    assert.ok(media.indexOf("assertCanMutateDraft(draftId)") < media.indexOf("saveAvatarUpload(file)"));
  });
});
