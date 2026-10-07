import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  classifyDeviceClass,
  classifyReferrerClass,
  isLikelyBot,
  privacyMetaFromHints,
  summarizeAdminShortLinkRollup,
  summarizeShortLinkAnalytics,
} from "./short-link-analytics";

describe("short-link analytics privacy (W5 / INFLR.me §10)", () => {
  it("classifies coarse device and referrer without needing precise location", () => {
    assert.equal(classifyDeviceClass("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)"), "mobile");
    assert.equal(classifyDeviceClass("Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X)"), "tablet");
    assert.equal(classifyDeviceClass("Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120"), "desktop");
    assert.equal(classifyReferrerClass(""), "direct");
    assert.equal(classifyReferrerClass("https://www.instagram.com/reel/xyz"), "social_meta");
    assert.equal(classifyReferrerClass("https://www.google.com/search?q=influrios"), "search");
    assert.equal(classifyReferrerClass("https://inflr.me/sofia"), "influrios");
  });

  it("flags bots so they are excluded from creator analytics", () => {
    assert.equal(isLikelyBot("Googlebot/2.1"), true);
    assert.equal(isLikelyBot("facebookexternalhit/1.1"), true);
    assert.equal(isLikelyBot("Mozilla/5.0 (iPhone)"), false);
    assert.equal(privacyMetaFromHints({ userAgent: "curl/8.0" }).bot, true);
    assert.equal(privacyMetaFromHints({ userAgent: "Mozilla/5.0" }).public.deviceClass, "desktop");
  });

  it("gates analytics fields by entitlement level", () => {
    const events = [
      { eventType: "resolve", metaJson: { deviceClass: "mobile", referrerClass: "direct" } },
      { eventType: "qr_scan", metaJson: { deviceClass: "desktop", referrerClass: "social_meta" } },
      { eventType: "cta_click", metaJson: {} },
      { eventType: "inquiry_conversion", metaJson: {} },
      { eventType: "resolve", metaJson: { bot: true } },
    ];
    const views = summarizeShortLinkAnalytics(events, "views");
    assert.equal(views.totalVisits, 2);
    assert.equal(views.qrScans, undefined);
    assert.equal(views.ctaClicks, undefined);

    const standard = summarizeShortLinkAnalytics(events, "standard");
    assert.equal(standard.qrScans, 1);
    assert.equal(standard.directVisits, 1);
    assert.equal(standard.ctaClicks, undefined);

    const advanced = summarizeShortLinkAnalytics(events, "advanced");
    assert.equal(advanced.ctaClicks, 1);
    assert.equal(advanced.inquiryConversions, 1);
    assert.equal(advanced.deviceClasses?.mobile, 1);
    assert.equal(advanced.referrerClasses?.social_meta, 1);
  });

  it("rolls up admin traffic without exposing creator-identifying geo", () => {
    const rollup = summarizeAdminShortLinkRollup(
      [
        { eventType: "resolve", metaJson: {} },
        { eventType: "qr_scan", metaJson: {} },
        { eventType: "cta_click", metaJson: {} },
        { eventType: "destination_change", metaJson: {} },
        { eventType: "resolve", metaJson: { bot: true } },
      ],
      2,
    );
    assert.equal(rollup.visits, 2);
    assert.equal(rollup.qrScans, 1);
    const withPhase4 = summarizeAdminShortLinkRollup(
      [
        { eventType: "nfc_tap", metaJson: {} },
        { eventType: "campaign_redirect", metaJson: {} },
        { eventType: "qr_scan", metaJson: {} },
      ],
      0,
    );
    assert.equal(withPhase4.visits, 3);
    assert.equal(withPhase4.qrScans, 1);
    assert.equal(rollup.ctaClicks, 1);
    assert.equal(rollup.destinationChanges, 1);
    assert.equal(rollup.abuseOpen, 2);
    assert.equal("geo" in rollup, false);
  });
});
