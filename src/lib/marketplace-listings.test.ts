import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import {
  applicationIsStaleForExpire,
  applicationTransitionLabel,
  businessOwnsApplication,
  canTransitionApplication,
  createMarketplaceApplication,
  creatorOwnsApplication,
  isLaunchSampleBusinessRequest,
  isLaunchSampleCreatorOpportunity,
  isWorkspaceOwnedRequest,
  isWorkspaceOwnedRequestBrand,
  listWorkspaceBusinessRequests,
  publicListingAsset,
  MARKETPLACE_APPLICATION_STATUSES,
  nextApplicationStatuses,
  sweepExpiredMarketplaceApplications,
  transitionMarketplaceApplication,
  getMarketplaceApplication,
  upsertBusinessRequest,
  upsertCreatorOpportunity,
} from "./marketplace-listings";
import { prisma } from "./db";
import { DEFAULT_COLLAB_CONTROL_PLANE, saveCollabControlPlane } from "./collab-control-plane";
import { DEMO_BUSINESS_WORKSPACE_ID, ensureDemoBusinessWorkspace } from "./business";
import { BUSINESS_REQUESTS, CREATOR_OPPORTUNITIES } from "./matching";

const hasDbUrl = Boolean(process.env.DATABASE_URL);

async function requireDb(t: { skip: (msg?: string) => void }) {
  if (!hasDbUrl) {
    t.skip("DATABASE_URL not set");
    return false;
  }
  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch {
    t.skip("Postgres not reachable");
    return false;
  }
}

