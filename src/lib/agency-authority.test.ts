/**
 * Request-level agency authorization.
 * Pure rules live in agency-context.test.ts. These checks use the seat lookup and campaign writer.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { agencyWorkspaceIdForOwner, createAgencyCampaign, setCampaignStatus } from "./agency";
import { authorizeAgencyWorkspaceAction, type AgencyMembershipRecord } from "./agency-context";
import { resolveAgencySeatForWorkspace } from "./agency-seats";
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

function membershipOf(seat: {
  workspaceId: string;
  role: string;
  inviteStatus: string;
  active: boolean;
  acceptedUserId: string | null;
  email: string;
}): AgencyMembershipRecord {
  return {
    workspaceId: seat.workspaceId,
    role: seat.role,
    inviteStatus: seat.inviteStatus,
    active: seat.active,
    acceptedUserId: seat.acceptedUserId,
    email: seat.email,
  };
}

describe("agency workspace authority", () => {
  it("does not let a posted workspace grant a seat, and a new campaign stays unsigned and unfunded", async (t) => {
    if (!(await requireDb(t))) return;
    const stamp = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    const workspaceA = `ws_a_${stamp}`.slice(0, 64);
    const workspaceB = `ws_b_${stamp}`.slice(0, 64);
    const managerEmail = `agency-manager-${stamp}@example.com`;
    const memberEmail = `agency-member-${stamp}@example.com`;
    const talentEmail = `agency-talent-${stamp}@example.com`;
    setProductSwitchForTests("agency_seats", true);
    let managerId = "";
    let memberId = "";
    let talentId = "";
    try {
      const [manager, member, talent] = await Promise.all([
        prisma.user.create({
          data: { email: managerEmail, name: "Agency Manager", role: "AGENCY", emailVerifiedAt: new Date() },
        }),
        prisma.user.create({
          data: { email: memberEmail, name: "Agency Member", role: "AGENCY", emailVerifiedAt: new Date() },
        }),
        prisma.user.create({
          data: { email: talentEmail, name: "Roster Talent", role: "CREATOR", emailVerifiedAt: new Date() },
        }),
      ]);
      managerId = manager.id;
      memberId = member.id;
      talentId = talent.id;
      await prisma.agencyWorkspace.createMany({
        data: [
          { id: workspaceA, name: "Workspace A", plan: "AGENCY" },
          { id: workspaceB, name: "Workspace B", plan: "AGENCY" },
        ],
      });
      const [clientA, clientB] = await Promise.all([
        prisma.agencyClient.create({
          data: { id: `client_a_${stamp}`.slice(0, 64), workspaceId: workspaceA, name: "Client A" },
        }),
        prisma.agencyClient.create({
          data: { id: `client_b_${stamp}`.slice(0, 64), workspaceId: workspaceB, name: "Client B" },
        }),
      ]);
      await prisma.agencySeat.createMany({
        data: [
          {
            workspaceId: workspaceA,
            email: managerEmail,
            role: "manager",
            active: true,
            inviteStatus: "accepted",
            acceptedAt: new Date(),
            acceptedUserId: manager.id,
          },
          {
            workspaceId: workspaceA,
            email: memberEmail,
            role: "member",
            active: true,
            inviteStatus: "accepted",
            acceptedAt: new Date(),
            acceptedUserId: member.id,
          },
          {
            workspaceId: workspaceA,
            email: talentEmail,
            role: "talent",
            active: true,
            inviteStatus: "accepted",
            acceptedAt: new Date(),
            acceptedUserId: talent.id,
          },
        ],
      });

      const managerOnB = await resolveAgencySeatForWorkspace({
        userId: manager.id,
        email: managerEmail,
        workspaceId: workspaceB,
      });
      assert.equal(managerOnB, null);
      const foreign = authorizeAgencyWorkspaceAction({
        action: "manage_campaign",
        sealed: { workspaceId: workspaceB, clientId: clientB.id },
        posted: { workspaceId: workspaceB, clientId: clientB.id },
        seatsEnabled: true,
        actor: { userId: manager.id, email: managerEmail },
        ownerWorkspaceId: agencyWorkspaceIdForOwner(manager.id),
        memberships: [],
        client: clientB,
      });
      assert.equal(foreign.ok, false);
      assert.equal(await prisma.agencyCampaign.count({ where: { workspaceId: workspaceB } }), 0);

      const memberSeat = await resolveAgencySeatForWorkspace({
        userId: member.id,
        email: memberEmail,
        workspaceId: workspaceA,
      });
      assert.ok(memberSeat);
      const memberDecision = authorizeAgencyWorkspaceAction({
        action: "manage_campaign",
        sealed: { workspaceId: workspaceA, clientId: clientA.id },
        posted: { workspaceId: workspaceA, clientId: clientA.id },
        seatsEnabled: true,
        actor: { userId: member.id, email: memberEmail },
        ownerWorkspaceId: agencyWorkspaceIdForOwner(member.id),
        memberships: [membershipOf(memberSeat!)],
        client: clientA,
      });
      assert.equal(memberDecision.ok, false);

      const talentSeat = await resolveAgencySeatForWorkspace({
        userId: talent.id,
        email: talentEmail,
        workspaceId: workspaceA,
      });
      assert.ok(talentSeat);
      assert.equal(talentSeat?.role, "talent");
      for (const action of ["act_for_client", "manage_campaign"] as const) {
        const talentDecision = authorizeAgencyWorkspaceAction({
          action,
          sealed: { workspaceId: workspaceA, clientId: clientA.id },
          posted: { workspaceId: workspaceA, clientId: clientA.id },
          seatsEnabled: true,
          actor: { userId: talent.id, email: talentEmail },
          ownerWorkspaceId: agencyWorkspaceIdForOwner(talent.id),
          memberships: [membershipOf(talentSeat!)],
          client: clientA,
        });
        assert.equal(talentDecision.ok, false);
      }

      const managerSeat = await resolveAgencySeatForWorkspace({
        userId: manager.id,
        email: managerEmail,
        workspaceId: workspaceA,
      });
      assert.equal(managerSeat?.role, "manager");
      const allowed = authorizeAgencyWorkspaceAction({
        action: "manage_campaign",
        sealed: { workspaceId: workspaceA, clientId: clientA.id },
        posted: { workspaceId: workspaceA, clientId: clientA.id },
        seatsEnabled: true,
        actor: { userId: manager.id, email: managerEmail },
        ownerWorkspaceId: agencyWorkspaceIdForOwner(manager.id),
        memberships: [membershipOf(managerSeat!)],
        client: clientA,
      });
      assert.equal(allowed.ok, true);

      const created = await createAgencyCampaign({
        workspaceId: workspaceA,
        clientId: clientA.id,
        clientName: "",
        title: `Unsigned ${stamp}`,
        specialty: "Launch",
        budgetLabel: "1000 USD",
        summary: "Container only",
        creatorSlugs: ["ada", "ben"],
      });
      assert.equal(created.status, "briefing");
      const links = await prisma.agencyCampaignLink.findMany({ where: { campaignId: created.id } });
      assert.equal(links.length, 2);
      for (const link of links) {
        assert.equal(link.collaborationId, null);
        assert.equal(link.contractDocumentId, null);
        assert.equal(link.fundingId, null);
        assert.equal(link.workspaceId, workspaceA);
      }
      const moved = await setCampaignStatus(created.id, "casting", workspaceA);
      assert.equal(moved.status, "casting");
      const afterStatus = await prisma.agencyCampaignLink.findMany({ where: { campaignId: created.id } });
      for (const link of afterStatus) {
        assert.equal(link.collaborationId, null);
        assert.equal(link.contractDocumentId, null);
        assert.equal(link.fundingId, null);
      }

      await assert.rejects(
        () =>
          createAgencyCampaign({
            workspaceId: workspaceA,
            clientId: clientB.id,
            clientName: "",
            title: `Foreign client ${stamp}`,
            specialty: "Launch",
            budgetLabel: "1000 USD",
            summary: "Must not persist",
            creatorSlugs: ["ada"],
          }),
        /not in this workspace/,
      );
      assert.equal(
        await prisma.agencyCampaign.count({ where: { workspaceId: workspaceA, title: `Foreign client ${stamp}` } }),
        0,
      );

      await prisma.agencySeat.updateMany({
        where: { workspaceId: workspaceA, email: managerEmail },
        data: { inviteStatus: "revoked", active: false },
      });
      const revoked = await resolveAgencySeatForWorkspace({
        userId: manager.id,
        email: managerEmail,
        workspaceId: workspaceA,
      });
      assert.equal(revoked, null);
      const stale = authorizeAgencyWorkspaceAction({
        action: "manage_campaign",
        sealed: { workspaceId: workspaceA, clientId: clientA.id },
        posted: { workspaceId: workspaceA, clientId: clientA.id },
        seatsEnabled: true,
        actor: { userId: manager.id, email: managerEmail },
        memberships: [],
        ownerWorkspaceId: agencyWorkspaceIdForOwner(manager.id),
        client: clientA,
      });
      assert.equal(stale.ok, false);
    } finally {
      setProductSwitchForTests("agency_seats", null);
      await prisma.agencyWorkspace.deleteMany({ where: { id: { in: [workspaceA, workspaceB] } } }).catch(() => undefined);
      const userIds = [managerId, memberId, talentId].filter(Boolean);
      if (userIds.length > 0) {
        await prisma.user.deleteMany({ where: { id: { in: userIds } } }).catch(() => undefined);
      }
    }
  });
});
