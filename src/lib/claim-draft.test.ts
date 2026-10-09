import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { claimPublishBlockers, draftToSeedCreator, guessSpecialty, type ClaimDraft } from "./claim";

function draft(overrides: Partial<ClaimDraft> = {}): ClaimDraft {
  return {
    id: "draft_1",
    slug: "ada",
    stage: "verified",
    inputHandle: "@ada",
    platform: "INSTAGRAM",
    displayName: "Ada",
    title: "Influencer",
    bio: "Draft Influencer Profile for @ada. Confirm specialties, bio, and location after you claim — nothing publishes until you say so.",
    locationCity: "Your city",
    locationCountry: "Your country",
    specialties: [],
    socials: [{ platform: "INSTAGRAM", handle: "@ada", url: "https://instagram.com/ada", followers: 0 }],
    image: "/brand/avatars/generic.png",
    coverImage: "/brand/banners/rooftop-crew.png",
    gender: "unspecified",
    attribution: "ORGANIC_SIGNUP",
    createdAt: "2026-10-01T00:00:00.000Z",
    updatedAt: "2026-10-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("claim draft facts", () => {
  it("suggests a specialty only when the handle names one", () => {
    assert.deepEqual(guessSpecialty("ada", "INSTAGRAM"), []);
    assert.deepEqual(guessSpecialty("beautybyada", "INSTAGRAM"), ["beauty"]);
  });

  it("refuses to publish a placeholder bio, city, or specialty", () => {
    const blocked = claimPublishBlockers(draft());
    assert.equal(blocked.some((line) => line.includes("city")), true);
    assert.equal(blocked.some((line) => line.includes("bio")), true);
    assert.equal(blocked.some((line) => line.includes("specialty")), true);
    assert.deepEqual(
      claimPublishBlockers(
        draft({
          bio: "Beauty educator sharing routines, product notes, and studio days with a real audience in the city.",
          locationCity: "Austin",
          locationCountry: "USA",
          specialties: ["lifestyle"],
        }),
      ),
      [],
    );
  });

  it("does not paint invented reach, a verified badge, or a Lagos location", () => {
    const card = draftToSeedCreator(draft());
    assert.equal(card.verified, false);
    assert.equal(card.stats?.engagementRate, "");
    assert.equal(card.stats?.totalReach, "");
    assert.equal(card.languages.length, 0);
    assert.equal(card.socials.length, 1);
    assert.equal(card.socials[0]?.followers, 0);
    assert.equal(card.locationCity, "Your city");

    const claim = readFileSync("src/lib/claim.ts", "utf8");
    const directory = readFileSync("src/lib/directory.ts", "utf8");
    const cardView = readFileSync("src/components/influencer-card-view.tsx", "utf8");
    const preview = readFileSync("src/components/public-influencer-card.tsx", "utf8");
    assert.equal(claim.includes("12500"), false);
    assert.equal(claim.includes("4.8%"), false);
    assert.equal(claim.includes('locationCity = "Lagos"'), false);
    assert.equal(directory.includes('row.profileState === "VERIFIED"'), false);
    assert.equal(directory.includes('row.identityVerified === "VERIFIED"'), true);
    assert.equal(cardView.includes("creator.verified ?"), true);
    assert.equal(preview.includes("DRAFT_PREVIEW_ENTITLEMENTS"), false);
  });
});
