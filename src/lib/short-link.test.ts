import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isShortLinkHost, normalizeShortHost } from "./short-link-hosts";
import {
  hitWhenShortStoreUnavailable,
  isReservedSlug,
  normalizeSlug,
  aliasShouldRedirect,
  canChangeDynamicDestination,
  destinationKindFor,
  domainCanBePrimary,
  domainCanServe,
  priorDestinationFromHistory,
  redirectCacheFor,
  safeRedirectTarget,
  shortLinkRootMessage,
  slugChangeWarning,
  storeDestinationValue,
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

  it("applies configured alias redirect policy (§20.12)", () => {
    assert.equal(aliasShouldRedirect({ redirect: true, shortLink: { status: "active" } }), true);
    assert.equal(aliasShouldRedirect({ redirect: false, shortLink: { status: "active" } }), false);
    assert.equal(aliasShouldRedirect({ redirect: true, shortLink: { status: "suspended" } }), false);
  });

  it("serves and promotes only verified active domains (§20.24)", () => {
    assert.equal(domainCanServe({ verified: true, active: true }), true);
    assert.equal(domainCanServe({ verified: false, active: true }), false);
    assert.equal(domainCanServe({ verified: true, active: false }), false);
    assert.equal(domainCanBePrimary({ verified: true, active: true }), true);
    assert.equal(domainCanBePrimary({ verified: false, active: true }), false);
  });

  it("warns before a slug change that keeps the old name as a redirect", () => {
    assert.match(slugChangeWarning("sofia", "sofia-m"), /sofia/);
    assert.match(slugChangeWarning("sofia", "sofia-m"), /sofia-m/);
    assert.match(slugChangeWarning("sofia", "sofia-m"), /redirect/);
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
      assert.match(root.message, /Influencer profiles stay on Influrios/);
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

describe("Pro dynamic destination (W5 / INFLR.me §9)", () => {
  it("allows only active dynamic links with Pro entitlement when required", () => {
    assert.equal(canChangeDynamicDestination({ dynamic: true, status: "active" }).ok, true);
    assert.equal(canChangeDynamicDestination({ dynamic: false, status: "active" }).ok, false);
    assert.equal(canChangeDynamicDestination({ dynamic: true, status: "suspended" }).ok, false);
    assert.equal(
      canChangeDynamicDestination({
        dynamic: true,
        status: "active",
        requireEntitlement: true,
        entitlementsDynamicQr: false,
      }).ok,
      false,
    );
    assert.equal(
      canChangeDynamicDestination({
        dynamic: true,
        status: "active",
        requireEntitlement: true,
        entitlementsDynamicQr: true,
      }).ok,
      true,
    );
  });

  it("stores relative paths as paths and absolute allow-listed urls as https", () => {
    assert.equal(storeDestinationValue("/c/sofia", "https://influrios.com/c/sofia"), "/c/sofia");
    assert.equal(
      storeDestinationValue("https://influrios.com/c/sofia", "https://influrios.com/c/sofia"),
      "https://influrios.com/c/sofia",
    );
    assert.equal(destinationKindFor("/c/sofia"), "path");
    assert.equal(destinationKindFor("https://influrios.com/c/sofia"), "https");
  });

  it("rolls back to the previous destination from the latest history row", () => {
    const prior = priorDestinationFromHistory([
      { previousDestination: "/c/sofia", previousKind: "profile" },
      { previousDestination: "/c/old", previousKind: "path" },
    ]);
    assert.deepEqual(prior, { destination: "/c/sofia", destinationKind: "profile" });
    assert.equal(priorDestinationFromHistory([]), null);
  });
});
