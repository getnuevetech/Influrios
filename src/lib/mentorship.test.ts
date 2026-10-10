import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { airwallexMentorshipIntentBody } from "./providers/airwallex";
import { stripeOneTimeCheckoutBody, stripePayoutRouteReady } from "./stripe-admin";
import {
  EXPERIENCE_BAND_LABELS,
  experienceBandFromFollowers,
  MENTORSHIP_SESSION_CENTS,
  mentorProfileFields,
  mentorshipFundsIsolated,
  totalFollowersFromSocials,
} from "./mentorship";
import { prisma } from "./db";
import { setProductSwitchForTests } from "./product-switches";

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

describe("experience bands", () => {
  it("labels emerging vs experienced influencers", () => {
    assert.equal(experienceBandFromFollowers(500), "emerging");
    assert.equal(experienceBandFromFollowers(10_000), "experienced");
    assert.equal(EXPERIENCE_BAND_LABELS.emerging, "Emerging Influencer");
    assert.equal(EXPERIENCE_BAND_LABELS.experienced, "Experienced Influencer");
    assert.equal(totalFollowersFromSocials([{ followers: 100 }, { followers: 50 }]), 150);
  });
});

describe("mentor profile entered facts", () => {
  it("stores availability and the mentee cap only when they were entered", () => {
    const blank = mentorProfileFields({ availability: "", maxActiveMentees: "" });
    assert.equal(blank.ok, false);
    if (!blank.ok) assert.equal(blank.error, "Choose availability.");

    const missingMax = mentorProfileFields({ availability: "open", maxActiveMentees: "" });
    assert.equal(missingMax.ok, false);
    if (!missingMax.ok) assert.equal(missingMax.error, "Enter a maximum number of active mentees.");

    const zero = mentorProfileFields({ availability: "open", maxActiveMentees: 0 });
    assert.equal(zero.ok, false);
    const over = mentorProfileFields({ availability: "paused", maxActiveMentees: "21" });
    assert.equal(over.ok, false);
    const fractional = mentorProfileFields({ availability: "closed", maxActiveMentees: "1.5" });
    assert.equal(fractional.ok, false);

    const entered = mentorProfileFields({
      availability: "open",
      maxActiveMentees: 5,
      headline: "  Growth loops  ",
      boundaries: "   ",
      niches: [" beauty ", ""],
    });
    assert.equal(entered.ok, true);
    if (entered.ok) {
      assert.equal(entered.availability, "open");
      assert.equal(entered.maxActiveMentees, 5);
      assert.equal(entered.headline, "Growth loops");
      assert.equal(entered.boundaries, "");
      assert.deepEqual(entered.niches, ["beauty"]);
    }
    const fromForm = mentorProfileFields({ availability: "paused", maxActiveMentees: "3" });
    assert.equal(fromForm.ok, true);
    if (fromForm.ok) {
      assert.equal(fromForm.availability, "paused");
      assert.equal(fromForm.maxActiveMentees, 3);
    }

    const mentorship = readFileSync("src/lib/mentorship.ts", "utf8");
    const actions = readFileSync("src/app/mentorship/actions.ts", "utf8");
    const page = readFileSync("src/app/mentorship/page.tsx", "utf8");
    assert.equal(mentorship.includes(': "open";'), false);
    assert.equal(/: 5\b/.test(mentorship), false);
    for (const source of [mentorship, actions, page]) {
      assert.equal(source.includes('?? "open"'), false);
      assert.equal(source.includes("?? 5"), false);
    }
  });
});

describe("mentorship fund isolation", () => {
  it("blocks paid requests when paid mentoring switch is off", () => {
    const blocked = mentorshipFundsIsolated({ paidMentoringEnabled: false, paidRequested: true });
    assert.equal(blocked.ok, false);
  });

  it("never routes community or paid into collaboration holding from this module", () => {
    const free = mentorshipFundsIsolated({ paidMentoringEnabled: false, paidRequested: false });
    assert.equal(free.ok, true);
    if (free.ok) assert.equal(free.usesCollaborationHolding, false);

    const paid = mentorshipFundsIsolated({ paidMentoringEnabled: true, paidRequested: true });
    assert.equal(paid.ok, true);
    if (paid.ok) assert.equal(paid.usesCollaborationHolding, false);
  });
});

