import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  accountPurposeCatalog,
  DEFAULT_COLLAB_CONTROL_PLANE,
  evaluateDualApproval,
  mentorshipEligibilityOk,
  requiresDualApproval,
} from "./collab-control-plane";
import { prisma } from "./db";

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

describe("dual approval thresholds", () => {
  it("requires dual approval at or above threshold", () => {
    assert.equal(requiresDualApproval(499_99, 500_00), false);
    assert.equal(requiresDualApproval(500_00, 500_00), true);
    assert.equal(requiresDualApproval(1, 0), false);
  });

  it("blocks same-actor second approval", () => {
    const blocked = evaluateDualApproval({
      amountCents: 1_000_00,
      thresholdCents: 500_00,
      primaryActor: "ops@example.com",
      secondaryActor: "ops@example.com",
    });
    assert.equal(blocked.ok, false);

    const missing = evaluateDualApproval({
      amountCents: 1_000_00,
      thresholdCents: 500_00,
      primaryActor: "ops@example.com",
    });
    assert.equal(missing.ok, false);

    const ok = evaluateDualApproval({
      amountCents: 1_000_00,
      thresholdCents: 500_00,
      primaryActor: "ops@example.com",
      secondaryActor: "lead@example.com",
    });
    assert.equal(ok.ok, true);
  });
});

describe("mentorship eligibility", () => {
  it("applies admin rules", () => {
    const settings = DEFAULT_COLLAB_CONTROL_PLANE.mentorship;
    const fail = mentorshipEligibilityOk({
      settings,
      followers: 10,
      identityVerified: false,
      globalPayoutReady: false,
    });
    assert.equal(fail.ok, false);
    if (!fail.ok) assert.ok(fail.blockers.length >= 2);

    const pass = mentorshipEligibilityOk({
      settings,
      followers: 5_000,
      identityVerified: true,
      globalPayoutReady: false,
    });
    assert.equal(pass.ok, true);
  });
});

describe("account purpose catalog", () => {
  it("lists the five logical domains", () => {
    const rows = accountPurposeCatalog();
    assert.equal(rows.length, 5);
    assert.ok(rows.some((row) => row.purpose === "OPERATIONS"));
    assert.ok(rows.some((row) => row.purpose === "COLLABORATION_HOLDING"));
  });
});

describe("collab control plane persistence (db)", () => {
  it("versions settings and suspends corridors with audit", async (t) => {
    if (!(await requireDb(t))) return;
    const {
      getCollabControlPlane,
      saveCollabControlPlane,
      setCorridorActive,
      listCorridorsForAdmin,
      COLLAB_CONTROL_PLANE_KEY,
    } = await import("./collab-control-plane");

    const before = await getCollabControlPlane();
    const saved = await saveCollabControlPlane({
      actor: "p6-test@example.com",
      dualApprovalThresholdCents: 750_00,
      mentorship: { ...before.mentorship, minFollowers: 2_500 },
    });
    assert.equal(saved.version, before.version + 1);
    assert.equal(saved.dualApprovalThresholdCents, 750_00);
    assert.equal(saved.mentorship.minFollowers, 2_500);

    const corridors = await listCorridorsForAdmin();
    assert.ok(corridors.length >= 8);
    const target = corridors.find((row) => row.countryCode === "KE") ?? corridors[0];
    const suspended = await setCorridorActive({
      countryCode: target.countryCode,
      active: false,
      actor: "p6-test@example.com",
    });
    assert.equal(suspended.active, false);
    const restored = await setCorridorActive({
      countryCode: target.countryCode,
      active: true,
      actor: "p6-test@example.com",
    });
    assert.equal(restored.active, true);

    const audits = await prisma.auditLog.findMany({
      where: {
        OR: [
          { action: "collab.control_plane.save", objectId: COLLAB_CONTROL_PLANE_KEY },
          { action: "corridor.suspend", objectId: target.countryCode },
        ],
      },
      orderBy: { createdAt: "desc" },
      take: 5,
    });
    assert.ok(audits.length >= 2);

    // Restore default-ish threshold so later suites are not surprised.
    await saveCollabControlPlane({
      actor: "p6-test@example.com",
      dualApprovalThresholdCents: DEFAULT_COLLAB_CONTROL_PLANE.dualApprovalThresholdCents,
      mentorship: DEFAULT_COLLAB_CONTROL_PLANE.mentorship,
    });
  });
});
