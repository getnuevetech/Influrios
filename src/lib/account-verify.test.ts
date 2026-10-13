import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { normalizeVerificationCode } from "./accounts";

describe("account verification codes", () => {
  it("normalizes pasted codes with spaces", () => {
    assert.equal(normalizeVerificationCode(" 123 456 "), "123456");
    assert.equal(normalizeVerificationCode("987654"), "987654");
  });

  it("processes verification jobs by id instead of a shared backlog limit", () => {
    const jobs = readFileSync("src/lib/jobs.ts", "utf8");
    assert.match(jobs, /export async function processJobNow/);
    assert.match(jobs, /processJobNow\(job\.id\)/);
    assert.match(jobs, /queued: result === "succeeded"/);
  });

  it("reuses an active challenge on login and offers resend on the verify page", () => {
    const accounts = readFileSync("src/lib/accounts.ts", "utf8");
    const verify = readFileSync("src/app/account/verify/page.tsx", "utf8");
    const actions = readFileSync("src/app/account/actions.ts", "utf8");
    assert.match(accounts, /if \(!opts\?\.force\)/);
    assert.match(accounts, /activeEmailChallenge/);
    assert.match(accounts, /resendAccountVerification/);
    assert.match(verify, /actionResendVerification/);
    assert.match(verify, /Resend code/);
    assert.match(actions, /actionResendVerification/);
  });
});
