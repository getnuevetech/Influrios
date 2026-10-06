import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  BRAND_AVATARS,
  BRAND_BANNERS,
  defaultAvatarForGender,
  defaultBannerForSeed,
  isBrandDefaultAvatar,
  nextBrandBanner,
  normalizeProfileGender,
  resolveDefaultAvatar,
  resolveDefaultBanner,
} from "./profile-media";

describe("profile gender", () => {
  it("normalizes male/female and falls back to unspecified", () => {
    assert.equal(normalizeProfileGender("Male"), "male");
    assert.equal(normalizeProfileGender("WOMAN"), "female");
    assert.equal(normalizeProfileGender(""), "unspecified");
    assert.equal(normalizeProfileGender("prefer-not"), "unspecified");
  });
});

describe("branded defaults", () => {
  it("picks gender-specific avatars and a generic mark when unknown", () => {
    assert.equal(defaultAvatarForGender("male"), BRAND_AVATARS.male);
    assert.equal(defaultAvatarForGender("female"), BRAND_AVATARS.female);
    assert.equal(defaultAvatarForGender("unspecified"), BRAND_AVATARS.unspecified);
  });

  it("assigns banners stably from the seed and cycles on request", () => {
    const a = defaultBannerForSeed("ag-olomola-2");
    const b = defaultBannerForSeed("ag-olomola-2");
    assert.equal(a, b);
    assert.ok((BRAND_BANNERS as readonly string[]).includes(a));
    const next = nextBrandBanner(a, "ag-olomola-2");
    assert.notEqual(next, a);
    assert.ok((BRAND_BANNERS as readonly string[]).includes(next));
  });

  it("keeps a real social avatar and replaces legacy demo headshots", () => {
    assert.equal(
      resolveDefaultAvatar({ socialImage: "https://cdn.example/me.jpg", gender: "female" }),
      "https://cdn.example/me.jpg",
    );
    assert.equal(
      resolveDefaultAvatar({ socialImage: "/demo/creators/creator-sofia.jpg", gender: "female" }),
      BRAND_AVATARS.female,
    );
    assert.equal(
      resolveDefaultBanner({ seed: "x", coverImage: "/demo/sofia/sofia-banner.jpg" }),
      defaultBannerForSeed("x"),
    );
    assert.equal(isBrandDefaultAvatar("/brand/avatars/male.png"), true);
    assert.equal(isBrandDefaultAvatar("/uploads/avatars/custom.png"), false);
  });
});
