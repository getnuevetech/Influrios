import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  absoluteAssetUrl,
  creatorCanonicalUrl,
  creatorOgDescription,
  creatorShareMetadata,
  creatorSlugFromDestination,
  isSocialPreviewBot,
  socialPreviewInterstitialHtml,
  specialtySummary,
} from "./creator-og";

describe("creator OG / social sharing (W5 / INFLR.me §11)", () => {
  it("builds absolute image URLs and Influrios canonical profile URLs", () => {
    assert.equal(absoluteAssetUrl("/brand/avatars/generic.png", "https://influrios.com"), "https://influrios.com/brand/avatars/generic.png");
    assert.equal(
      absoluteAssetUrl("https://cdn.example.com/a.jpg", "https://influrios.com"),
      "https://cdn.example.com/a.jpg",
    );
    assert.equal(creatorCanonicalUrl("sofia-martinez", "https://influrios.com"), "https://influrios.com/creators/sofia-martinez");
  });

  it("summarizes specialties and prefers bio for description", () => {
    assert.match(specialtySummary(["beauty", "travel"]), /Beauty|Travel|beauty|travel/i);
    assert.equal(
      creatorOgDescription({ slug: "sofia", displayName: "Sofia", bio: "Beauty creator in Miami." }),
      "Beauty creator in Miami.",
    );
    assert.match(
      creatorOgDescription({ slug: "sofia", displayName: "Sofia", title: "Beauty Influencer", specialties: ["beauty"] }),
      /Sofia on Influrios/,
    );
  });

  it("emits openGraph + twitter with canonical on Influrios", () => {
    const meta = creatorShareMetadata(
      {
        slug: "sofia-martinez",
        displayName: "Sofia Martinez",
        title: "Beauty Influencer",
        image: "/demo/creators/creator-sofia.jpg",
        specialties: ["beauty"],
      },
      { surface: "card" },
    );
    assert.equal(meta.alternates?.canonical, "https://influrios.com/creators/sofia-martinez");
    assert.equal(meta.openGraph?.siteName, "Influrios");
    const images = meta.openGraph?.images;
    const first = Array.isArray(images) ? images[0] : images;
    const imageUrl = first && typeof first === "object" && "url" in first ? String(first.url) : "";
    assert.match(imageUrl, /creator-sofia/);
    assert.equal((meta.twitter as { card?: string } | null | undefined)?.card, "summary_large_image");
  });

  it("detects social preview bots and builds interstitial with canonical back to Influrios", () => {
    assert.equal(isSocialPreviewBot("facebookexternalhit/1.1"), true);
    assert.equal(isSocialPreviewBot("Twitterbot/1.0"), true);
    assert.equal(isSocialPreviewBot("Mozilla/5.0 (iPhone)"), false);
    const html = socialPreviewInterstitialHtml({
      creator: {
        slug: "sofia-martinez",
        displayName: "Sofia Martinez",
        specialties: ["beauty"],
        image: "/demo/creators/creator-sofia.jpg",
      },
      destinationUrl: "https://influrios.com/c/sofia-martinez",
    });
    assert.match(html, /rel="canonical" href="https:\/\/influrios\.com\/creators\/sofia-martinez"/);
    assert.match(html, /og:site_name" content="Influrios"/);
    assert.match(html, /Sofia Martinez/);
    assert.doesNotMatch(html, /inflr\.me\/sofia/);
  });

  it("extracts creator slugs only from Influrios card/profile destinations", () => {
    assert.equal(creatorSlugFromDestination("/c/sofia-martinez"), "sofia-martinez");
    assert.equal(creatorSlugFromDestination("https://influrios.com/creators/sofia-martinez"), "sofia-martinez");
    assert.equal(creatorSlugFromDestination("https://evil.com/c/sofia-martinez"), null);
  });
});
