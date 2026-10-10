import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import {
  claimDraftProfile,
  claimPublishBlockers,
  draftToSeedCreator,
  enteredProfilePlatform,
  enteredSelfDescription,
  guessSpecialty,
  type ClaimDraft,
} from "./claim";

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
  it("stores the handle and platform and leaves the profile blank", () => {
    const named = claimDraftProfile("https://instagram.com/ada", "instagram");
    assert.equal(named.ok, true);
    if (!named.ok) return;
    assert.equal(named.platform, "INSTAGRAM");
    assert.equal(named.handle, "ada");
    assert.equal(named.displayName, "Ada");
    assert.equal(named.title, "");
    assert.equal(named.bio, "");
    assert.equal(named.locationCity, "");
    assert.equal(named.locationCountry, "");
    assert.deepEqual(named.specialties, []);

    const fromChip = claimDraftProfile("@beautybyada", "tiktok");
    assert.equal(fromChip.ok, true);
    if (fromChip.ok) {
      assert.equal(fromChip.platform, "TIKTOK");
      assert.equal(fromChip.handle, "beautybyada");
      assert.deepEqual(fromChip.specialties, []);
    }

    const missingPlatform = claimDraftProfile("@ada");
    assert.equal(missingPlatform.ok, false);
    if (!missingPlatform.ok) assert.equal(missingPlatform.error, "Choose a social platform.");

    const missingHandle = claimDraftProfile("https://instagram.com/", "instagram");
    assert.equal(missingHandle.ok, false);
    if (!missingHandle.ok) assert.equal(missingHandle.error, "Enter a social URL or handle.");

    const claim = readFileSync("src/lib/claim.ts", "utf8");
    const page = readFileSync("src/app/claim/page.tsx", "utf8");
    const preview = readFileSync("src/app/claim/preview/[draftId]/page.tsx", "utf8");
    assert.equal(claim.includes("New Influencer"), false);
    assert.equal(claim.includes("Your city"), false);
    assert.equal(claim.includes("Your country"), false);
    assert.equal(claim.includes("Draft Influencer Profile"), false);
    assert.equal(claim.includes('handle = "influencer"'), false);
    assert.equal(page.includes("SOCIAL_HINTS[0]"), false);
    assert.equal(preview.includes('? "Influencer"'), false);
  });

  it("stores the self-description that was chosen", () => {
    const allowed = ["Influencer", "Content Creator", "Other"];
    const chosen = enteredSelfDescription("Content Creator", allowed);
    assert.equal(chosen.ok, true);
    if (chosen.ok) assert.equal(chosen.title, "Content Creator");

    const exact = enteredSelfDescription("Influencer", allowed);
    assert.equal(exact.ok, true);
    if (exact.ok) assert.equal(exact.title, "Influencer");

    const blank = enteredSelfDescription("  ", allowed);
    assert.equal(blank.ok, false);
    if (!blank.ok) assert.equal(blank.error, "Choose how you describe yourself.");

    const unknown = enteredSelfDescription("Influencer", ["Content Creator"]);
    assert.equal(unknown.ok, false);
    if (!unknown.ok) assert.equal(unknown.error, "Choose how you describe yourself.");

    const current = enteredSelfDescription("Educator", ["Content Creator", "Educator"]);
    assert.equal(current.ok, true);
    if (current.ok) assert.equal(current.title, "Educator");

    const actions = readFileSync("src/app/claim/actions.ts", "utf8");
    const dashboard = readFileSync("src/app/dashboard/page.tsx", "utf8");
    assert.equal(actions.includes('? "Influencer"'), false);
    assert.equal(actions.includes(': "Influencer"'), false);
    assert.equal(actions.includes("selfDescriptions[0]"), false);
    assert.equal(dashboard.includes('? "Influencer"'), false);
    assert.equal(dashboard.includes(': "Influencer"'), false);
  });

  it("stores the social platform already on an invited profile", () => {
    const tiktok = enteredProfilePlatform([{ platform: "TIKTOK", handle: "@ada" }]);
    assert.equal(tiktok.ok, true);
    if (tiktok.ok) {
      assert.equal(tiktok.platform, "TIKTOK");
      assert.equal(tiktok.handle, "@ada");
    }

    const blank = enteredProfilePlatform([]);
    assert.equal(blank.ok, false);
    if (!blank.ok) assert.equal(blank.error, "This profile has no social platform.");

    const emptyPlatform = enteredProfilePlatform([{ platform: "  ", handle: "@ada" }]);
    assert.equal(emptyPlatform.ok, false);

    const claim = readFileSync("src/lib/claim.ts", "utf8");
    const invite = readFileSync("src/app/invite/[token]/page.tsx", "utf8");
    assert.equal(claim.includes('|| "INSTAGRAM"'), false);
    assert.match(invite, /opened\.state === "unavailable"/);
  });

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
    const card = draftToSeedCreator(
      draft({
        bio: "",
        locationCity: "",
        locationCountry: "",
        title: "",
        specialties: [],
      }),
    );
    assert.equal(card.verified, false);
    assert.equal(card.stats?.engagementRate, "");
    assert.equal(card.stats?.totalReach, "");
    assert.equal(card.languages.length, 0);
    assert.equal(card.socials.length, 1);
    assert.equal(card.socials[0]?.followers, 0);
    assert.equal(card.locationCity, "");
    assert.equal(card.locationCountry, "");
    assert.equal(card.title, "");
    assert.equal(card.bio, "");

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
