import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { clampSmsBody, renderCommCopy, SMS_BODY_MAX } from "./comm-templates";
import { DEFAULT_INVITATION_TEMPLATE, renderInvitationCopy } from "./invitations";
import { previewMailVars } from "./mail";

describe("comm templates", () => {
  it("renders {{variables}} in email and SMS copy", () => {
    assert.equal(
      renderCommCopy("Hi {{name}}, open {{link}}", { name: "Ada", link: "https://x.test" }),
      "Hi Ada, open https://x.test",
    );
  });

  it("fills an admin test email with preview labels", () => {
    const vars = previewMailVars("admin@example.com");
    const invitation = renderInvitationCopy(DEFAULT_INVITATION_TEMPLATE.body, vars);
    const welcome = renderCommCopy("Hi {{name}}, code {{code}} for {{profile}} at {{business}}. {{link}}", vars);
    assert.equal(vars.email, "admin@example.com");
    assert.match(invitation, /Preview recipient/);
    assert.match(welcome, /preview code/);
    assert.equal(invitation.includes("Sofia"), false);
    assert.equal(invitation.includes("sofia-martinez"), false);
    assert.equal(invitation.includes("/invite/sample"), false);
    assert.equal(welcome.includes("Harbor"), false);
    assert.equal(welcome.includes("482913"), false);
    const mail = readFileSync(new URL("./mail.ts", import.meta.url), "utf8");
    const templates = readFileSync(new URL("./comm-templates.ts", import.meta.url), "utf8");
    assert.equal(mail.includes("Sofia Martinez"), false);
    assert.equal(mail.includes("sofia-martinez"), false);
    assert.equal(templates.includes("Sofia Martinez"), false);
    assert.equal(templates.includes("Harbor Brand"), false);
  });

  it("clamps SMS bodies to about two segments", () => {
    const long = "x".repeat(SMS_BODY_MAX + 40);
    assert.equal(clampSmsBody(long).length, SMS_BODY_MAX);
  });
});
