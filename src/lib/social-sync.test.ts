import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildAuthorizeUrl,
  isLiveSocialAccount,
  parseSocialMetrics,
  socialConnectGate,
  socialHostAllowed,
} from "./social-sync";

describe("social consent gate", () => {
  it("requires the current terms before a network can connect", () => {
    const refused = socialConnectGate({
      accepted: false,
      acceptedVersion: null,
      currentVersion: "2026-09-30",
      providerReady: true,
    });
    assert.equal(refused.ok, false);
    if (!refused.ok) assert.match(refused.error, /terms and policy/);
  });

  it("requires a new agreement when the policy version changes", () => {
    const refused = socialConnectGate({
      accepted: true,
      acceptedVersion: "2026-01-01",
      currentVersion: "2026-09-30",
      providerReady: true,
    });
    assert.equal(refused.ok, false);
  });

  it("stops before OAuth when the admin provider is not ready", () => {
    const refused = socialConnectGate({
      accepted: true,
      acceptedVersion: "2026-09-30",
      currentVersion: "2026-09-30",
      providerReady: false,
    });
    assert.equal(refused.ok, false);
    if (!refused.ok) assert.match(refused.error, /not connected yet/);
  });

  it("allows a ready network after the current terms are accepted", () => {
    assert.deepEqual(
      socialConnectGate({
        accepted: true,
        acceptedVersion: "2026-09-30",
        currentVersion: "2026-09-30",
        providerReady: true,
      }),
      { ok: true },
    );
  });
});

describe("live social metrics", () => {
  it("reads followers and likes from a provider payload", () => {
    assert.deepEqual(parseSocialMetrics({ data: { follower_count: 1200, likes_count: "45" } }), {
      followers: 1200,
      likes: 45,
    });
  });

  it("does not treat a payload as live when likes are missing", () => {
    assert.equal(parseSocialMetrics({ followers: 10 }), null);
  });

  it("counts an account as live only after a confirmed sync of both numbers", () => {
    assert.equal(
      isLiveSocialAccount({ source: "PROVIDER_SYNCED", refreshedAt: new Date(), followers: 10, likes: 2 }),
      true,
    );
    assert.equal(
      isLiveSocialAccount({ source: "CREATOR_CLAIMED", refreshedAt: new Date(), followers: 10, likes: 2 }),
      false,
    );
    assert.equal(
      isLiveSocialAccount({ source: "PROVIDER_SYNCED", refreshedAt: null, followers: 10, likes: 2 }),
      false,
    );
  });
});

describe("social provider hosts", () => {
  it("keeps authorize URLs on the official host", () => {
    assert.equal(socialHostAllowed("https://www.tiktok.com/v2/auth/authorize/", ["www.tiktok.com"]), true);
    assert.equal(socialHostAllowed("http://www.tiktok.com/v2/auth/authorize/", ["www.tiktok.com"]), false);
    assert.equal(socialHostAllowed("https://evil.example/authorize", ["www.tiktok.com"]), false);
    const url = buildAuthorizeUrl({
      authorizeUrl: "https://www.tiktok.com/v2/auth/authorize/",
      authorizeHosts: ["www.tiktok.com"],
      clientIdParam: "client_key",
      clientId: "client",
      redirectUri: "https://influrios.com/api/social/callback",
      state: "state",
      scopes: "user.info.stats",
    });
    assert.ok(url?.includes("client_key=client"));
    assert.equal(
      buildAuthorizeUrl({
        authorizeUrl: "https://evil.example/authorize",
        authorizeHosts: ["www.tiktok.com"],
        clientIdParam: "client_key",
        clientId: "client",
        redirectUri: "https://influrios.com/api/social/callback",
        state: "state",
        scopes: "user.info.stats",
      }),
      null,
    );
  });
});
