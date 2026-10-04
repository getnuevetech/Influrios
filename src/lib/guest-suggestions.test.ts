import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { CreatorFit } from "./business";
import {
  anonymizeGuestSuggestion,
  buildGuestSuggestionBrief,
  guestCardLeaksSlug,
  GUEST_SUGGESTION_SAMPLE_MAX,
  GUEST_SUGGESTION_SAMPLE_MIN,
  rankGuestSuggestionSample,
  sampleGuestSuggestions,
} from "./guest-suggestions";
import type { SeedCreator } from "./seed-data";

function fakeCreator(overrides: Partial<SeedCreator> & Pick<SeedCreator, "slug" | "displayName">): SeedCreator {
  return {
    slug: overrides.slug,
    displayName: overrides.displayName,
    title: overrides.title ?? "Creator",
    image: overrides.image ?? "/demo/creators/demo.jpg",
    specialties: overrides.specialties ?? ["beauty"],
    locationCity: overrides.locationCity ?? "Austin",
    locationCountry: overrides.locationCountry ?? "USA",
    planTier: overrides.planTier ?? "PLUS",
    openToCollab: overrides.openToCollab ?? true,
    socials: overrides.socials ?? [{ platform: "INSTAGRAM", handle: "@x", followers: 12_000 }],
    stats: overrides.stats,
    offer: overrides.offer,
  } as SeedCreator;
}

function fakeFit(creator: SeedCreator, score: number): CreatorFit {
  return {
    creator,
    score,
    reasons: [`Specialty match for ${creator.displayName}`],
    breakdown: {
      specialtyFit: score,
      audienceGeo: score,
      platformFit: score,
      commercialReadiness: score,
    },
  };
}

describe("guest suggestion sample (Collab OS §3.3)", () => {
  it("builds an ephemeral draft brief from guest form fields", () => {
    const brief = buildGuestSuggestionBrief({
      goal: "Product Launch",
      specialty: "beauty",
      location: "USA",
      platform: "TIKTOK",
    });
    assert.equal(brief.id, "guest-sample-brief");
    assert.equal(brief.status, "draft");
    assert.equal(brief.goal, "Product Launch");
    assert.equal(brief.platform, "TIKTOK");
    assert.equal(brief.location, "USA");
  });

  it("anonymizes to first-name + specialty and never embeds the slug", () => {
    const creator = fakeCreator({
      slug: "sofia-martinez",
      displayName: "Sofia Martinez",
      specialties: ["beauty"],
      title: "Beauty educator",
    });
    const card = anonymizeGuestSuggestion(fakeFit(creator, 91), 0);
    assert.equal(card.sampleId, "guest-sample-1");
    assert.match(card.label, /^Sofia · /);
    assert.ok(!card.label.includes("Martinez"));
    assert.equal(guestCardLeaksSlug(card, "sofia-martinez"), false);
    assert.ok(!card.reason.includes("Sofia Martinez"));
    assert.ok(!("slug" in card));
  });

  it("returns 2–3 sample cards when enough fits exist", () => {
    const fits = [90, 80, 70, 60].map((score, index) =>
      fakeFit(
        fakeCreator({
          slug: `creator-${index}`,
          displayName: `Name ${index}`,
        }),
        score,
      ),
    );
    const sample = sampleGuestSuggestions(fits);
    assert.equal(sample.length, GUEST_SUGGESTION_SAMPLE_MAX);
    assert.ok(sample.length >= GUEST_SUGGESTION_SAMPLE_MIN);
    assert.equal(sample[0]?.score, 90);
  });

  it("ranks directory creators and keeps guest cards slug-safe", () => {
    const creators = [
      fakeCreator({
        slug: "amara-okonkwo",
        displayName: "Amara Okonkwo",
        specialties: ["beauty"],
        socials: [{ platform: "INSTAGRAM", handle: "@a", followers: 50_000 }],
      }),
      fakeCreator({
        slug: "jordan-lee",
        displayName: "Jordan Lee",
        specialties: ["tech"],
        socials: [{ platform: "YOUTUBE", handle: "@j", followers: 8_000 }],
      }),
      fakeCreator({
        slug: "priya-shah",
        displayName: "Priya Shah",
        specialties: ["beauty"],
        socials: [{ platform: "INSTAGRAM", handle: "@p", followers: 22_000 }],
      }),
    ];
    const brief = buildGuestSuggestionBrief({ specialty: "beauty", platform: "INSTAGRAM" });
    const sample = rankGuestSuggestionSample(brief, creators);
    assert.ok(sample.length >= GUEST_SUGGESTION_SAMPLE_MIN);
    assert.ok(sample.length <= GUEST_SUGGESTION_SAMPLE_MAX);
    for (const card of sample) {
      assert.equal(guestCardLeaksSlug(card, "amara-okonkwo"), false);
      assert.equal(guestCardLeaksSlug(card, "jordan-lee"), false);
      assert.equal(guestCardLeaksSlug(card, "priya-shah"), false);
    }
  });
});
