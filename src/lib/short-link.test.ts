import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isShortLinkHost, normalizeShortHost } from "./short-link-hosts";
import {
  hitWhenShortStoreUnavailable,
  isReservedSlug,
  normalizeSlug,
  redirectCacheFor,
  safeRedirectTarget,
  shortLinkRootMessage,
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

  it("normalizes forwarded short hosts", () => {
    assert.equal(normalizeShortHost("INFLR.ME:443"), "inflr.me");
    assert.equal(normalizeShortHost("inflr.me, inflr.me"), "inflr.me");
    assert.equal(normalizeShortHost("www.inflr.me."), "www.inflr.me");
    assert.equal(isShortLinkHost("inflr.me, inflr.me"), true);
    assert.equal(isShortLinkHost("influrios.com"), false);
  });

  it("explains a known short host when the store is down and does not invent a slug", () => {
    const root = hitWhenShortStoreUnavailable("inflr.me", "/");
    assert.equal(root.kind, "page");
    if (root.kind === "page") {
      assert.equal(root.status, 200);
      assert.equal(root.title, "Influrios short links");
      assert.equal(root.message, shortLinkRootMessage());
      assert.match(root.message, /Creator profiles stay on Influrios/);
    }
    const slug = hitWhenShortStoreUnavailable("INFLR.ME:443", "/sofia");
    assert.equal(slug.kind, "page");
    if (slug.kind === "page") {
      assert.equal(slug.status, 503);
      assert.equal(slug.message, "This short link could not be resolved right now.");
      assert.equal("location" in slug, false);
    }
  });
});
