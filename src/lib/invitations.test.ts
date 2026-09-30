import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  advanceStatus,
  DEFAULT_INVITATION_TEMPLATE,
  invitationGate,
  newInvitationToken,
  renderInvitationCopy,
  smtpConfigured,
  suppressionValue,
} from "./invitations";

describe("invitation status", () => {
  it("moves queued outreach forward to published", () => {
    assert.equal(advanceStatus("queued", "opened"), "opened");
    assert.equal(advanceStatus("opened", "claimed"), "claimed");
    assert.equal(advanceStatus("claimed", "published"), "published");
    assert.equal(advanceStatus("published", "opened"), "published");
  });

  it("does not reopen a declined or expired invite by claiming", () => {
    assert.equal(advanceStatus("declined", "claimed"), "declined");
    assert.equal(advanceStatus("expired", "published"), "expired");
  });
});

describe("invitation gate", () => {
  const future = new Date(Date.now() + 86400000);
  const past = new Date(Date.now() - 1000);

  it("blocks expired and do-not-contact links", () => {
    assert.equal(invitationGate({ status: "queued", expiresAt: past, suppressed: false }), "expired");
    assert.equal(invitationGate({ status: "queued", expiresAt: future, suppressed: true }), "suppressed");
    assert.equal(invitationGate({ status: "queued", expiresAt: future, suppressed: false }), "ready");
  });

  it("keeps a published invite published", () => {
    assert.equal(invitationGate({ status: "published", expiresAt: past, suppressed: true }), "published");
  });
});

describe("invitation copy", () => {
  it("fills the profile placeholders and leaves unknown ones blank", () => {
    const copy = renderInvitationCopy(DEFAULT_INVITATION_TEMPLATE.body, {
      name: "Sofia Martinez",
      profile: "sofia-martinez",
      link: "https://influrios.test/invite/opaque",
      expiry: "14 Oct",
    });
    assert.match(copy, /Sofia Martinez/);
    assert.match(copy, /sofia-martinez/);
    assert.doesNotMatch(copy, /\{\{/);
  });

  it("mints an opaque token instead of a profile slug", () => {
    const token = newInvitationToken();
    assert.equal(token.includes("sofia"), false);
    assert.equal(token.includes("/"), false);
    assert.ok(token.length >= 24);
  });

  it("normalizes suppression keys", () => {
    assert.equal(suppressionValue("email", " Sofia@Example.com "), "sofia@example.com");
    assert.equal(suppressionValue("slug", "@Sofia-Martinez"), "sofia-martinez");
  });

  it("treats SMTP as inactive until host and from are set", () => {
    assert.equal(smtpConfigured({}), false);
    assert.equal(smtpConfigured({ SMTP_HOST: "smtp.example", SMTP_FROM: "hello@influrios.com" }), true);
  });
});
