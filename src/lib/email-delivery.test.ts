import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { claimEmailCanVerify } from "./claim";

function source(path: string) {
  return readFileSync(path, "utf8");
}

describe("email delivery", () => {
  it("accepts a claim code only after the email was sent", () => {
    assert.equal(claimEmailCanVerify("email"), true);
    assert.equal(claimEmailCanVerify("demo"), false);
    assert.equal(claimEmailCanVerify("unsent"), false);
    assert.equal(claimEmailCanVerify(undefined), false);
    assert.equal(claimEmailCanVerify("DEMO_CODE"), false);
  });

  it("does not show a verification code or reset link on the page", () => {
    const verify = source("src/app/account/verify/page.tsx");
    const reset = source("src/app/account/reset/page.tsx");
    const claim = source("src/app/claim/verify/[draftId]/page.tsx");
    const actions = source("src/app/account/actions.ts");
    const accounts = source("src/lib/accounts.ts");
    const jobs = source("src/lib/jobs.ts");
    const claimLib = source("src/lib/claim.ts");
    const request = actions.slice(actions.indexOf("actionRequestReset"), actions.indexOf("actionResetPassword"));

    assert.equal(verify.includes("latestDemoCode"), false);
    assert.equal(verify.includes("Demo code"), false);
    assert.equal(reset.includes("shown here"), false);
    assert.equal(claim.includes("verifyCode"), false);
    assert.equal(claim.includes("Demo code"), false);
    assert.equal(request.includes("token="), false);
    assert.equal(accounts.includes("latestDemoCode"), false);
    assert.equal(accounts.includes("mailReady"), true);
    assert.equal(jobs.includes("stays on the verify screen"), false);
    assert.equal(jobs.includes("password_reset_email"), true);
    assert.equal(claimLib.includes("hash(email + draft.id)"), false);
  });
});
