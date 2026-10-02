import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { draftFromSession, publicClaimPayload, type ClaimDraft } from "./claim";
import type { OnboardingSession } from "@prisma/client";

function sampleDraft(overrides: Partial<ClaimDraft> = {}): ClaimDraft {
  return {
    id: "draft_abc",
    slug: "ada-maker",
    stage: "claimed",
    inputHandle: "@ada",
    platform: "INSTAGRAM",
    displayName: "Ada Maker",
    title: "Maker",
    bio: "Builds rooms",
    locationCity: "Austin",
    locationCountry: "USA",
    specialties: ["woodworking"],
    socials: [{ platform: "INSTAGRAM", handle: "@ada", url: "https://instagram.com/ada", followers: 12 }],
    image: "/demo/creators/creator-sofia.jpg",
    email: "ada@example.com",
    ownerName: "Ada Maker",
    verifyCode: "123456",
    verificationDelivery: "demo",
    attribution: "ORGANIC_SIGNUP",
    planTier: "STARTER",
    createdAt: "2026-10-01T00:00:00.000Z",
    updatedAt: "2026-10-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("claim public DTO", () => {
  it("never exposes email or verification codes on the public payload", () => {
    const payload = publicClaimPayload(sampleDraft());
    assert.equal("email" in payload, false);
    assert.equal("verifyCode" in payload, false);
    assert.equal("ownerName" in payload, false);
    assert.equal(payload.slug, "ada-maker");
    assert.equal(payload.displayName, "Ada Maker");
  });
});

describe("claim session mapping", () => {
  it("restores a draft from an OnboardingSession row including the private verify code", () => {
    const draft = sampleDraft({ verificationDelivery: "email" });
    const row = {
      id: draft.id,
      state: "CLAIMED",
      inputHandle: draft.inputHandle,
      platform: draft.platform,
      draftSlug: draft.slug,
      email: draft.email,
      ownerName: draft.ownerName,
      emailVerifiedAt: null,
      socialVerifiedAt: null,
      publishedAt: null,
      verifyMethod: "EMAIL",
      payload: {
        displayName: draft.displayName,
        title: draft.title,
        bio: draft.bio,
        locationCity: draft.locationCity,
        locationCountry: draft.locationCountry,
        specialties: draft.specialties,
        socials: draft.socials,
        image: draft.image,
        stage: draft.stage,
        attribution: draft.attribution,
        verifyCode: draft.verifyCode,
        verificationDelivery: "email",
        planTier: draft.planTier,
      },
      userId: null,
      createdAt: new Date(draft.createdAt),
      updatedAt: new Date(draft.updatedAt),
    } as OnboardingSession;

    const restored = draftFromSession(row);
    assert.equal(restored.email, "ada@example.com");
    assert.equal(restored.verifyCode, "123456");
    assert.equal(restored.verificationDelivery, "email");
    assert.equal(restored.stage, "claimed");
    assert.deepEqual(publicClaimPayload(restored).socials[0], {
      platform: "INSTAGRAM",
      handle: "@ada",
      url: "https://instagram.com/ada",
      followers: 12,
    });
  });

  it("maps OnboardingState EMAIL_VERIFIED and PUBLISHED to claim stages", () => {
    const base = sampleDraft();
    const verifiedRow = {
      id: base.id,
      state: "EMAIL_VERIFIED",
      inputHandle: base.inputHandle,
      platform: base.platform,
      draftSlug: base.slug,
      email: base.email ?? null,
      ownerName: base.ownerName ?? null,
      emailVerifiedAt: new Date("2026-10-01T01:00:00.000Z"),
      socialVerifiedAt: null,
      publishedAt: null,
      verifyMethod: "DEMO_CODE",
      payload: {
        displayName: base.displayName,
        title: base.title,
        bio: base.bio,
        locationCity: base.locationCity,
        locationCountry: base.locationCountry,
        specialties: base.specialties,
        socials: base.socials,
        image: base.image,
        stage: "verified",
        attribution: base.attribution,
        verifyCode: base.verifyCode,
        verificationDelivery: "demo",
        planTier: base.planTier,
      },
      userId: "user_1",
      createdAt: new Date(base.createdAt),
      updatedAt: new Date(base.updatedAt),
    } as OnboardingSession;
    assert.equal(draftFromSession(verifiedRow).stage, "verified");
    assert.equal(draftFromSession(verifiedRow).verificationDelivery, "demo");

    const publishedRow = {
      ...verifiedRow,
      state: "PUBLISHED",
      publishedAt: new Date("2026-10-01T02:00:00.000Z"),
      payload: {
        ...((verifiedRow as { payload: Record<string, unknown> }).payload),
        stage: "published",
      },
    } as OnboardingSession;
    assert.equal(draftFromSession(publishedRow).stage, "published");
    assert.equal(draftFromSession(publishedRow).publishedAt, "2026-10-01T02:00:00.000Z");
  });
});
