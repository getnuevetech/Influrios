import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  assembleSiteCms,
  BANNER_SECTION_KEYS,
  DEFAULT_CMS,
  DEFAULT_FEATURES,
  cmsPayloadWithoutDemoMedia,
  mergeBannerConfig,
  mergeFeaturedCards,
  mergeHomepageCategories,
  mergeValueProposition,
  partnerNamesFromText,
  publicBannerImages,
} from "./cms";

describe("cms payload merge", () => {
  it("falls back empty banner title fields to defaults", () => {
    const merged = mergeBannerConfig("hero", {
      title: "  ",
      subtitle: "",
      ctaLabel: "",
      ctaHref: "",
      images: ["/uploads/banners/custom.jpg"],
    });
    assert.equal(merged.title, DEFAULT_CMS.banners.hero.title);
    assert.equal(merged.ctaHref, DEFAULT_CMS.banners.hero.ctaHref);
    assert.deepEqual(merged.images, ["/uploads/banners/custom.jpg"]);
    assert.equal(merged.id, "hero");
  });

  it("maps cardPromo slot to the card_promo section key", () => {
    assert.equal(BANNER_SECTION_KEYS.cardPromo, "card_promo");
    assert.equal(BANNER_SECTION_KEYS.hero, "hero");
  });

  it("keeps featured cards and value-prop items when provided", () => {
    const featured = mergeFeaturedCards({
      widthScale: 1.5,
      cards: [{ slug: "ada", visible: true, order: 0, features: { ...DEFAULT_FEATURES } }],
    });
    assert.equal(featured.widthScale, 1.5);
    assert.equal(featured.cards.length, 1);
    assert.equal(featured.cards[0]!.slug, "ada");

    const emptyFeatured = mergeFeaturedCards({ widthScale: 2, cards: [] });
    assert.equal(emptyFeatured.cards.length, 0);

    const strip = mergeValueProposition({
      headline: "Custom",
      items: [
        {
          key: "x",
          enabled: true,
          sortOrder: 0,
          iconKey: "card",
          title: "X",
          description: "Y",
          microLabel: "Z",
          linkUrl: "/",
          accentToken: "violet",
        },
      ],
    });
    assert.equal(strip.headline, "Custom");
    assert.equal(strip.items.length, 1);
  });

  it("assembles a full SiteCms from partial banner payloads", () => {
    const cms = assembleSiteCms({
      banners: {
        hero: { title: "Hello", images: ["/demo/a.jpg"] },
        cardPromo: { enabled: false },
      },
      featuredCards: { widthScale: 1.1 },
      valueProposition: { eyebrow: "Why us" },
      categories: { title: "Niches", items: [{ slug: "beauty", image: "/demo/categories/cat-beauty.jpg" }] },
      collaborationMatches: {
        title: "Pairs",
        matches: [
          {
            title: "A + B",
            leftSlug: "sofia-martinez",
            rightSlug: "daniel-kim",
            tags: ["Home"],
          },
        ],
      },
    });
    assert.equal(cms.banners.hero.title, "Hello");
    assert.equal(cms.banners.hero.ctaLabel, DEFAULT_CMS.banners.hero.ctaLabel);
    assert.equal(cms.banners.cardPromo.enabled, false);
    assert.equal(cms.banners.sponsored.enabled, true);
    assert.deepEqual(cms.banners.sponsored.partners, []);
    assert.equal(cms.featuredCards.widthScale, 1.1);
    assert.equal(cms.valueProposition.eyebrow, "Why us");
    assert.ok(cms.valueProposition.items.length >= 4);
    assert.equal(cms.categories.title, "Niches");
    assert.equal(cms.categories.items[0]?.slug, "beauty");
    assert.equal(cms.collaborationMatches.title, "Pairs");
    assert.equal(cms.collaborationMatches.matches.length, 1);
  });

  it("saves sponsor names only from the banner text and drops sample creator photos", () => {
    assert.deepEqual(DEFAULT_CMS.banners.sponsored.partners, []);
    assert.deepEqual(DEFAULT_CMS.banners.sponsored.images, []);
    assert.deepEqual(partnerNamesFromText("Acme\nAcme\n  Northwind  \n\n"), ["Acme", "Northwind"]);
    const merged = mergeBannerConfig("sponsored", {
      partners: ["Acme", "acme", "Northwind"],
      images: ["/demo/creators/creator-sofia.jpg", "/uploads/banners/campaign.jpg"],
    });
    assert.deepEqual(merged.partners, ["Acme", "Northwind"]);
    assert.deepEqual(publicBannerImages(merged.images), ["/uploads/banners/campaign.jpg"]);
  });

  it("keeps an uploaded image and drops retired demo art", () => {
    assert.deepEqual(DEFAULT_CMS.banners.cta.images, []);
    assert.ok(DEFAULT_CMS.categories.items.every((item) => item.image === ""));
    assert.deepEqual(
      publicBannerImages(["/demo/cta-community.jpg", "/demo/categories/cat-beauty.jpg", "/uploads/banners/close.jpg"]),
      ["/uploads/banners/close.jpg"],
    );
    const categories = mergeHomepageCategories({
      items: [{ slug: "beauty", image: "/demo/categories/cat-beauty.jpg" }],
    });
    assert.equal(categories.items[0]?.image, "");
    const stripped = cmsPayloadWithoutDemoMedia({
      images: ["/demo/cta-community.jpg", "/uploads/banners/close.jpg"],
      items: [{ slug: "beauty", image: "/demo/categories/cat-beauty.jpg" }],
    });
    assert.equal(stripped.changed, true);
    assert.deepEqual(stripped.payload.images, ["/uploads/banners/close.jpg"]);
    assert.deepEqual(stripped.payload.items, [{ slug: "beauty", image: "" }]);
  });
});
