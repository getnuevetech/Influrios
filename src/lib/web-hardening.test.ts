import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import robots from "../app/robots";
import sitemap from "../app/sitemap";

const read = (file: string) => readFileSync(file, "utf8");

describe("web hardening from the live audit", () => {
  it("sends browser security headers and hides the framework", () => {
    const config = read("next.config.ts");
    for (const header of ["Strict-Transport-Security", "X-Frame-Options", "X-Content-Type-Options", "Referrer-Policy", "Permissions-Policy", "Content-Security-Policy-Report-Only"]) {
      assert.match(config, new RegExp(header), header);
    }
    assert.match(config, /poweredByHeader: false/);
    assert.match(read("deploy/nginx/influrios.conf"), /server_tokens off;/);
  });

  it("redirects www to the bare domain and marks cookies Secure on HTTPS", () => {
    const middleware = read("src/middleware.ts");
    assert.match(middleware, /www\.influrios\.com/);
    assert.match(middleware, /https:\/\/influrios\.com/);
    assert.equal((middleware.match(/secure: secureCookie/g) ?? []).length, 2);
  });

  it("publishes robots.txt and a sitemap that keep private areas out", () => {
    const rules = robots().rules;
    const list = Array.isArray(rules) ? rules : [rules];
    const disallow = list.flatMap((rule) => (Array.isArray(rule.disallow) ? rule.disallow : [rule.disallow ?? ""]));
    for (const path of ["/admin", "/api", "/claim/", "/payments"]) assert.ok(disallow.includes(path), path);
    assert.ok(sitemap().some((row) => row.url === "https://influrios.com/discover"));
  });

  it("closes the small route leaks", () => {
    const pdf = read("src/app/collaboration/contracts/[id]/pdf/route.ts");
    assert.ok(pdf.indexOf("if (!account && !admin)") < pdf.indexOf("if (!document)"));
    assert.match(read("src/app/api/analytics/value-prop/route.ts"), /status: 429/);
    assert.equal(/return description\.trim\(\)/.test(read("src/app/api/social/callback/route.ts")), false);
  });
});
