/**
 * R7 — loops that matter (thin suite).
 * Pure checks always run. DB-backed checks run when DATABASE_URL is set (CI).
 * Deeper ledger / FX / claim DTO coverage stays in their dedicated test files.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { decideGuestGate } from "./account-policy";
import { publicClaimPayload, type ClaimDraft } from "./claim";
import { persistPublishedClaim } from "./claim-persist";
import { prisma } from "./db";
import {
  getDirectoryCreator,
  invalidateDirectoryCache,
  searchDirectory,
} from "./directory";
import { marketplaceDisposition } from "./ledger";
import { filterCreators, SEED_CREATORS } from "./seed-data";
import { webhookDisposition } from "./webhook-idempotency";

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

function sampleDraft(overrides: Partial<ClaimDraft> = {}): ClaimDraft {
  const slug = overrides.slug ?? `loop-${Date.now().toString(36)}`;
  return {
    id: overrides.id ?? `draft_${slug}`,
    slug,
    stage: "verified",
    inputHandle: "@loop",
    platform: "INSTAGRAM",
    displayName: "Loop Creator",
    title: "Tester",
    bio: "Loop suite published claim",
    locationCity: "Austin",
    locationCountry: "USA",
    specialties: ["woodworking"],
    socials: [
      {
        platform: "INSTAGRAM",
        handle: "@loop",
        url: "https://instagram.com/loop",
        followers: 100,
      },
    ],
    image: "/brand/avatars/generic.png",
    coverImage: "/brand/banners/rooftop-crew.png",
    gender: "unspecified",
    email: "loop@example.com",
    ownerName: "Loop Owner",
    verifyCode: "654321",
    verificationDelivery: "demo",
    attribution: "ORGANIC_SIGNUP",
    planTier: "STARTER",
    createdAt: "2026-10-03T00:00:00.000Z",
    updatedAt: "2026-10-03T00:00:00.000Z",
    verifiedAt: "2026-10-03T00:00:00.000Z",
    ...overrides,
  };
}

describe("R7 loops — always on", () => {
  it("Discover filters the directory set (seed shape) without inventing a second catalog", () => {
    const found = filterCreators(SEED_CREATORS, { specialty: "beauty" });
    assert.ok(found.length > 0);
    assert.ok(found.every((c) => c.specialties.includes("beauty")));
  });

  it("claim → public payload never leaks email or verify codes", () => {
    const payload = publicClaimPayload(sampleDraft({ stage: "published" }));
    assert.equal("email" in payload, false);
    assert.equal("verifyCode" in payload, false);
    assert.equal("ownerName" in payload, false);
    assert.equal(payload.displayName, "Loop Creator");
  });

  it("guest soft vs hard gate", () => {
    const limits = { soft: 3, hard: 5 };
    assert.equal(decideGuestGate(2, limits, false), "allow");
    assert.equal(decideGuestGate(3, limits, false), "soft");
    assert.equal(decideGuestGate(5, limits, false), "hard");
    assert.equal(decideGuestGate(9, limits, true), "allow");
  });

  it("Stripe-shaped webhook disposition skips duplicates", () => {
    assert.equal(
      webhookDisposition({ duplicate: true, eventType: "checkout.session.completed" }),
      "skip",
    );
    assert.equal(
      webhookDisposition({ duplicate: false, eventType: "checkout.session.completed" }),
      "apply",
    );
  });

  it("marketplace hold → release disposition requires ready funding and milestone", () => {
    assert.equal(
      marketplaceDisposition({
        eventType: "funding.held",
        fundingStatus: "awaiting_provider",
        amountCents: 5_000,
        expectedCents: 5_000,
        heldCents: 0,
      }),
      "apply",
    );
    assert.equal(
      marketplaceDisposition({
        eventType: "payout.released",
        fundingStatus: "held",
        amountCents: 1_700,
        expectedCents: 1_700,
        heldCents: 1_700,
        milestoneStatus: "approved",
      }),
      "apply",
    );
    assert.equal(
      marketplaceDisposition({
        eventType: "payout.released",
        fundingStatus: "held",
        amountCents: 1_700,
        expectedCents: 1_700,
        heldCents: 1_700,
        milestoneStatus: "pending",
      }),
      "reject",
    );
  });
});

describe("R7 loops — Postgres", () => {
  it("directory creators are searchable after boot", async (t) => {
    if (!(await requireDb(t))) return;
    const { loadMeiliConfig } = await import("./search-settings");
    if (!(await loadMeiliConfig())) {
      await assert.rejects(() => searchDirectory({ specialty: "beauty" }), /Meilisearch/);
      return;
    }
    const beauty = await searchDirectory({ specialty: "beauty" });
    assert.ok(Array.isArray(beauty));
    if (beauty.length === 0) return;
    const sample = beauty[0]!;
    const bySlug = await getDirectoryCreator(sample.slug);
    assert.equal(bySlug?.slug, sample.slug);
  });

  it("published claim appears in the directory after persist", async (t) => {
    if (!(await requireDb(t))) return;
    const email = `loop-${Date.now().toString(36)}@example.com`;
    const draft = sampleDraft({
      stage: "published",
      publishedAt: "2026-10-03T00:00:00.000Z",
      slug: `loop-pub-${Date.now().toString(36)}`,
      email,
    });
    draft.id = `draft_${draft.slug}`;
    let creatorId: string | undefined;
    let qrToken: string | undefined;
    try {
      const published = await persistPublishedClaim(draft);
      creatorId = published.creatorId;
      qrToken = published.qrToken;
      invalidateDirectoryCache();
      const found = await getDirectoryCreator(draft.slug);
      assert.ok(found, "published claim missing from directory");
      assert.equal(found.displayName, draft.displayName);
      assert.ok(found.specialties.includes("woodworking"));
    } finally {
      if (qrToken) {
        await prisma.qrRedirect.deleteMany({ where: { token: qrToken } }).catch(() => undefined);
      }
      if (creatorId) {
        await prisma.auditLog
          .deleteMany({ where: { action: "claim.publish", objectId: creatorId } })
          .catch(() => undefined);
      }
      await prisma.influenceCard.deleteMany({ where: { slug: draft.slug } }).catch(() => undefined);
      await prisma.socialAccount.deleteMany({ where: { creator: { slug: draft.slug } } }).catch(() => undefined);
      await prisma.creatorSpecialty.deleteMany({ where: { creator: { slug: draft.slug } } }).catch(() => undefined);
      await prisma.profileClaim.deleteMany({ where: { sessionId: draft.id } }).catch(() => undefined);
      await prisma.onboardingSession.deleteMany({ where: { id: draft.id } }).catch(() => undefined);
      await prisma.creator.deleteMany({ where: { slug: draft.slug } }).catch(() => undefined);
      await prisma.user.deleteMany({ where: { email } }).catch(() => undefined);
      invalidateDirectoryCache();
    }
  });
});