describe("paid mentorship checkout", () => {
  it("uses a one-time Stripe payment and an Airwallex intent with no collaboration holding", () => {
    const stripe = stripeOneTimeCheckoutBody({
      amountCents: MENTORSHIP_SESSION_CENTS,
      name: "Influrios mentorship session",
      successUrl: "https://example.com/ok",
      cancelUrl: "https://example.com/cancel",
      metadata: { purpose: "mentorship", requestId: "req-1" },
    });
    assert.equal(stripe.get("mode"), "payment");
    assert.equal(stripe.get("metadata[purpose]"), "mentorship");
    assert.equal(stripe.has("line_items[0][price_data][recurring][interval]"), false);
    const airwallex = airwallexMentorshipIntentBody({
      requestId: "req-1",
      amountCents: MENTORSHIP_SESSION_CENTS,
      currency: "USD",
    });
    assert.equal("holdingAccountId" in airwallex, false);
    assert.equal("funds_split" in airwallex, false);
    assert.equal(stripePayoutRouteReady({ providerCode: "stripe", routeReady: true, stripeConnectAccountId: null }), false);
    assert.equal(
      stripePayoutRouteReady({ providerCode: "stripe", routeReady: true, stripeConnectAccountId: "acct_ready" }),
      true,
    );
    assert.equal(stripePayoutRouteReady({ providerCode: "flutterwave", routeReady: true, stripeConnectAccountId: null }), true);
  });

  it("does not create collaboration funding when paid mentoring is on", async (t) => {
    if (!(await requireDb(t))) return;
    setProductSwitchForTests("paid_mentoring", true);
    const { setStripeTransportForTests } = await import("./stripe-admin");
    const { requestMentorship } = await import("./mentorship");
    const { saveCollabControlPlane, DEFAULT_COLLAB_CONTROL_PLANE } = await import("./collab-control-plane");
    const previousKey = process.env.STRIPE_SECRET_KEY;
    process.env.STRIPE_SECRET_KEY = "sk_test_phaseLmentorship";
    setStripeTransportForTests(async () =>
      new Response(
        JSON.stringify({
          id: "cs_test_mentorphaseL",
          url: "https://checkout.stripe.com/c/pay/cs_test_mentorphaseL",
          livemode: false,
        }),
        { status: 200 },
      ),
    );
    await saveCollabControlPlane({
      actor: "p7-test@example.com",
      mentorship: {
        ...DEFAULT_COLLAB_CONTROL_PLANE.mentorship,
        enabled: true,
        minFollowers: 0,
        requireIdentityVerified: false,
        requireGlobalPayoutReady: false,
      },
    });
    const stamp = Date.now().toString(36);
    const mentor = await prisma.creator.create({
      data: {
        slug: `mentor-paid-${stamp}`,
        displayName: "Mentor Paid",
        title: "Coach",
        bio: "Paid mentor",
        locationCountry: "USA",
        identityVerified: "VERIFIED",
        profileState: "VERIFIED",
        claimed: true,
      },
    });
    const mentee = await prisma.creator.create({
      data: {
        slug: `mentee-paid-${stamp}`,
        displayName: "Mentee Paid",
        title: "Rising",
        bio: "Paid mentee",
        locationCountry: "USA",
        profileState: "VERIFIED",
        claimed: true,
      },
    });
    const before = await prisma.collaborationFunding.count();
    try {
      await prisma.mentorshipProfile.create({
        data: { creatorId: mentor.id, eligible: true, availability: "open", nichesJson: ["beauty"] },
      });
      const paid = await requestMentorship({
        menteeCreatorId: mentee.id,
        mentorCreatorId: mentor.id,
        message: "Paid session",
        paidRequested: true,
        customerEmail: "mentee@example.com",
      });
      assert.equal(paid.ok, true);
      if (!paid.ok) return;
      assert.equal(paid.usesCollaborationHolding, false);
      assert.equal(paid.request.paymentStatus, "open");
      assert.equal(paid.request.paymentProvider, "stripe");
      assert.match(paid.checkoutUrl ?? "", /^https:\/\//);
      assert.equal(await prisma.collaborationFunding.count(), before);
      const funding = await prisma.collaborationFunding.findUnique({ where: { id: paid.request.checkoutRef ?? "" } });
      assert.equal(funding, null);
    } finally {
      await prisma.mentorshipRequest.deleteMany({
        where: { OR: [{ mentorCreatorId: mentor.id }, { menteeCreatorId: mentee.id }] },
      });
      await prisma.mentorshipProfile.deleteMany({ where: { creatorId: mentor.id } });
      await prisma.creator.delete({ where: { id: mentee.id } }).catch(() => null);
      await prisma.creator.delete({ where: { id: mentor.id } }).catch(() => null);
      setProductSwitchForTests("paid_mentoring", null);
      setStripeTransportForTests(null);
      if (previousKey === undefined) delete process.env.STRIPE_SECRET_KEY;
      else process.env.STRIPE_SECRET_KEY = previousKey;
      await saveCollabControlPlane({
        actor: "p7-test@example.com",
        mentorship: DEFAULT_COLLAB_CONTROL_PLANE.mentorship,
      });
    }
  });
});

describe("mentorship request lifecycle (db)", () => {
  it("applies mentor, requests, accepts without touching holding", async (t) => {
    if (!(await requireDb(t))) return;
    setProductSwitchForTests("paid_mentoring", false);
    const {
      upsertMentorProfile,
      requestMentorship,
      respondToMentorshipRequest,
      listOpenMentors,
    } = await import("./mentorship");
    const { saveCollabControlPlane, DEFAULT_COLLAB_CONTROL_PLANE } = await import("./collab-control-plane");

    // Loosen eligibility for the test mentor.
    await saveCollabControlPlane({
      actor: "p7-test@example.com",
      mentorship: {
        ...DEFAULT_COLLAB_CONTROL_PLANE.mentorship,
        enabled: true,
        minFollowers: 0,
        requireIdentityVerified: false,
        requireGlobalPayoutReady: false,
      },
    });

    const stamp = Date.now().toString(36);
    const mentor = await prisma.creator.create({
      data: {
        slug: `mentor-${stamp}`,
        displayName: "Mentor P7",
        title: "Coach",
        bio: "P7 mentor",
        locationCountry: "USA",
        identityVerified: "VERIFIED",
        profileState: "VERIFIED",
        claimed: true,
        socialAccounts: {
          create: [{ platform: "INSTAGRAM", handle: "@mentor", url: "https://instagram.com/mentor", followers: 50_000 }],
        },
      },
    });
    const mentee = await prisma.creator.create({
      data: {
        slug: `mentee-${stamp}`,
        displayName: "Mentee P7",
        title: "Rising",
        bio: "P7 mentee",
        locationCountry: "USA",
        identityVerified: "UNVERIFIED",
        profileState: "VERIFIED",
        claimed: true,
      },
    });

    try {
      const profile = await upsertMentorProfile({
        creatorId: mentor.id,
        headline: "Growth loops",
        niches: ["beauty"],
        availability: "open",
        maxActiveMentees: 5,
      });
      assert.equal(profile.ok, true);

      const open = await listOpenMentors({ niche: "beauty" });
      assert.ok(open.some((row) => row.creatorId === mentor.id));

      const paidBlocked = await requestMentorship({
        menteeCreatorId: mentee.id,
        mentorCreatorId: mentor.id,
        message: "Help with Reels",
        paidRequested: true,
      });
      assert.equal(paidBlocked.ok, false);

      const req = await requestMentorship({
        menteeCreatorId: mentee.id,
        mentorCreatorId: mentor.id,
        message: "Help with Reels",
      });
      assert.equal(req.ok, true);
      if (!req.ok) return;
      assert.equal(req.usesCollaborationHolding, false);

      const accepted = await respondToMentorshipRequest({
        requestId: req.request.id,
        mentorCreatorId: mentor.id,
        decision: "accepted",
      });
      assert.equal(accepted.ok, true);
    } finally {
      await prisma.mentorshipRequest.deleteMany({
        where: { OR: [{ mentorCreatorId: mentor.id }, { menteeCreatorId: mentee.id }] },
      });
      await prisma.mentorshipProfile.deleteMany({ where: { creatorId: mentor.id } });
      await prisma.creator.delete({ where: { id: mentee.id } }).catch(() => null);
      await prisma.creator.delete({ where: { id: mentor.id } }).catch(() => null);
      setProductSwitchForTests("paid_mentoring", null);
      await saveCollabControlPlane({
        actor: "p7-test@example.com",
        mentorship: DEFAULT_COLLAB_CONTROL_PLANE.mentorship,
      });
    }
  });
});
