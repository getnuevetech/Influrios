import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  applicationIsStaleForExpire,
  applicationTransitionLabel,
  businessOwnsApplication,
  canTransitionApplication,
  createMarketplaceApplication,
  creatorOwnsApplication,
  isWorkspaceOwnedRequestBrand,
  MARKETPLACE_APPLICATION_STATUSES,
  nextApplicationStatuses,
  sweepExpiredMarketplaceApplications,
  transitionMarketplaceApplication,
  getMarketplaceApplication,
} from "./marketplace-listings";
import { prisma } from "./db";
import { DEFAULT_COLLAB_CONTROL_PLANE, saveCollabControlPlane } from "./collab-control-plane";

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
  it("matches workspace-owned request brands", () => {
    assert.equal(isWorkspaceOwnedRequestBrand("Luminous Beauty", "Luminous Beauty"), true);
    assert.equal(isWorkspaceOwnedRequestBrand("Luminous Beauty Co.", "Luminous Beauty"), true);
    assert.equal(isWorkspaceOwnedRequestBrand("Other Brand", "Luminous Beauty"), false);
    assert.equal(isWorkspaceOwnedRequestBrand("", "Luminous Beauty"), false);
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
