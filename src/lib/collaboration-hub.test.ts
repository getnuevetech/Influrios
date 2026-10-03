import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  PIPELINE_STAGES,
  derivePipelineStage,
  scoreBusinessRequestForCreator,
} from "./collaboration-hub";
import type { MarketplaceBusinessRequestRow } from "./marketplace-listings";
import type { SeedCreator } from "./seed-data";

describe("collaboration hub pipeline", () => {
  it("maps draft/sent to Match and accepted to Contract", () => {
    assert.equal(derivePipelineStage({ collaborationStatus: "draft" }), "Match");
    assert.equal(derivePipelineStage({ collaborationStatus: "sent" }), "Match");
    assert.equal(derivePipelineStage({ collaborationStatus: "accepted" }), "Contract");
  });

  it("advances through funded → progress → review → released", () => {
    assert.equal(
      derivePipelineStage({ collaborationStatus: "accepted", fundingStatus: "awaiting_provider" }),
      "Funded",
    );
    assert.equal(
      derivePipelineStage({
        collaborationStatus: "accepted",
        fundingStatus: "held",
      }),
      "Funded",
    );
    assert.equal(
      derivePipelineStage({
        collaborationStatus: "accepted",
        fundingStatus: "held",
        milestoneStatuses: ["submitted"],
      }),
      "In Progress",
    );
    assert.equal(
      derivePipelineStage({
        collaborationStatus: "accepted",
        fundingStatus: "held",
        milestoneStatuses: ["approved"],
      }),
      "Review",
    );
    assert.equal(
      derivePipelineStage({
        collaborationStatus: "accepted",
        fundingStatus: "completed",
        milestoneStatuses: ["released"],
      }),
      "Released",
    );
  });

  it("exposes the six Figure 2 stages in order", () => {
    assert.deepEqual([...PIPELINE_STAGES], [
      "Match",
      "Contract",
      "Funded",
      "In Progress",
      "Review",
      "Released",
    ]);
  });
});

describe("business request affinity", () => {
  it("scores higher when specialty and location overlap", () => {
    const creator = {
      specialties: ["travel", "lifestyle"],
      locationCity: "Los Angeles",
      locationCountry: "USA",
    } as SeedCreator;
    const strong: MarketplaceBusinessRequestRow = {
      id: "1",
      brand: "WanderStay",
      category: "Travel",
      budget: "$5k",
      location: "Los Angeles",
      tags: ["travel", "hotels"],
      summary: "Looking for travel creators",
      lookingFor: "travel lifestyle creators",
      status: "published",
      sortOrder: 0,
    };
    const weak: MarketplaceBusinessRequestRow = {
      ...strong,
      id: "2",
      category: "Tech",
      location: "Tokyo",
      tags: ["gadgets"],
      lookingFor: "gadget reviewers",
      summary: "Consumer tech unboxings",
    };
    assert.ok(scoreBusinessRequestForCreator(strong, creator) > scoreBusinessRequestForCreator(weak, creator));
  });
});
