import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { BRAND_AVATARS, BRAND_BANNERS, defaultAvatarForGender } from "./profile-media";
import { draftToSeedCreator, type ClaimDraft } from "./claim";

function sampleDraft(overrides: Partial<ClaimDraft> = {}): ClaimDraft {
  const now = new Date().toISOString();
  return {
    id: "draft_test",
    slug: "ag-olomola",
    stage: "draft",
    inputHandle: "@agolomola",
    platform: "INSTAGRAM",
    displayName: "Ag Olomola",
    title: "Blogger",
    bio: "bio",
    locationCity: "Your city",
    locationCountry: "Your country",
    specialties: ["lifestyle", "travel"],
    socials: [],
    image: "/brand/avatars/generic.svg",
    coverImage: BRAND_BANNERS[0]!,
    gender: "unspecified",
    attribution: "ORGANIC_SIGNUP",
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

describe("claim draft preview media", () => {
  it("rewrites legacy SVG avatars and prefers lifestyle cover on draft cards", () => {
    const creator = draftToSeedCreator(sampleDraft());
    assert.equal(creator.coverImage, BRAND_BANNERS[0]);
    assert.equal(creator.image, BRAND_BANNERS[0]);
    assert.notEqual(creator.image, "/brand/avatars/generic.svg");
  });

  it("keeps a custom uploaded avatar on draft cards", () => {
    const creator = draftToSeedCreator(
      sampleDraft({ image: "/uploads/avatars/custom.png", coverImage: BRAND_BANNERS[1]! }),
    );
    assert.equal(creator.image, "/uploads/avatars/custom.png");
  });

  it("uses gender avatar after claim remap path", () => {
    assert.equal(defaultAvatarForGender("unspecified"), BRAND_AVATARS.unspecified);
    assert.ok(BRAND_AVATARS.unspecified.endsWith("generic.png"));
  });
});
