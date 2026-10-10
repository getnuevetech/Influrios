import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import {
  buildCampaignIntentFields,
  fitCreatorToBrief,
  resolveCampaignIntentSaveMode,
  type CampaignBrief,
} from "./business";
import type { SeedCreator } from "./seed-data";

function source(path: string) {
  return readFileSync(path, "utf8");
}

function brief(overrides: Partial<CampaignBrief> = {}): CampaignBrief {
  return {
    id: "brief-1",
    title: "Spring set",
    goal: "",
    specialty: "",
    budget: "",
    location: "",
    platform: "",
    summary: "",
    createdAt: "2026-10-10T00:00:00.000Z",
    status: "draft",
    ...overrides,
  };
}

function creator(overrides: Partial<SeedCreator> = {}): SeedCreator {
  return {
    slug: "ada-okonkwo",
    displayName: "Ada Okonkwo",
    title: "Beauty educator",
    bio: "",
    locationCity: "Lagos",
    locationCountry: "Nigeria",
    languages: [],
    avatarColor: "#111A5A",
    image: "/uploads/ada.jpg",
    badge: "",
    statusLabel: "",
    planTier: "PLUS",
    specialties: ["beauty"],
    socials: [{ platform: "INSTAGRAM", handle: "@ada", url: "https://instagram.com/ada", followers: 12_000 }],
    openToCollab: true,
    ...overrides,
  };
}

describe("campaign intent save mode (W2.3)", () => {
  it("creates when briefId is missing or not owned", () => {
    assert.equal(
      resolveCampaignIntentSaveMode({ briefId: null, ownedBriefIds: ["brief-a"] }),
      "create",
    );
    assert.equal(
      resolveCampaignIntentSaveMode({ briefId: "  ", ownedBriefIds: ["brief-a"] }),
      "create",
    );
    assert.equal(
      resolveCampaignIntentSaveMode({ briefId: "brief-other", ownedBriefIds: ["brief-a"] }),
      "create",
    );
  });

  it("updates when briefId is owned by the workspace", () => {
    assert.equal(
      resolveCampaignIntentSaveMode({ briefId: "brief-a", ownedBriefIds: ["brief-a", "brief-b"] }),
      "update",
    );
    assert.equal(
      resolveCampaignIntentSaveMode({ briefId: "  brief-b  ", ownedBriefIds: ["brief-a", "brief-b"] }),
      "update",
    );
  });
});

describe("campaign intent field builder (W2.3)", () => {
  it("stores the title and leaves unentered fields blank", () => {
    const fields = buildCampaignIntentFields({
      title: "Spring set",
      audience: "Gen Z skincare",
      collabType: "Product review",
      timeframe: "Q4",
    });
    assert.equal(fields.title, "Spring set");
    assert.equal(fields.goal, "");
    assert.equal(fields.specialty, "");
    assert.equal(fields.budget, "");
    assert.equal(fields.location, "");
    assert.equal(fields.platform, "");
    assert.equal(fields.status, "draft");
    assert.equal(fields.summary, "Gen Z skincare · Product review · Q4");
  });

  it("requires a campaign title", () => {
    assert.throws(() => buildCampaignIntentFields({ audience: "Gen Z skincare" }), /title/);
  });

  it("keeps explicit title and summary when provided", () => {
    const fields = buildCampaignIntentFields({
      title: "Clean launch",
      goal: "Product Launch",
      specialty: "beauty",
      budget: "$5K – $10K",
      location: "USA",
      platform: "TIKTOK",
      summary: "Honest routine series",
    });
    assert.equal(fields.title, "Clean launch");
    assert.equal(fields.goal, "Product Launch");
    assert.equal(fields.platform, "TIKTOK");
    assert.equal(fields.summary, "Honest routine series");
  });
});

describe("campaign intent fit", () => {
  it("does not treat a blank specialty as a match", () => {
    const fit = fitCreatorToBrief(creator(), brief());
    assert.equal(fit.breakdown.specialtyFit, 0);
    assert.equal(fit.reasons.some((reason) => reason.startsWith("Specialty match")), false);
    assert.equal(fit.reasons.some((reason) => reason.includes("Partial specialty overlap")), false);
    assert.equal(fit.score, 88);
  });

  it("explains a partial overlap only when a specialty was asked", () => {
    const fit = fitCreatorToBrief(creator(), brief({ specialty: "tech" }));
    assert.ok(fit.reasons.some((reason) => reason.includes("Partial specialty overlap")));
  });
});

describe("campaign intent sources", () => {
  it("does not invent a sample brief on save or on the hub form", () => {
    const files = [
      "src/lib/business.ts",
      "src/app/collaboration/business/actions.ts",
      "src/app/collaboration/business/page.tsx",
      "src/app/business/actions.ts",
      "src/app/business/workspace/actions.ts",
    ];
    for (const file of files) {
      const text = source(file);
      assert.equal(text.includes("$1K – $5K"), false, file);
      assert.equal(text.includes("Untitled brief"), false, file);
      assert.equal(text.includes('?? "beauty"'), false, file);
      assert.equal(text.includes("Strong specialty and market fit"), false, file);
    }
    const page = source("src/app/collaboration/business/page.tsx");
    assert.match(page, /name="title"/);
    assert.match(page, /required/);
  });
});
