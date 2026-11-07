import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  META_GRAPH_VERSION,
  buildAuthorizeUrl,
  interpretSocialProfile,
  isLiveSocialAccount,
  parseFacebookPageMetrics,
  parseInstagramBusinessMetrics,
  parseInstagramLoginProfile,
  parseSocialMetrics,
  parseYoutubeChannelMetrics,
  prepareSocialProfileUrl,
  resolveSocialScopes,
  socialConnectGate,
  socialHostAllowed,
  socialMetricLabels,
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
  it("reads followers and optional secondary counts from a provider payload", () => {
    assert.deepEqual(parseSocialMetrics({ data: { follower_count: 1200, likes_count: "45" } }), {
      followers: 1200,
      likes: 45,
    });
    assert.deepEqual(parseSocialMetrics({ followers: 10 }), { followers: 10, likes: null });
  });

  it("maps YouTube channel identity separately from subscriber/view metrics", () => {
    const parsed = parseYoutubeChannelMetrics({
      items: [
        {
          id: "UCabc",
          snippet: { title: "Ada", customUrl: "@ada" },
          statistics: { subscriberCount: "1200", viewCount: "55000", videoCount: "10" },
        },
      ],
    });
    assert.deepEqual(parsed, {
      identity: { handle: "ada", externalId: "UCabc" },
      metrics: { primary: 1200, secondary: 55000 },
      emptyChannel: false,
    });
    assert.equal(parseYoutubeChannelMetrics({ items: [] })?.emptyChannel, true);
    assert.equal(socialMetricLabels("YOUTUBE").secondary, "views");
  });

  it("adds YouTube channels.list query params when the stored URL is bare", () => {
    const prepared = prepareSocialProfileUrl("https://www.googleapis.com/youtube/v3/channels", "YOUTUBE");
    assert.match(prepared, /part=snippet%2Cstatistics|part=snippet,statistics/);
    assert.match(prepared, /mine=true/);
  });

  it("maps Facebook Page identity even when audience counts are missing", () => {
    const withCounts = parseFacebookPageMetrics({
      data: [
        { id: "111", name: "Ada Page", username: "adapage", followers_count: 900, fan_count: 880 },
      ],
    });
    assert.deepEqual(withCounts, {
      identity: { handle: "adapage", externalId: "111" },
      metrics: { primary: 900, secondary: 880 },
      emptyPages: false,
    });
    assert.equal(parseFacebookPageMetrics({ data: [] })?.emptyPages, true);
    const identityOnly = parseFacebookPageMetrics({
      data: [{ id: "1", name: "No counts" }],
    });
    assert.equal(identityOnly?.identity?.externalId, "1");
    assert.equal(identityOnly?.metrics, null);
  });

  it("maps Instagram Login /me Professional profiles", () => {
    const parsed = parseInstagramLoginProfile({
      user_id: "1784",
      username: "ada.creates",
      followers_count: 4200,
      media_count: 88,
    });
    assert.deepEqual(parsed, {
      identity: { handle: "ada.creates", externalId: "1784" },
      metrics: { primary: 4200, secondary: 88 },
    });
    const legacy = parseInstagramBusinessMetrics({
      data: [
        {
          id: "page1",
          name: "Brand",
          instagram_business_account: {
            id: "1784",
            username: "ada.creates",
            followers_count: 4200,
            media_count: 88,
          },
        },
      ],
    });
    assert.equal(legacy?.identity?.handle, "ada.creates");
  });

  it("locks Facebook/Instagram endpoints and scopes in code", () => {
    const facebook = prepareSocialProfileUrl("https://graph.facebook.com/v21.0/me", "FACEBOOK");
    assert.match(facebook, /\/me\/accounts/);
    assert.match(facebook, /followers_count/);
    const instagram = prepareSocialProfileUrl("https://graph.facebook.com/v21.0/me", "INSTAGRAM");
    assert.match(instagram, /graph\.instagram\.com/);
    assert.match(instagram, /instagram_business_basic|user_id,username/);
    assert.equal(resolveSocialScopes("FACEBOOK", "public_profile"), "public_profile,pages_show_list,pages_read_engagement");
    assert.equal(resolveSocialScopes("INSTAGRAM", "instagram_basic,pages_show_list"), "instagram_business_basic");
    assert.match(META_GRAPH_VERSION, /^v\d+\.\d+$/);
  });

  it("uses Meta config_id instead of scope for Facebook Login for Business", () => {
    const withConfig = buildAuthorizeUrl({
      authorizeUrl: "https://www.facebook.com/v22.0/dialog/oauth",
      authorizeHosts: ["www.facebook.com"],
      clientIdParam: "client_id",
      clientId: "app",
      redirectUri: "https://influrios.com/api/social/callback",
      state: "state",
      scopes: "pages_show_list,pages_read_engagement",
      configId: "1234567890",
    });
    assert.ok(withConfig?.includes("config_id=1234567890"));
    assert.equal(withConfig?.includes("scope="), false);

    const classic = buildAuthorizeUrl({
      authorizeUrl: "https://www.facebook.com/v22.0/dialog/oauth",
      authorizeHosts: ["www.facebook.com"],
      clientIdParam: "client_id",
      clientId: "app",
      redirectUri: "https://influrios.com/api/social/callback",
      state: "state",
      scopes: "public_profile,pages_show_list,pages_read_engagement",
    });
    assert.ok(classic?.includes("scope="));
    assert.equal(classic?.includes("config_id="), false);
  });

  it("keeps OAuth success notices separate from hard metric failure", () => {
    const youtubeEmpty = interpretSocialProfile("YOUTUBE", { items: [] });
    assert.equal(youtubeEmpty.identity, null);
    assert.equal(youtubeEmpty.metrics, null);
    assert.match(youtubeEmpty.metricsNotice ?? "", /couldn't find a YouTube channel/i);
    assert.equal(/Phase M/i.test(youtubeEmpty.metricsNotice ?? ""), false);

    const facebookEmpty = interpretSocialProfile("FACEBOOK", { data: [] });
    assert.match(facebookEmpty.metricsNotice ?? "", /no eligible Facebook Page/i);
    assert.equal(/Phase M/i.test(facebookEmpty.metricsNotice ?? ""), false);
  });

  it("counts an account as live after a confirmed primary audience sync", () => {
    assert.equal(
      isLiveSocialAccount({ source: "PROVIDER_SYNCED", refreshedAt: new Date(), followers: 10, likes: 2 }),
      true,
    );
    assert.equal(
      isLiveSocialAccount({ source: "PROVIDER_SYNCED", refreshedAt: new Date(), followers: 10, likes: null }),
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
