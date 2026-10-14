import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import {
  PIPELINE_STAGES,
  derivePipelineStage,
  pipelineFundingSurface,
  scoreBusinessRequestForCreator,
  sharedStoredCurrency,
  summarizeBusinessSpend,
} from "./collaboration-hub";
import type { MarketplaceBusinessRequestRow } from "./marketplace-listings";
import type { SeedCreator } from "./seed-data";

describe("collaboration hub pipeline", () => {
  it("maps draft/sent to Match and accepted to Contract", () => {
    assert.equal(derivePipelineStage({ collaborationStatus: "draft" }), "Match");
    assert.equal(derivePipelineStage({ collaborationStatus: "sent" }), "Match");
    assert.equal(derivePipelineStage({ collaborationStatus: "accepted" }), "Contract");
  });

  it("surfaces Product §16 funding badge, locked fee, and revision summary", () => {
    const surface = pipelineFundingSurface({
      status: "held",
      feeCents: 500,
      currency: "USD",
      grossCents: 10_000,
      heldCents: 10_000,
      releasedCents: 0,
      milestones: [
        { title: "Delivery", revisionCount: 1, revisionLimit: 2, status: "submitted" },
      ],
    });
    assert.equal(surface.fundingBadge, "Fully Funded");
    assert.equal(surface.feeCents, 500);
    assert.equal(surface.currency, "USD");
    assert.match(String(surface.revisionSummary), /1\/2 revisions/);
    assert.match(String(surface.revisionSummary), /Delivery/);
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

describe("business hub spend summary", () => {
  it("aggregates funded/held/released/refunded/fee across deals", () => {
    const summary = summarizeBusinessSpend([
      {
        grossCents: 10_000,
        feeCents: 1_000,
        currency: "USD",
        ledger: { heldCents: 4_000, releasedCents: 5_000, refundedCents: 1_000, heldInCents: 10_000 },
      },
      {
        grossCents: 5_000,
        feeCents: 500,
        currency: "USD",
        ledger: { heldCents: 2_000, releasedCents: 3_000, refundedCents: 0, heldInCents: 5_000 },
      },
    ]);
    assert.equal(summary.fundedCents, 15_000);
    assert.equal(summary.heldCents, 6_000);
    assert.equal(summary.releasedCents, 8_000);
    assert.equal(summary.refundedCents, 1_000);
    assert.equal(summary.feeCents, 1_500);
    assert.equal(summary.dealCount, 2);
    assert.equal(summary.currency, "USD");
  });

  it("returns zeroed summary for empty funding lists", () => {
    const summary = summarizeBusinessSpend([]);
    assert.equal(summary.fundedCents, 0);
    assert.equal(summary.dealCount, 0);
    assert.equal(summary.currency, "");
  });

  it("keeps a stored currency and leaves a blank or mixed set unlabeled", () => {
    assert.equal(sharedStoredCurrency(["gbp", "GBP"]), "GBP");
    assert.equal(sharedStoredCurrency([""]), "");
    assert.equal(sharedStoredCurrency(["USD", "GBP"]), "");
    assert.equal(sharedStoredCurrency(["USD", ""]), "");
    const gbp = summarizeBusinessSpend([
      {
        grossCents: 2_000,
        feeCents: 200,
        currency: "gbp",
        ledger: { heldCents: 2_000, releasedCents: 0, refundedCents: 0, heldInCents: 2_000 },
      },
    ]);
    assert.equal(gbp.currency, "GBP");
    const mixed = summarizeBusinessSpend([
      {
        grossCents: 2_000,
        feeCents: 200,
        currency: "USD",
        ledger: { heldCents: 2_000, releasedCents: 0, refundedCents: 0, heldInCents: 2_000 },
      },
      {
        grossCents: 2_000,
        feeCents: 200,
        currency: "GBP",
        ledger: { heldCents: 2_000, releasedCents: 0, refundedCents: 0, heldInCents: 2_000 },
      },
    ]);
    assert.equal(mixed.currency, "");
    const hub = readFileSync("src/lib/collaboration-hub.ts", "utf8");
    const creatorHub = readFileSync("src/app/collaboration/hub/page.tsx", "utf8");
    const businessHub = readFileSync("src/app/collaboration/business/page.tsx", "utf8");
    assert.equal(hub.includes('currency: "USD"'), false);
    assert.equal(hub.includes('?? "USD"'), false);
    assert.equal(creatorHub.includes("formatMoney("), false);
    assert.equal(businessHub.includes("formatMoney("), false);
    assert.match(creatorHub, /formatStoredMoney\(availableCents, hub\.earnings\.currency\)/);
    assert.match(businessHub, /formatStoredMoney\(hub\.spend\.fundedCents, hub\.spend\.currency\)/);
  });
});

describe("influencer campaign card links", () => {
  it("opens the campaign request page instead of the public business marketing page", () => {
    const creatorHub = readFileSync("src/app/collaboration/hub/page.tsx", "utf8");
    const creatorHome = readFileSync("src/app/creator/page.tsx", "utf8");
    const requestPage = readFileSync("src/app/collaboration/requests/[id]/page.tsx", "utf8");

    assert.match(creatorHub, /\/collaboration\/requests\/\$\{encodeURIComponent\(request\.id\)\}/);
    assert.match(creatorHub, /View campaign/);
    assert.equal(creatorHub.includes('href="/business"'), false);
    assert.equal(creatorHub.includes("View Match"), false);

    assert.match(creatorHome, /\/collaboration\/requests\/\$\{encodeURIComponent\(request\.id\)\}/);
    assert.match(requestPage, /Apply to campaign/);
    assert.match(requestPage, /getPublishedBusinessRequest/);
  });
});
