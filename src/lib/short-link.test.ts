import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  isReservedSlug,
  normalizeSlug,
  redirectCacheFor,
  safeRedirectTarget,
} from "./short-link";

describe("short link rules", () => {
  it("rejects reserved and malformed slugs", () => {
    assert.equal(normalizeSlug("Sofia"), "sofia");
    assert.equal(normalizeSlug("a"), null);
    assert.equal(normalizeSlug("admin"), "admin");
    assert.equal(isReservedSlug("admin"), true);
    assert.equal(isReservedSlug("privacy"), true);
    assert.equal(isReservedSlug("sofia"), false);
  });

  it("caches alias redirects and refuses to cache destinations", () => {
    assert.equal(redirectCacheFor("alias").status, 301);
    assert.match(redirectCacheFor("alias").cacheControl, /max-age/);
    assert.equal(redirectCacheFor("destination").status, 302);
    assert.equal(redirectCacheFor("destination").cacheControl, "no-store");
  });

  it("blocks open redirects and allows profile paths plus allow-listed https hosts", () => {
    const hosts = ["influrios.com", "www.influrios.com"];
    assert.equal(
      safeRedirectTarget("/c/sofia-martinez", hosts, "https://influrios.com"),
      "https://influrios.com/c/sofia-martinez",
    );
    assert.equal(safeRedirectTarget("//evil.com", hosts, "https://influrios.com"), null);
    assert.equal(safeRedirectTarget("https://evil.com/phish", hosts, "https://influrios.com"), null);
    assert.equal(safeRedirectTarget("http://influrios.com/c/sofia", hosts, "https://influrios.com"), null);
    assert.equal(
      safeRedirectTarget("https://influrios.com/c/sofia-martinez", hosts, "https://influrios.com"),
      "https://influrios.com/c/sofia-martinez",
    );
  });
});