describe("launch sample marketplace rows", () => {
  it("hides an untouched sample and keeps an edited brand", () => {
    assert.equal(
      isLaunchSampleBusinessRequest({
        id: "br-sephora",
        brand: "Lumina Beauty Co.",
        summary: "Looking for beauty + hair educators for a clean-skincare launch series.",
      }),
      true,
    );
    assert.equal(
      isLaunchSampleBusinessRequest({
        id: "br-sephora",
        brand: "Northwind Studio",
        summary: "Looking for beauty + hair educators for a clean-skincare launch series.",
      }),
      false,
    );
    assert.equal(
      isLaunchSampleCreatorOpportunity({
        id: "co-daniel",
        creatorSlug: "daniel-kim",
        summary: "Open to destination partnerships and co-created food itineraries.",
      }),
      true,
    );
    assert.equal(isLaunchSampleCreatorOpportunity({ id: "opp-1", creatorSlug: "ada", summary: "Real" }), false);
  });

  it("deletes leftover samples and does not insert them", () => {
    const listings = readFileSync("src/lib/marketplace-listings.ts", "utf8");
    const seed = readFileSync("prisma/seed.ts", "utf8");
    const sql = readFileSync(
      "prisma/migrations/20261009010000_remove_launch_sample_listings/migration.sql",
      "utf8",
    );
    assert.equal(listings.includes("createMany"), false);
    assert.equal(listings.includes("BRAND_DEMO_ART"), false);
    assert.match(listings, /deleteMany/);
    assert.match(seed, /ensureMarketplaceListings/);
    assert.equal(seed.includes("BUSINESS_REQUESTS"), false);
    assert.equal(seed.includes("CREATOR_OPPORTUNITIES"), false);
    for (const row of [...BUSINESS_REQUESTS, ...CREATOR_OPPORTUNITIES]) {
      assert.match(sql, new RegExp(row.id));
      assert.match(sql, new RegExp(row.summary.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    }
  });

  it("refuses to save a retired sample identity", async () => {
    const request = BUSINESS_REQUESTS[0]!;
    await assert.rejects(
      () =>
        upsertBusinessRequest({
          id: request.id,
          brand: request.brand,
          category: request.category,
          budget: request.budget,
          location: request.location,
          tags: request.tags,
          summary: request.summary,
          lookingFor: request.lookingFor,
          status: "published",
          sortOrder: 0,
        }),
      /retired sample/,
    );
    const opportunity = CREATOR_OPPORTUNITIES[0]!;
    await assert.rejects(
      () =>
        upsertCreatorOpportunity({
          id: opportunity.id,
          creatorSlug: opportunity.creatorSlug,
          lookingFor: opportunity.lookingFor,
          summary: opportunity.summary,
          status: "published",
          sortOrder: 0,
        }),
      /retired sample/,
    );
  });

  it("drops demo art and keeps an uploaded logo", () => {
    assert.equal(publicListingAsset("/demo/brands/sephora.svg"), null);
    assert.equal(publicListingAsset("/uploads/banners/logo.png"), "/uploads/banners/logo.png");
    assert.equal(publicListingAsset("  "), null);
  });
});

describe("marketplace application state machine", () => {
  it("exposes the Collab OS invitation statuses", () => {
    assert.ok(MARKETPLACE_APPLICATION_STATUSES.includes("REQUESTED"));
    assert.ok(MARKETPLACE_APPLICATION_STATUSES.includes("COLLABORATION_DRAFTED"));
    assert.ok(MARKETPLACE_APPLICATION_STATUSES.includes("WITHDRAWN"));
    assert.ok(MARKETPLACE_APPLICATION_STATUSES.includes("EXPIRED"));
  });

  it("allows REQUESTED → VIEWED and blocks terminal re-entry", () => {
    assert.equal(canTransitionApplication("REQUESTED", "VIEWED"), true);
    assert.equal(canTransitionApplication("REQUESTED", "ACCEPTED"), false);
    assert.equal(canTransitionApplication("DECLINED", "REQUESTED"), false);
    assert.equal(canTransitionApplication("COLLABORATION_DRAFTED", "ACCEPTED"), false);
  });

  it("allows the happy path to collaboration draft", () => {
    assert.equal(canTransitionApplication("VIEWED", "RESPONDED"), true);
    assert.equal(canTransitionApplication("RESPONDED", "NEGOTIATING"), true);
    assert.equal(canTransitionApplication("NEGOTIATING", "ACCEPTED"), true);
    assert.equal(canTransitionApplication("ACCEPTED", "COLLABORATION_DRAFTED"), true);
  });

  it("lists next statuses including EXPIRED and readable transition labels (W2.3c)", () => {
    assert.deepEqual(nextApplicationStatuses("REQUESTED"), [
      "VIEWED",
      "DECLINED",
      "EXPIRED",
      "WITHDRAWN",
    ]);
    assert.deepEqual(nextApplicationStatuses("ACCEPTED"), ["COLLABORATION_DRAFTED", "WITHDRAWN"]);
    assert.equal(applicationTransitionLabel("COLLABORATION_DRAFTED"), "Draft contract");
    assert.equal(applicationTransitionLabel("VIEWED"), "Mark viewed");
    assert.equal(applicationTransitionLabel("EXPIRED"), "Mark expired");
  });

  it("detects stale applications for auto-expire", () => {
    const now = new Date("2026-10-04T12:00:00.000Z");
    assert.equal(
      applicationIsStaleForExpire({
        createdAt: "2026-09-01T12:00:00.000Z",
        afterDays: 14,
        now,
      }),
      true,
    );
    assert.equal(
      applicationIsStaleForExpire({
        createdAt: "2026-10-03T12:00:00.000Z",
        afterDays: 14,
        now,
      }),
      false,
    );
  });
});

describe("marketplace application ownership guards (W2.3c)", () => {
  it("owns requests only by durable workspaceId (not brand text)", () => {
    assert.equal(isWorkspaceOwnedRequest({ workspaceId: "demo-business" }, "demo-business"), true);
    assert.equal(isWorkspaceOwnedRequest({ workspaceId: "other" }, "demo-business"), false);
    assert.equal(isWorkspaceOwnedRequest({ workspaceId: null }, "demo-business"), false);
    assert.equal(isWorkspaceOwnedRequest({}, "demo-business"), false);
    assert.equal(isWorkspaceOwnedRequest({ workspaceId: "demo-business" }, ""), false);
  });

  it("keeps deprecated brand helper for legacy reads only", () => {
    assert.equal(isWorkspaceOwnedRequestBrand("Luminous Beauty", "Luminous Beauty"), true);
    assert.equal(isWorkspaceOwnedRequestBrand("Other Brand", "Luminous Beauty"), false);
  });

  it("recognizes creator parties on either side", () => {
    assert.equal(creatorOwnsApplication({ fromSlug: "sofia-martinez", toSlug: null }, "sofia-martinez"), true);
    assert.equal(creatorOwnsApplication({ fromSlug: null, toSlug: "sofia-martinez" }, "sofia-martinez"), true);
    assert.equal(creatorOwnsApplication({ fromSlug: "other", toSlug: null }, "sofia-martinez"), false);
  });

  it("requires businessRequestId to be in the owned set", () => {
    assert.equal(businessOwnsApplication({ businessRequestId: "req-1" }, ["req-1", "req-2"]), true);
    assert.equal(businessOwnsApplication({ businessRequestId: "req-9" }, ["req-1"]), false);
    assert.equal(businessOwnsApplication({ businessRequestId: null }, ["req-1"]), false);
  });
});

describe("marketplace request workspace ownership (db)", () => {
  it("lists only published requests for the owning workspaceId", async (t) => {
    if (!(await requireDb(t))) return;
    await ensureDemoBusinessWorkspace();
    const stamp = Date.now().toString(36);
    const owned = await prisma.marketplaceBusinessRequest.create({
      data: {
        id: `req-own-${stamp}`,
        brand: `Foreign Brand ${stamp}`,
        category: "beauty",
        budget: "$1K",
        location: "USA",
        tags: ["own"],
        summary: "Owned by workspaceId even when brand differs",
        lookingFor: "creators",
        status: "published",
        sortOrder: 97,
        publishedAt: new Date(),
        workspaceId: DEMO_BUSINESS_WORKSPACE_ID,
      },
    });
    const catalog = await prisma.marketplaceBusinessRequest.create({
      data: {
        id: `req-cat-${stamp}`,
        brand: "Luminous Beauty",
        category: "beauty",
        budget: "$1K",
        location: "USA",
        tags: ["catalog"],
        summary: "Admin catalog seed with matching brand but no workspace",
        lookingFor: "creators",
        status: "published",
        sortOrder: 98,
        publishedAt: new Date(),
        workspaceId: null,
      },
    });

    const rows = await listWorkspaceBusinessRequests(DEMO_BUSINESS_WORKSPACE_ID);
    assert.ok(rows.some((row) => row.id === owned.id));
    assert.ok(!rows.some((row) => row.id === catalog.id));
    assert.equal(isWorkspaceOwnedRequest(owned, DEMO_BUSINESS_WORKSPACE_ID), true);
    assert.equal(isWorkspaceOwnedRequest(catalog, DEMO_BUSINESS_WORKSPACE_ID), false);

    await prisma.marketplaceBusinessRequest.deleteMany({
      where: { id: { in: [owned.id, catalog.id] } },
    });
  });
});

describe("marketplace application create/transition (db)", () => {
  it("creates REQUESTED with timeline event, transitions with events, rejects unpublished", async (t) => {
    if (!(await requireDb(t))) return;
    const stamp = Date.now().toString(36);
    const published = await prisma.marketplaceBusinessRequest.create({
      data: {
        id: `req-pub-${stamp}`,
        brand: `Brand ${stamp}`,
        category: "beauty",
        budget: "$1K",
        location: "USA",
        tags: ["test"],
        summary: "Integration test request",
        lookingFor: "beauty influencers",
        status: "published",
        sortOrder: 99,
        publishedAt: new Date(),
      },
    });
    const draft = await prisma.marketplaceBusinessRequest.create({
      data: {
        id: `req-draft-${stamp}`,
        brand: `Draft ${stamp}`,
        category: "beauty",
        budget: "$1K",
        location: "USA",
        tags: ["test"],
        summary: "Draft request",
        lookingFor: "beauty influencers",
        status: "draft",
        sortOrder: 100,
      },
    });

    await assert.rejects(
      () =>
        createMarketplaceApplication({
          kind: "business_request",
          businessRequestId: draft.id,
          fromSlug: `creator-${stamp}`,
        }),
      /published/i,
    );

    const created = await createMarketplaceApplication({
      kind: "business_request",
      businessRequestId: published.id,
      fromUserId: `user-${stamp}`,
      fromSlug: `creator-${stamp}`,
      note: "Apply from test",
    });
    assert.equal(created.status, "REQUESTED");

    const loaded = await getMarketplaceApplication(created.id);
    assert.ok(loaded);
    assert.equal(loaded!.events.length, 1);
    assert.equal(loaded!.events[0]?.toStatus, "REQUESTED");

    const viewed = await transitionMarketplaceApplication({
      id: created.id,
      toStatus: "VIEWED",
      actorUserId: `biz-${stamp}`,
      note: "Business opened",
    });
    assert.equal(viewed.status, "VIEWED");

    const after = await getMarketplaceApplication(created.id);
    assert.ok(after);
    assert.equal(after!.events.length, 2);
    assert.equal(after!.events[1]?.toStatus, "VIEWED");
    assert.equal(after!.events[1]?.fromStatus, "REQUESTED");

    await prisma.marketplaceApplication.delete({ where: { id: created.id } }).catch(() => undefined);
    await prisma.marketplaceBusinessRequest.deleteMany({
      where: { id: { in: [published.id, draft.id] } },
    });
  });

  it("auto-expire sweep expires stale apps when mode is auto, no-ops when manual", async (t) => {
    if (!(await requireDb(t))) return;
    const stamp = Date.now().toString(36);

    await saveCollabControlPlane({
      actor: "w23c-test@example.com",
      applicationExpire: { mode: "manual", afterDays: 14 },
      mentorship: DEFAULT_COLLAB_CONTROL_PLANE.mentorship,
      guestCollab: DEFAULT_COLLAB_CONTROL_PLANE.guestCollab,
    });
    const manual = await sweepExpiredMarketplaceApplications();
    assert.equal(manual.mode, "manual");
    assert.equal(manual.expired, 0);

    const request = await prisma.marketplaceBusinessRequest.create({
      data: {
        id: `req-exp-${stamp}`,
        brand: `Expire ${stamp}`,
        category: "beauty",
        budget: "$1K",
        location: "USA",
        tags: ["test"],
        summary: "Expire test",
        lookingFor: "creators",
        status: "published",
        sortOrder: 101,
        publishedAt: new Date(),
      },
    });
    const app = await createMarketplaceApplication({
      kind: "business_request",
      businessRequestId: request.id,
      fromSlug: `creator-exp-${stamp}`,
    });
    // Backdate createdAt so it is stale under a 1-day window.
    const old = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
    await prisma.marketplaceApplication.update({
      where: { id: app.id },
      data: { createdAt: old },
    });

    await saveCollabControlPlane({
      actor: "w23c-test@example.com",
      applicationExpire: { mode: "auto", afterDays: 1 },
      mentorship: DEFAULT_COLLAB_CONTROL_PLANE.mentorship,
      guestCollab: DEFAULT_COLLAB_CONTROL_PLANE.guestCollab,
    });
    const auto = await sweepExpiredMarketplaceApplications();
    assert.equal(auto.mode, "auto");
    assert.ok(auto.expired >= 1);

    const expired = await getMarketplaceApplication(app.id);
    assert.equal(expired?.status, "EXPIRED");
    assert.ok(expired?.events.some((event) => event.toStatus === "EXPIRED"));

    await prisma.marketplaceApplication.delete({ where: { id: app.id } }).catch(() => undefined);
    await prisma.marketplaceBusinessRequest.delete({ where: { id: request.id } }).catch(() => undefined);

    await saveCollabControlPlane({
      actor: "w23c-test@example.com",
      applicationExpire: { mode: "manual", afterDays: 14 },
      mentorship: DEFAULT_COLLAB_CONTROL_PLANE.mentorship,
      guestCollab: DEFAULT_COLLAB_CONTROL_PLANE.guestCollab,
    });
  });
});
