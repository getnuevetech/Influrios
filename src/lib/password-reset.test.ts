import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { resetPasswordScreen } from "./password-reset";

describe("expired password reset", () => {
  it("offers a new request when the link is missing or unusable", () => {
    assert.equal(resetPasswordScreen({ hasToken: false, usable: false }), "request-link");
    assert.equal(resetPasswordScreen({ hasToken: true, usable: false }), "request-link");
    assert.equal(resetPasswordScreen({ hasToken: true, usable: true }), "choose-password");
  });

  it("keeps the password form off an expired link and still rejects it on the server", () => {
    const page = readFileSync("src/app/account/reset/page.tsx", "utf8");
    const accounts = readFileSync("src/lib/accounts.ts", "utf8");
    assert.match(page, /resetPasswordScreen/);
    assert.match(page, /passwordResetUsable/);
    assert.match(page, /actionRequestReset/);
    assert.match(page, /screen === "choose-password"/);
    assert.match(accounts, /row\.usedAt \|\| row\.expiresAt < new Date\(\)/);
    assert.match(accounts, /export async function passwordResetUsable/);
  });
});
