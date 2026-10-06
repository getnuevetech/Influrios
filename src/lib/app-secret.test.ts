import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { authSecretConfigured, requireAuthSecret } from "./app-secret";

describe("app secret", () => {
  it("reports whether a signing secret is configured", () => {
    assert.equal(authSecretConfigured({}), false);
    assert.equal(authSecretConfigured({ AUTH_SECRET: "  " }), false);
    assert.equal(authSecretConfigured({ AUTH_SECRET: "live-secret" }), true);
    assert.equal(authSecretConfigured({ ADMIN_SESSION_SECRET: "admin" }), true);
  });

  it("uses the development fallback outside production", () => {
    const secret = requireAuthSecret("account", { NODE_ENV: "test" });
    assert.equal(secret, "influrios-account-demo");
    assert.equal(requireAuthSecret("provider", { NODE_ENV: "development" }), "influrios-dev-admin-secret-change-me");
  });

  it("prefers AUTH_SECRET over the fallback", () => {
    assert.equal(
      requireAuthSecret("admin", { NODE_ENV: "production", AUTH_SECRET: "from-env" }),
      "from-env",
    );
  });

  it("throws in production when no secret is set", () => {
    assert.throws(
      () => requireAuthSecret("admin", { NODE_ENV: "production" }),
      /AUTH_SECRET is required/,
    );
    assert.throws(
      () => requireAuthSecret("account", { NODE_ENV: "production", AUTH_SECRET: "  " }),
      /AUTH_SECRET is required/,
    );
  });
});
