import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { commercialReadinessFromEntitlements, fitCreatorToBrief, type CampaignBrief } from "./business";
import { planLabel, storedCreatorPlan } from "./entitlements";
import { analyticsRecordsDetail } from "./short-link-analytics";
import type { SeedCreator } from "./seed-data";

function creator(planTier: string): SeedCreator {
  return {
    slug: "ada",
    displayName: "Ada",
    title: "",
    bio: "",
    locationCity: "",
    locationCountry: "",
    languages: [],
    avatarColor: "",
    image: "",
    badge: "",
    statusLabel: "",
    planTier,
    specialties: [],
    socials: [],
    openToCollab: true,
  };
}

const brief: CampaignBrief = {
  id: "brief-1",
  title: "Spring",
  goal: "",
  specialty: "",
  budget: "",
  location: "",
  platform: "",
  summary: "",
  createdAt: "2026-10-12T00:00:00.000Z",
  status: "draft",
};

describe("stored creator plans", () => {
  it("keeps a stored plan code and uses Starter only when the plan is blank", () => {
    assert.equal(storedCreatorPlan(""), "STARTER");
    assert.equal(storedCreatorPlan("  "), "STARTER");
    assert.equal(storedCreatorPlan("plus"), "PLUS");
    assert.equal(storedCreatorPlan("agency_card"), "AGENCY_CARD");
    assert.equal(planLabel("STARTER"), "Starter");
    assert.equal(planLabel("AGENCY_CARD"), "Agency Card");
    assert.equal(planLabel(""), "");
  });

  it("scores commercial readiness from features", () => {
    assert.equal(commercialReadinessFromEntitlements(false, { leadTracking: true, collabCta: true }), 30);
    assert.equal(commercialReadinessFromEntitlements(true, { leadTracking: true, collabCta: false }), 95);
    assert.equal(commercialReadinessFromEntitlements(true, { leadTracking: false, collabCta: true }), 88);
    assert.equal(commercialReadinessFromEntitlements(true, { leadTracking: false, collabCta: false }), 74);
    assert.equal(fitCreatorToBrief(creator("PLUS"), brief).score, 88);
    assert.equal(fitCreatorToBrief(creator("AGENCY_CARD"), brief).score, 74);
  });

  it("records a card action only when the analytics level includes it", () => {
    assert.equal(analyticsRecordsDetail("views", "cta_click"), false);
    assert.equal(analyticsRecordsDetail("standard", "inquiry_conversion"), false);
    assert.equal(analyticsRecordsDetail("advanced", "cta_click"), true);
    assert.equal(analyticsRecordsDetail("views", "qr_scan"), true);
    const business = readFileSync("src/lib/business.ts", "utf8");
    const claim = readFileSync("src/lib/claim.ts", "utf8");
    const analytics = readFileSync("src/app/api/short-links/[id]/analytics/route.ts", "utf8");
    const cards = readFileSync("src/app/admin/cards/page.tsx", "utf8");
    assert.equal(business.includes('planTier === "PRO"'), false);
    assert.equal(claim.includes('draft.planTier === "PLUS"'), false);
    assert.equal(analytics.includes("isPlanCode"), false);
    assert.match(cards, /PublicInfluencerCard/);
    assert.match(readFileSync("src/lib/short-link.ts", "utf8"), /analyticsRecordsDetail/);
  });
});
