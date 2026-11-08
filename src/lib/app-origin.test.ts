import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { getAppOrigin, isPublicHttpsOrigin, oauthAppOrigin, resolveAppOrigin } from "./billing";

describe("getAppOrigin / resolveAppOrigin", () => {
  it("prefers NEXT_PUBLIC_APP_URL and never returns Docker 0.0.0.0", () => {
    const prevPublic = process.env.NEXT_PUBLIC_APP_URL;
    const prevApp = process.env.APP_URL;
    try {
      process.env.NEXT_PUBLIC_APP_URL = "https://influrios.com";
      process.env.APP_URL = "https://0.0.0.0:3000";
      assert.equal(getAppOrigin(), "https://influrios.com");
      assert.equal(
        resolveAppOrigin({ proto: "https", host: "0.0.0.0:3000", fallback: "https://0.0.0.0:3000" }),
        "https://influrios.com",
      );
    } finally {
      if (prevPublic === undefined) delete process.env.NEXT_PUBLIC_APP_URL;
      else process.env.NEXT_PUBLIC_APP_URL = prevPublic;
      if (prevApp === undefined) delete process.env.APP_URL;
      else process.env.APP_URL = prevApp;
    }
  });

  it("rejects a 0.0.0.0 env value and falls back to usable request host", () => {
    const prevPublic = process.env.NEXT_PUBLIC_APP_URL;
    const prevApp = process.env.APP_URL;
    try {
      process.env.NEXT_PUBLIC_APP_URL = "https://0.0.0.0:3000";
      process.env.APP_URL = "";
      assert.equal(
        resolveAppOrigin({ proto: "https", host: "influrios.com", fallback: "https://0.0.0.0:3000" }),
        "https://influrios.com",
      );
    } finally {
      if (prevPublic === undefined) delete process.env.NEXT_PUBLIC_APP_URL;
      else process.env.NEXT_PUBLIC_APP_URL = prevPublic;
      if (prevApp === undefined) delete process.env.APP_URL;
      else process.env.APP_URL = prevApp;
    }
  });
});

describe("oauthAppOrigin", () => {
  it("keeps a public https env and ignores a localhost env in favor of the browser host", () => {
    const prevPublic = process.env.NEXT_PUBLIC_APP_URL;
    const prevApp = process.env.APP_URL;
    try {
      process.env.NEXT_PUBLIC_APP_URL = "https://influrios.com";
      process.env.APP_URL = "http://localhost:3000";
      assert.equal(oauthAppOrigin({ proto: "https", host: "evil.example" }), "https://influrios.com");
      assert.equal(isPublicHttpsOrigin("https://influrios.com"), true);
      assert.equal(isPublicHttpsOrigin("http://localhost:3000"), false);
      process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3000";
      process.env.APP_URL = "";
      assert.equal(oauthAppOrigin({ proto: "https", host: "influrios.com" }), "https://influrios.com");
      assert.equal(oauthAppOrigin({ proto: "https", host: "www.influrios.com" }), "https://influrios.com");
      process.env.NEXT_PUBLIC_APP_URL = "https://staging.example.com";
      assert.equal(oauthAppOrigin({ proto: "https", host: "www.influrios.com" }), "https://influrios.com");
    } finally {
      if (prevPublic === undefined) delete process.env.NEXT_PUBLIC_APP_URL;
      else process.env.NEXT_PUBLIC_APP_URL = prevPublic;
      if (prevApp === undefined) delete process.env.APP_URL;
      else process.env.APP_URL = prevApp;
    }
  });
});

describe("social callback origin wiring", () => {
  it("uses oauthAppOrigin instead of request.nextUrl.origin alone", () => {
    const source = readFileSync("src/app/api/social/callback/route.ts", "utf8");
    assert.match(source, /oauthAppOrigin/);
    assert.equal(source.includes('new URL("/dashboard", request.nextUrl.origin)'), false);
    const actions = readFileSync("src/app/dashboard/social-actions.ts", "utf8");
    assert.match(actions, /oauthAppOrigin/);
    assert.match(actions, /\/api\/social\/launch\?state=/);
    assert.equal(actions.includes("redirect(result.authorizeUrl)"), false);
  });

  it("authorizes with the caller origin so TikTok gets the public callback", () => {
    const connect = readFileSync("src/lib/social-connect.ts", "utf8");
    assert.match(connect, /function callbackFor/);
    assert.match(connect, /function tiktokCallbackUrl/);
    assert.match(connect, /socialCallbackUrl\(origin\)/);
    assert.match(readFileSync("next.config.ts", "utf8"), /source: "\/api\/social\/callback\/"/);
    assert.match(connect, /tiktokQuery: network\.code === "tiktok"/);
    assert.match(connect, /callbackAbsoluteUrl/);
    assert.match(readFileSync("src/app/admin/social/page.tsx", "utf8"), /callbackAbsoluteUrl/);
    assert.match(readFileSync("next.config.ts", "utf8"), /bodySizeLimit:\s*"10mb"/);
    const compose = readFileSync("docker-compose.yml", "utf8");
    assert.match(compose, /NEXT_PUBLIC_APP_URL: \$\{NEXT_PUBLIC_APP_URL:-https:\/\/influrios\.com\}/);
    assert.equal(compose.includes("NEXT_PUBLIC_APP_URL:-http://localhost:3000"), false);
  });
});
