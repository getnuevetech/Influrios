/**
 * Explicit agency workspace and client binding.
 * An action uses the membership it was opened with. It never falls through to a newer seat.
 */
import { createHmac, timingSafeEqual } from "crypto";
import { requireAuthSecret } from "@/lib/app-secret";

export const AGENCY_SEAT_ROLE_VALUES = ["owner", "manager", "member"] as const;
export type AgencySeatRoleName = (typeof AGENCY_SEAT_ROLE_VALUES)[number];

export const AGENCY_PERMISSIONS = [
  "view",
  "manage_roster",
  "manage_campaign",
  "set_campaign_status",
  "manage_portfolio",
  "manage_team",
  "manage_settings",
  "act_for_client",
] as const;
export type AgencyPermission = (typeof AGENCY_PERMISSIONS)[number];

const MANAGER_PERMISSIONS = [
  "view",
  "manage_roster",
  "manage_campaign",
  "set_campaign_status",
  "manage_portfolio",
  "act_for_client",
] as const satisfies readonly AgencyPermission[];

const PERMISSIONS: Record<AgencySeatRoleName, readonly AgencyPermission[]> = {
  owner: [...MANAGER_PERMISSIONS, "manage_team", "manage_settings"],
  manager: MANAGER_PERMISSIONS,
  member: ["view"],
};

export const CAMPAIGN_STATUSES = ["briefing", "casting", "live", "wrapped"] as const;
export type CampaignStatusName = (typeof CAMPAIGN_STATUSES)[number];

export type AgencyMembershipRecord = {
  workspaceId: string;
  role: string;
  inviteStatus: string;
  active: boolean;
  acceptedUserId: string | null;
  email: string;
  acceptedAt?: string | null;
};

export function isAgencySeatRole(role: string | null | undefined): role is AgencySeatRoleName {
  return role === "owner" || role === "manager" || role === "member";
}

/** Roster talent is not a company seat and cannot contract or move money. */
export function agencyActionAllowed(role: string | null | undefined, action: AgencyPermission): boolean {
  if (!isAgencySeatRole(role)) return false;
  return PERMISSIONS[role].includes(action);
}

export function inviteRoleAllowed(actorRole: string | null | undefined, requestedRole: string): boolean {
  if (!agencyActionAllowed(actorRole, "manage_team")) return false;
  return isAgencySeatRole(requestedRole);
}

/**
 * Bind the action to one workspace. Empty or unknown ids do not fall through to another membership,
 * including a newer accepted seat.
 */
export function membershipForWorkspace<T extends AgencyMembershipRecord>(
  memberships: readonly T[],
  input: { workspaceId: string; userId: string; email: string },
): T | null {
  const workspaceId = input.workspaceId.trim();
  if (!workspaceId) return null;
  const userId = input.userId.trim();
  const email = input.email.trim().toLowerCase();
  if (!userId || !email) return null;
  const matches = memberships.filter((row) => {
    if (row.workspaceId !== workspaceId) return false;
    if (row.inviteStatus !== "accepted" || row.active !== true) return false;
    if (row.acceptedUserId) return row.acceptedUserId === userId;
    return row.email.trim().toLowerCase() === email;
  });
  return matches.length === 1 ? matches[0] : null;
}

export function clientBelongsToWorkspace(
  client: { id: string; workspaceId: string } | null | undefined,
  workspaceId: string,
): boolean {
  if (!client) return false;
  return client.id.trim() !== "" && client.workspaceId === workspaceId;
}

/** A stored roster or unknown role is not a company seat. */
export function agencySeatChoiceRole(role: string | null | undefined): AgencySeatRoleName | null {
  return isAgencySeatRole(role) ? role : null;
}

/**
 * Server decision for one submitted agency action.
 * A posted workspace id is ignored unless it is the sealed workspace and the account holds that seat.
 */
