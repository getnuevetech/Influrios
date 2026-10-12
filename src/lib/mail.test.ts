import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  formatSmtpDeliveryError,
  mailConfigFromEnv,
  mailSettingsAppearance,
  resolveMailConfig,
  resolveMailConfigFromRow,
  type MailSettingsRow,
} from "./mail";
import { encryptSecret, resetProviderSecretKeyCacheForTests } from "./provider-secrets";

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

describe("formatSmtpDeliveryError", () => {
  it("explains DNS and timeout failures", () => {
    assert.match(
      formatSmtpDeliveryError(new Error("getaddrinfo ENOTFOUND smtp.bad"), "smtp.bad", 587),
      /could not be found/,
    );
    assert.match(
      formatSmtpDeliveryError(new Error("SMTP connection to smtp.bad:587 timed out."), "smtp.bad", 587),
      /timed out/,
    );
    assert.match(
      formatSmtpDeliveryError(new Error("connect ECONNREFUSED 127.0.0.1:587"), "127.0.0.1", 587),
      /refused/,
    );
  });
});

describe("mailSettingsAppearance", () => {
  it("marks an enabled row ready without decrypting the password", () => {
    const result = mailSettingsAppearance(
      row({ enabled: true, secretCipher: "v1.not-decrypted" }),
      false,
    );
    assert.equal(result.ready, true);
    assert.equal(result.readySource, "admin");
  });

  it("keeps Enabled-off rows not ready when env SMTP is absent", () => {
    const result = mailSettingsAppearance(row({ enabled: false }), false);
    assert.equal(result.ready, false);
    assert.match(result.readyError, /Enabled is off/);
  });
});

describe("provider secret key cache", () => {
  it("keeps later encrypts cheap after the first scrypt derivation", () => {
    resetProviderSecretKeyCacheForTests();
    const warm = Date.now();
    encryptSecret("warm-up");
    const firstMs = Date.now() - warm;
    const start = Date.now();
    for (let i = 0; i < 20; i += 1) encryptSecret(`payload-${i}`);
    const cachedMs = Date.now() - start;
    assert.ok(cachedMs < 80, `expected cached encrypts under 80ms, got ${cachedMs}ms after first ${firstMs}ms`);
  });
});
