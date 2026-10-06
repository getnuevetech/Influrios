import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildCampaignIntentFields,
  resolveCampaignIntentSaveMode,
} from "./business";

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
  it("applies defaults and joins optional summary parts", () => {
    const fields = buildCampaignIntentFields({
      audience: "Gen Z skincare",
      collabType: "Product review",
      timeframe: "Q4",
    });
    assert.equal(fields.goal, "Brand Awareness");
    assert.equal(fields.specialty, "beauty");
    assert.equal(fields.budget, "$1K – $5K");
    assert.equal(fields.location, "Global");
    assert.equal(fields.platform, "INSTAGRAM");
    assert.equal(fields.status, "draft");
    assert.match(fields.title, /Campaign intent/);
    assert.equal(fields.summary, "Gen Z skincare · Product review · Q4");
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
