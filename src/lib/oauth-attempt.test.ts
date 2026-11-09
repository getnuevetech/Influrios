import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { exactOAuthRedirect } from "./social-sync";
import { oauthAttemptFresh, oauthCallbackError, OAUTH_ATTEMPT_TTL_MS } from "./oauth-attempt";

describe("oauth attempt contract", () => {
  it("keeps a trailing slash when the configured callback has one", () => {
    assert.equal(
      exactOAuthRedirect("https://influrios.com/api/social/callback/"),
      "https://influrios.com/api/social/callback/",
    );
    assert.equal(
      exactOAuthRedirect("https://influrios.com/api/social/callback"),
      "https://influrios.com/api/social/callback",
    );
  });

  it("expires, rejects a replay window, and explains a denied consent", () => {
    const now = 1_700_000_000_000;
    assert.equal(oauthAttemptFresh(now - OAUTH_ATTEMPT_TTL_MS, now), true);
    assert.equal(oauthAttemptFresh(now - OAUTH_ATTEMPT_TTL_MS - 1, now), false);
    assert.equal(oauthAttemptFresh(null, now), false);
    assert.equal(oauthCallbackError("access_denied").code, "denied");
    assert.match(oauthCallbackError("access_denied").message, /declined/);
    assert.equal(oauthCallbackError("server_error").code, "unauthorized");
  });
});
