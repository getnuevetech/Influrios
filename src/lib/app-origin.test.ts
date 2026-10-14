import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { getAppOrigin, resolveAppOrigin } from "./billing";

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

describe("social callback origin wiring", () => {
  it("uses resolveAppOrigin instead of request.nextUrl.origin alone", () => {
    const source = readFileSync("src/app/api/social/callback/route.ts", "utf8");
    assert.match(source, /resolveAppOrigin/);
    assert.equal(source.includes('new URL("/dashboard", request.nextUrl.origin)'), false);
    assert.match(readFileSync("src/app/dashboard/social-actions.ts", "utf8"), /resolveAppOrigin/);
  });

  it("authorizes with socialCallbackUrl from getAppOrigin (not request host)", () => {
    const connect = readFileSync("src/lib/social-connect.ts", "utf8");
    assert.match(connect, /socialCallbackUrl\(\)/);
    assert.match(connect, /callbackAbsoluteUrl/);
    assert.match(readFileSync("src/app/admin/social/page.tsx", "utf8"), /callbackAbsoluteUrl/);
    assert.match(readFileSync("next.config.ts", "utf8"), /bodySizeLimit:\s*"10mb"/);
  });
});