export function authorizeAgencyWorkspaceAction(input: {
  action: AgencyPermission;
  sealed: { workspaceId: string; clientId: string } | null;
  posted: { workspaceId: string; clientId: string };
  seatsEnabled: boolean;
  actor: { userId: string; email: string };
  ownerWorkspaceId: string;
  memberships: readonly AgencyMembershipRecord[];
  client: { id: string; workspaceId: string } | null;
}):
  | { ok: true; workspaceId: string; clientId: string; role: AgencySeatRoleName }
  | { ok: false; error: string; workspaceId: string; clientId: string } {
  if (!input.sealed) {
    return {
      ok: false,
      error: "This form is no longer valid. Reopen the workspace and try again.",
      workspaceId: "",
      clientId: "",
    };
  }
  const sealed = input.sealed;
  if (!postedContextMatches(sealed, input.posted)) {
    return {
      ok: false,
      error: "This form stays on the workspace and client it was opened for.",
      workspaceId: sealed.workspaceId,
      clientId: sealed.clientId,
    };
  }
  let role: AgencySeatRoleName | null = null;
  if (input.seatsEnabled) {
    const held = membershipForWorkspace(input.memberships, {
      workspaceId: sealed.workspaceId,
      userId: input.actor.userId,
      email: input.actor.email,
    });
    if (!held || !isAgencySeatRole(held.role)) {
      return {
        ok: false,
        error: held
          ? "Your role on this workspace cannot do that."
          : "This membership cannot act on that workspace.",
        workspaceId: sealed.workspaceId,
        clientId: sealed.clientId,
      };
    }
    role = held.role;
  } else if (sealed.workspaceId === input.ownerWorkspaceId) {
    role = "owner";
  }
  if (!isAgencySeatRole(role) || !agencyActionAllowed(role, input.action)) {
    return {
      ok: false,
      error: "Your role on this workspace cannot do that.",
      workspaceId: sealed.workspaceId,
      clientId: sealed.clientId,
    };
  }
  if (sealed.clientId && !clientBelongsToWorkspace(input.client, sealed.workspaceId)) {
    return {
      ok: false,
      error: "That client is not in this workspace.",
      workspaceId: sealed.workspaceId,
      clientId: "",
    };
  }
  return { ok: true, workspaceId: sealed.workspaceId, clientId: sealed.clientId, role };
}

/** A campaign change stays on the client the form was opened for. */
export function campaignBoundToSealedClient(
  sealed: { workspaceId: string; clientId: string },
  campaign: { workspaceId: string; clientId: string | null } | null,
): { ok: true } | { ok: false; error: string } {
  if (!sealed.clientId.trim()) {
    return { ok: false, error: "Choose a client before changing this campaign." };
  }
  if (!campaign || campaign.workspaceId !== sealed.workspaceId) {
    return { ok: false, error: "That campaign is not in this workspace." };
  }
  if (campaign.clientId !== sealed.clientId) {
    return { ok: false, error: "That campaign is not for this client." };
  }
  return { ok: true };
}

export function sealAgencyActionContext(
  input: { userId: string; workspaceId: string; clientId: string },
  secret = requireAuthSecret("account"),
): string {
  const payload = JSON.stringify({
    u: input.userId,
    w: input.workspaceId,
    c: input.clientId,
  });
  const body = Buffer.from(payload).toString("base64url");
  const sig = createHmac("sha256", secret).update(body).digest("hex");
  return `${body}.${sig}`;
}

export function readAgencyActionContext(
  token: string,
  userId: string,
  secret = requireAuthSecret("account"),
): { workspaceId: string; clientId: string } | null {
  const dot = token.indexOf(".");
  if (dot <= 0) return null;
  const body = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  if (!body || !sig) return null;
  const expected = createHmac("sha256", secret).update(body).digest("hex");
  const left = Buffer.from(sig);
  const right = Buffer.from(expected);
  if (left.length !== right.length || !timingSafeEqual(left, right)) return null;
  try {
    const parsed = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as {
      u?: unknown;
      w?: unknown;
      c?: unknown;
    };
    if (parsed.u !== userId || typeof parsed.w !== "string" || !parsed.w.trim()) return null;
    if (typeof parsed.c !== "string") return null;
    return { workspaceId: parsed.w, clientId: parsed.c };
  } catch {
    return null;
  }
}

