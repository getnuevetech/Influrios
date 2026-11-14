import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import {
  agencyActionAllowed,
  agencySeatChoiceRole,
  authorizeAgencyWorkspaceAction,
  campaignBoundToSealedClient,
  campaignStatusTransition,
  clientBelongsToWorkspace,
  inviteRoleAllowed,
  isolatedCreatorLinks,
  membershipForWorkspace,
  postedContextMatches,
  readAgencyActionContext,
  sealAgencyActionContext,
  summarizeCampaignRecords,
  type AgencyMembershipRecord,
} from "./agency-context";

const secret = "agency-context-test-secret";

function seat(overrides: Partial<AgencyMembershipRecord> & Pick<AgencyMembershipRecord, "workspaceId">): AgencyMembershipRecord {
  return {
    role: "manager",
    inviteStatus: "accepted",
    active: true,
    acceptedUserId: "user-1",
    email: "ops@agency.demo",
    acceptedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("agency workspace binding", () => {
  const seats = [
    seat({ workspaceId: "workspace-a", acceptedAt: "2026-01-01T00:00:00.000Z", role: "manager" }),
    seat({
      workspaceId: "workspace-b",
      acceptedAt: "2026-11-01T00:00:00.000Z",
      role: "owner",
    }),
  ];
  const actor = { userId: "user-1", email: "ops@agency.demo" };

  it("keeps an older workspace when a newer membership exists", () => {
    const selected = membershipForWorkspace(seats, { ...actor, workspaceId: "workspace-a" });
    assert.equal(selected?.workspaceId, "workspace-a");
    assert.equal(selected?.role, "manager");
  });

  it("does not choose the latest accepted membership when the form has no workspace", () => {
    assert.equal(membershipForWorkspace(seats, { ...actor, workspaceId: "" }), null);
    assert.equal(membershipForWorkspace(seats, { ...actor, workspaceId: "   " }), null);
  });

  it("denies a revoked membership instead of using another seat", () => {
    const revoked = [
      seat({ workspaceId: "workspace-a", inviteStatus: "revoked", active: false }),
      seat({ workspaceId: "workspace-b", acceptedAt: "2026-11-01T00:00:00.000Z" }),
    ];
    assert.equal(membershipForWorkspace(revoked, { ...actor, workspaceId: "workspace-a" }), null);
  });

  it("does not let a client-supplied workspace id expand access", () => {
    assert.equal(membershipForWorkspace(seats, { ...actor, workspaceId: "workspace-c" }), null);
    const otherUser = seat({
      workspaceId: "workspace-a",
      acceptedUserId: "someone-else",
      email: "ops@agency.demo",
    });
    assert.equal(membershipForWorkspace([otherUser], { ...actor, workspaceId: "workspace-a" }), null);
  });

  it("binds a legacy seat by verified email only when no user id was stored", () => {
    const legacy = seat({ workspaceId: "workspace-a", acceptedUserId: null, email: "ops@agency.demo" });
    assert.equal(membershipForWorkspace([legacy], { ...actor, workspaceId: "workspace-a" })?.workspaceId, "workspace-a");
    assert.equal(
      membershipForWorkspace([legacy], { userId: "user-1", email: "other@agency.demo", workspaceId: "workspace-a" }),
      null,
    );
  });

  it("seals the rendered workspace and client so a swapped id is rejected", () => {
    const token = sealAgencyActionContext(
      { userId: "user-1", workspaceId: "workspace-a", clientId: "client-a" },
      secret,
    );
    const sealed = readAgencyActionContext(token, "user-1", secret);
    assert.deepEqual(sealed, { workspaceId: "workspace-a", clientId: "client-a" });
    assert.equal(
      postedContextMatches(sealed!, { workspaceId: "workspace-b", clientId: "client-a" }),
      false,
    );
    assert.equal(readAgencyActionContext(token, "user-2", secret), null);
    assert.equal(readAgencyActionContext(`${token}tampered`, "user-1", secret), null);
  });
});

describe("agency permissions", () => {
  it("follows the selected membership and withholds contracting authority from roster talent", () => {
    assert.equal(agencyActionAllowed("owner", "manage_team"), true);
    assert.equal(agencyActionAllowed("owner", "manage_settings"), true);
    assert.equal(agencyActionAllowed("manager", "manage_campaign"), true);
    assert.equal(agencyActionAllowed("manager", "manage_team"), false);
    assert.equal(agencyActionAllowed("manager", "manage_settings"), false);
    assert.equal(agencyActionAllowed("member", "view"), true);
    assert.equal(agencyActionAllowed("member", "manage_campaign"), false);
    assert.equal(agencyActionAllowed("member", "manage_roster"), false);
    assert.equal(agencyActionAllowed("member", "set_campaign_status"), false);
    assert.equal(agencyActionAllowed("talent", "view"), false);
    assert.equal(agencyActionAllowed("talent", "act_for_client"), false);
    assert.equal(inviteRoleAllowed("owner", "manager"), true);
    assert.equal(inviteRoleAllowed("manager", "member"), false);
    assert.equal(inviteRoleAllowed("owner", "talent"), false);
  });

  it("does not turn roster talent into a company seat", () => {
    assert.equal(agencySeatChoiceRole("talent"), null);
    assert.equal(agencySeatChoiceRole("lead"), null);
    assert.equal(agencySeatChoiceRole("member"), "member");
    assert.equal(agencySeatChoiceRole("manager"), "manager");
    assert.equal(agencySeatChoiceRole("owner"), "owner");
  });

  it("rejects a client-supplied workspace the account does not hold", () => {
    const memberships = [
      seat({ workspaceId: "workspace-a", role: "manager" }),
      seat({ workspaceId: "workspace-b", role: "owner", acceptedAt: "2026-11-01T00:00:00.000Z" }),
    ];
    const actor = { userId: "user-1", email: "ops@agency.demo" };
    const denied = authorizeAgencyWorkspaceAction({
      action: "manage_campaign",
      sealed: { workspaceId: "workspace-c", clientId: "" },
      posted: { workspaceId: "workspace-c", clientId: "" },
      seatsEnabled: true,
      actor,
      ownerWorkspaceId: "agency_owner_user-1",
      memberships,
      client: null,
    });
    assert.equal(denied.ok, false);
    const swapped = authorizeAgencyWorkspaceAction({
      action: "manage_campaign",
      sealed: { workspaceId: "workspace-a", clientId: "client-a" },
      posted: { workspaceId: "workspace-b", clientId: "client-a" },
      seatsEnabled: true,
      actor,
      ownerWorkspaceId: "agency_owner_user-1",
      memberships,
      client: { id: "client-a", workspaceId: "workspace-a" },
    });
    assert.equal(swapped.ok, false);
    if (!swapped.ok) assert.match(swapped.error, /workspace and client/);
  });

  it("enforces owner, manager, and member on the server and withholds talent authority", () => {
    const actor = { userId: "user-1", email: "ops@agency.demo" };
    const base = {
      sealed: { workspaceId: "workspace-a", clientId: "client-a" },
      posted: { workspaceId: "workspace-a", clientId: "client-a" },
      seatsEnabled: true,
      actor,
      ownerWorkspaceId: "agency_owner_user-1",
      client: { id: "client-a", workspaceId: "workspace-a" },
    };
    const owner = authorizeAgencyWorkspaceAction({
      ...base,
      action: "manage_team",
      memberships: [seat({ workspaceId: "workspace-a", role: "owner" })],
    });
    assert.equal(owner.ok, true);
    const manager = authorizeAgencyWorkspaceAction({
      ...base,
      action: "manage_campaign",
      memberships: [seat({ workspaceId: "workspace-a", role: "manager" })],
    });
    assert.equal(manager.ok, true);
    const managerTeam = authorizeAgencyWorkspaceAction({
      ...base,
      action: "manage_team",
      memberships: [seat({ workspaceId: "workspace-a", role: "manager" })],
    });
    assert.equal(managerTeam.ok, false);
    const member = authorizeAgencyWorkspaceAction({
      ...base,
      action: "manage_campaign",
      memberships: [seat({ workspaceId: "workspace-a", role: "member" })],
    });
    assert.equal(member.ok, false);
    const talent = authorizeAgencyWorkspaceAction({
      ...base,
      action: "act_for_client",
      memberships: [seat({ workspaceId: "workspace-a", role: "talent" })],
    });
    assert.equal(talent.ok, false);
    const talentPay = authorizeAgencyWorkspaceAction({
      ...base,
      action: "manage_campaign",
      memberships: [seat({ workspaceId: "workspace-a", role: "talent" })],
    });
    assert.equal(talentPay.ok, false);
  });

  it("rejects a client or campaign that is not the one the form was opened for", () => {
    const actor = { userId: "user-1", email: "ops@agency.demo" };
    const foreignClient = authorizeAgencyWorkspaceAction({
      action: "act_for_client",
      sealed: { workspaceId: "workspace-a", clientId: "client-b" },
      posted: { workspaceId: "workspace-a", clientId: "client-b" },
      seatsEnabled: true,
      actor,
      ownerWorkspaceId: "agency_owner_user-1",
      memberships: [seat({ workspaceId: "workspace-a", role: "manager" })],
      client: { id: "client-b", workspaceId: "workspace-b" },
    });
    assert.equal(foreignClient.ok, false);
    assert.equal(
      campaignBoundToSealedClient(
        { workspaceId: "workspace-a", clientId: "client-a" },
        { workspaceId: "workspace-a", clientId: "client-b" },
      ).ok,
      false,
    );
    assert.equal(
      campaignBoundToSealedClient(
        { workspaceId: "workspace-a", clientId: "" },
        { workspaceId: "workspace-a", clientId: "client-a" },
      ).ok,
      false,
    );
    assert.equal(
      campaignBoundToSealedClient(
        { workspaceId: "workspace-a", clientId: "client-a" },
        { workspaceId: "workspace-b", clientId: "client-a" },
      ).ok,
      false,
    );
    assert.equal(
      campaignBoundToSealedClient(
        { workspaceId: "workspace-a", clientId: "client-a" },
        { workspaceId: "workspace-a", clientId: "client-a" },
      ).ok,
      true,
    );
  });

  it("rejects a client that is not in the selected workspace", () => {
    assert.equal(clientBelongsToWorkspace({ id: "client-b", workspaceId: "workspace-b" }, "workspace-a"), false);
    assert.equal(clientBelongsToWorkspace({ id: "client-a", workspaceId: "workspace-a" }, "workspace-a"), true);
    assert.equal(clientBelongsToWorkspace(null, "workspace-a"), false);
  });
});

describe("agency campaign records", () => {
  it("rejects invalid statuses and skips ahead", () => {
    assert.equal(campaignStatusTransition("briefing", "casting").ok, true);
    assert.equal(campaignStatusTransition("briefing", "live").ok, false);
    assert.equal(campaignStatusTransition("briefing", "signed").ok, false);
    assert.equal(campaignStatusTransition("live", "not-a-status").ok, false);
  });

  it("creates one empty agreement slot per influencer and does not mark money moved", () => {
    const links = isolatedCreatorLinks(["ada", "ada", " ", "ben"]);
    assert.deepEqual(
      links.map((link) => link.creatorSlug),
      ["ada", "ben"],
    );
    assert.deepEqual(
      links.map((link) => [link.collaborationId, link.contractDocumentId, link.fundingId]),
      [
        [null, null, null],
        [null, null, null],
      ],
    );
    assert.deepEqual(summarizeCampaignRecords([]), { contract: "—", payment: "—" });
    assert.deepEqual(
      summarizeCampaignRecords([{ contractStatus: null, payoutState: null, milestoneStatus: null }]),
      { contract: "—", payment: "—" },
    );
  });

  it("derives contract and payment labels from linked records", () => {
    assert.deepEqual(
      summarizeCampaignRecords([
        { contractStatus: "signed", payoutState: "paid", milestoneStatus: "released" },
        { contractStatus: "signed", payoutState: "pending", milestoneStatus: "approved" },
      ]),
      { contract: "Signed", payment: "Partially paid" },
    );
    assert.deepEqual(
      summarizeCampaignRecords([{ contractStatus: "draft", payoutState: null, milestoneStatus: null }]),
      { contract: "Draft", payment: "—" },
    );
    assert.deepEqual(
      summarizeCampaignRecords([{ contractStatus: "sent", payoutState: "in_transit", milestoneStatus: null }]),
      { contract: "In review", payment: "Pending" },
    );
    assert.deepEqual(
      summarizeCampaignRecords([{ contractStatus: "signed", payoutState: "paid", milestoneStatus: null }]),
      { contract: "Signed", payment: "Paid" },
    );
  });

  it("does not resolve a workspace from the newest accepted seat", () => {
    const seats = readFileSync("src/lib/agency-seats.ts", "utf8");
    const actions = readFileSync("src/app/agency/actions.ts", "utf8");
    const campaign = readFileSync("src/lib/agency.ts", "utf8");
    assert.equal(seats.includes('orderBy: { acceptedAt: "desc" }'), false);
    assert.equal(actions.includes("resolveAgencySeatForEmail"), false);
    assert.equal(actions.includes("requireWorkspaceId"), false);
    const createStart = campaign.indexOf("export async function createAgencyCampaign");
    const createEnd = campaign.indexOf("export async function setCampaignStatus");
    const createBody = campaign.slice(createStart, createEnd);
    assert.equal(createBody.includes("collaboration.create"), false);
    assert.equal(createBody.includes("collaborationFunding.create"), false);
    assert.equal(createBody.includes("ledgerEntry.create"), false);
    assert.equal(createBody.includes("agencyCampaignLink.createMany"), true);
    const linkStart = campaign.indexOf("export async function linkAgencyCampaignCollaboration");
    const linkEnd = campaign.indexOf("export async function loadAgencyCampaignFacts");
    const linkBody = campaign.slice(linkStart, linkEnd);
    assert.equal(linkBody.includes("collaboration.create"), false);
    assert.equal(linkBody.includes("collaborationFunding.create"), false);
    assert.equal(linkBody.includes("findUnique"), true);
  });
});
