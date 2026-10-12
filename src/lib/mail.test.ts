import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  mailConfigFromEnv,
  resolveMailConfig,
  resolveMailConfigFromRow,
  type MailSettingsRow,
} from "./mail";

function row(partial: Partial<MailSettingsRow> = {}): MailSettingsRow {
  return {
    host: "smtp.example.com",
    port: 587,
    username: "mailer",
    fromAddress: "hello@influrios.com",
    secretCipher: "cipher",
    enabled: true,
    ...partial,
  };
}

describe("resolveMailConfigFromRow", () => {
  it("requires Enabled before the admin row can send", () => {
    const result = resolveMailConfigFromRow(row({ enabled: false }), () => "secret");
    assert.equal(result.ok, false);
    if (!result.ok) assert.match(result.error, /Enabled is off/);
  });

  it("requires host and from while enabled", () => {
    const result = resolveMailConfigFromRow(row({ host: "", fromAddress: "" }), () => "secret");
    assert.equal(result.ok, false);
    if (!result.ok) assert.match(result.error, /Host and from address/);
  });

  it("requires a password when a username is set", () => {
    const result = resolveMailConfigFromRow(row({ secretCipher: null }), () => "secret");
    assert.equal(result.ok, false);
    if (!result.ok) assert.match(result.error, /no password is saved/);
  });

  it("asks the operator to re-enter a password that will not decrypt", () => {
    const result = resolveMailConfigFromRow(row(), () => null);
    assert.equal(result.ok, false);
    if (!result.ok) assert.match(result.error, /cannot be decrypted/);
  });

  it("allows password-less SMTP when username is blank", () => {
    const result = resolveMailConfigFromRow(
      row({ username: "", secretCipher: null }),
      () => null,
    );
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.source, "admin");
      assert.equal(result.config.password, "");
      assert.equal(result.config.host, "smtp.example.com");
    }
  });

  it("returns the admin config when the row is complete", () => {
    const result = resolveMailConfigFromRow(row(), () => "s3cret");
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.config.password, "s3cret");
      assert.equal(result.config.username, "mailer");
    }
  });
});

describe("resolveMailConfig", () => {
  it("falls back to the environment when the admin row cannot send", () => {
    const env = mailConfigFromEnv({
      SMTP_HOST: "smtp.env.example",
      SMTP_FROM: "ops@influrios.com",
      SMTP_USER: "env-user",
      SMTP_PASSWORD: "env-pass",
    });
    const result = resolveMailConfig(row({ enabled: false }), env, () => "secret");
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.source, "env");
      assert.equal(result.config.host, "smtp.env.example");
    }
  });

  it("keeps the admin reason when neither path is ready", () => {
    const result = resolveMailConfig(row({ enabled: false }), null, () => "secret");
    assert.equal(result.ok, false);
    if (!result.ok) assert.match(result.error, /Enabled is off/);
  });
});
