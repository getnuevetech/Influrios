import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  EXPERIENCE_BAND_LABELS,
  experienceBandFromFollowers,
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