/** Posted ids must be the ones sealed when the form was rendered. */
export function postedContextMatches(
  sealed: { workspaceId: string; clientId: string },
  posted: { workspaceId: string; clientId: string },
): boolean {
  return sealed.workspaceId === posted.workspaceId && sealed.clientId === posted.clientId;
}

export function campaignStatusTransition(
  current: string,
  requested: string,
): { ok: true; status: CampaignStatusName } | { ok: false; error: string } {
  const from = CAMPAIGN_STATUSES.indexOf(current as CampaignStatusName);
  const to = CAMPAIGN_STATUSES.indexOf(requested as CampaignStatusName);
  if (to < 0) return { ok: false, error: "That campaign status is not valid." };
  if (from < 0) return { ok: false, error: "This campaign status cannot be changed." };
  if (to !== from + 1) return { ok: false, error: "Campaign status can only move to the next step." };
  return { ok: true, status: CAMPAIGN_STATUSES[to] };
}

export function nextCampaignStatus(current: string): CampaignStatusName | null {
  const from = CAMPAIGN_STATUSES.indexOf(current as CampaignStatusName);
  if (from < 0 || from >= CAMPAIGN_STATUSES.length - 1) return null;
  return CAMPAIGN_STATUSES[from + 1];
}

/** One isolated agreement slot per influencer. Nothing is signed or funded here. */
export function isolatedCreatorLinks(slugs: readonly string[]) {
  const seen = new Set<string>();
  const links: {
    creatorSlug: string;
    collaborationId: null;
    contractDocumentId: null;
    fundingId: null;
  }[] = [];
  for (const raw of slugs) {
    const creatorSlug = raw.trim();
    if (!creatorSlug || seen.has(creatorSlug)) continue;
    seen.add(creatorSlug);
    links.push({
      creatorSlug,
      collaborationId: null,
      contractDocumentId: null,
      fundingId: null,
    });
  }
  return links;
}

export type CampaignRecordFact = {
  contractStatus: string | null;
  payoutState: string | null;
  milestoneStatus: string | null;
};

function contractLabel(status: string | null): "Signed" | "In review" | "Draft" | "—" {
  if (status === "signed") return "Signed";
  if (status === "sent") return "In review";
  if (status === "draft") return "Draft";
  return "—";
}

function paymentConfirmed(fact: CampaignRecordFact): boolean {
  return fact.payoutState === "paid" || fact.milestoneStatus === "released";
}

function paymentPending(fact: CampaignRecordFact): boolean {
  if (paymentConfirmed(fact)) return false;
  return (
    fact.payoutState === "pending" ||
    fact.payoutState === "in_transit" ||
    fact.payoutState === "queued" ||
    fact.milestoneStatus === "approved" ||
    fact.milestoneStatus === "release_scheduled" ||
    fact.milestoneStatus === "release_requested"
  );
}

/** Contract and payment labels come from linked records. A campaign status is not a payout. */
export function summarizeCampaignRecords(facts: readonly CampaignRecordFact[]): {
  contract: "Signed" | "In review" | "Draft" | "—";
  payment: "Paid" | "Pending" | "Partially paid" | "—";
} {
  if (facts.length === 0) return { contract: "—", payment: "—" };
  const contracts = facts.map((fact) => contractLabel(fact.contractStatus)).filter((label) => label !== "—");
  let contract: "Signed" | "In review" | "Draft" | "—" = "—";
  if (contracts.length > 0) {
    if (contracts.every((label) => label === "Signed") && contracts.length === facts.length) contract = "Signed";
    else if (contracts.every((label) => label === "Draft")) contract = "Draft";
    else contract = "In review";
  }
  const paidCount = facts.filter(paymentConfirmed).length;
  const pendingCount = facts.filter(paymentPending).length;
  let payment: "Paid" | "Pending" | "Partially paid" | "—" = "—";
  if (paidCount === facts.length && facts.length > 0) payment = "Paid";
  else if (paidCount > 0) payment = "Partially paid";
  else if (pendingCount > 0) payment = "Pending";
  return { contract, payment };
}
