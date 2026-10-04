/**
 * L3 — Agency seat invite / accept / session auth.
 * Copy-link invites work without SMTP. All paths gated by agency_seats switch.
 */
import { randomBytes } from "crypto";
import { prisma } from "@/lib/db";
import { productSwitch } from "@/lib/product-switches";

export const AGENCY_SEAT_ROLES = ["owner", "manager", "member"] as const;
export type AgencySeatRole = (typeof AGENCY_SEAT_ROLES)[number];

export const AGENCY_INVITE_STATUSES = ["pending", "accepted", "revoked"] as const;
export type AgencyInviteStatus = (typeof AGENCY_INVITE_STATUSES)[number];

export const AGENCY_INVITE_EXPIRY_DAYS = 14;
export const AGENCY_WORKSPACE_ID = "agency_demo_1";

export function asAgencySeatRole(value: string | undefined | null): AgencySeatRole {
  if (value === "owner" || value === "manager") return value;
  return "member";
}

export function newAgencyInviteToken() {
  return randomBytes(24).toString("base64url");
}

export function agencyInvitePath(token: string) {
  return `/agency/invite/${token}`;
}

export function agencyInviteExpiry(from = new Date(), days = AGENCY_INVITE_EXPIRY_DAYS) {
  return new Date(from.getTime() + days * 86_400_000);
}

export function normalizeSeatEmail(email: string) {
  return email.trim().toLowerCase().slice(0, 160);
}

export function isValidSeatEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/** Pure gate for accept / session checks (unit-tested). */
export function agencySeatAccessGate(input: {
  seatsEnabled: boolean;
  inviteStatus: string;
  active: boolean;
  expiresAt: Date | null;
  now?: Date;
}): { ok: true } | { ok: false; error: string } {
  if (!input.seatsEnabled) {
    return { ok: false, error: "Agency seats are turned off." };
  }
  if (input.inviteStatus === "revoked") {
    return { ok: false, error: "This seat invite was revoked." };
  }
  if (input.inviteStatus === "pending") {
    const now = input.now ?? new Date();
    if (input.expiresAt && input.expiresAt.getTime() <= now.getTime()) {
      return { ok: false, error: "This seat invite has expired." };
    }
    return { ok: true };
  }
  if (input.inviteStatus !== "accepted") {
    return { ok: false, error: "This seat invite is not valid." };
  }
  if (!input.active) {
    return { ok: false, error: "This agency seat is inactive." };
  }
  return { ok: true };
}

export function canUseAgencySeatSession(input: {
  seatsEnabled: boolean;
  inviteStatus: string;
  active: boolean;
}): boolean {
  return (
    input.seatsEnabled &&
    input.inviteStatus === "accepted" &&
    input.active
  );
}

export async function inviteAgencySeat(input: {
  email: string;
  role?: string;
  workspaceId?: string;
}) {
  if (!(await productSwitch("agency_seats"))) {
    throw new Error("Agency seats are turned off.");
  }
  const email = normalizeSeatEmail(input.email);
  if (!isValidSeatEmail(email)) throw new Error("Enter a seat email.");
  const role = asAgencySeatRole(input.role);
  const workspaceId = input.workspaceId || AGENCY_WORKSPACE_ID;
  await prisma.agencyWorkspace.upsert({
    where: { id: workspaceId },
    update: {},
    create: {
      id: workspaceId,
      name: "Northstar Influence",
      plan: "AGENCY",
      notes: "Agency workspace — seats invite/accept gated by agency_seats switch.",
    },
  });
  const token = newAgencyInviteToken();
  const expiresAt = agencyInviteExpiry();

  const seat = await prisma.agencySeat.upsert({
    where: { workspaceId_email: { workspaceId, email } },
    update: {
      role,
      active: false,
      inviteStatus: "pending",
      inviteToken: token,
      invitedAt: new Date(),
      expiresAt,
      acceptedAt: null,
      acceptedUserId: null,
    },
    create: {
      workspaceId,
      email,
      role,
      active: false,
      inviteStatus: "pending",
      inviteToken: token,
      invitedAt: new Date(),
      expiresAt,
    },
  });

  return {
    seat,
    invitePath: agencyInvitePath(token),
    inviteToken: token,
  };
}

export async function getAgencySeatByInviteToken(token: string) {
  const cleaned = token.trim();
  if (!cleaned) return null;
  return prisma.agencySeat.findUnique({ where: { inviteToken: cleaned } });
}

export async function acceptAgencySeatInvite(input: {
  token: string;
  accountEmail: string;
  accountUserId: string;
  now?: Date;
}) {
  if (!(await productSwitch("agency_seats"))) {
    return { ok: false as const, error: "Agency seats are turned off." };
  }
  const seat = await getAgencySeatByInviteToken(input.token);
  if (!seat) return { ok: false as const, error: "Invite not found." };

  const gate = agencySeatAccessGate({
    seatsEnabled: true,
    inviteStatus: seat.inviteStatus,
    active: true,
    expiresAt: seat.expiresAt,
    now: input.now,
  });
  if (seat.inviteStatus === "accepted") {
    if (normalizeSeatEmail(seat.email) !== normalizeSeatEmail(input.accountEmail)) {
      return { ok: false as const, error: "This invite belongs to a different email." };
    }
    return { ok: true as const, seat, alreadyAccepted: true as const };
  }
  if (!gate.ok) return gate;

  if (normalizeSeatEmail(seat.email) !== normalizeSeatEmail(input.accountEmail)) {
    return {
      ok: false as const,
      error: `Sign in as ${seat.email} to accept this seat invite.`,
    };
  }

  const updated = await prisma.agencySeat.update({
    where: { id: seat.id },
    data: {
      inviteStatus: "accepted",
      active: true,
      acceptedAt: input.now ?? new Date(),
      acceptedUserId: input.accountUserId,
    },
  });
  return { ok: true as const, seat: updated, alreadyAccepted: false as const };
}

export async function resolveAgencySeatForEmail(email: string, workspaceId = AGENCY_WORKSPACE_ID) {
  const seatsEnabled = await productSwitch("agency_seats");
  if (!seatsEnabled) return null;
  const seat = await prisma.agencySeat.findUnique({
    where: {
      workspaceId_email: { workspaceId, email: normalizeSeatEmail(email) },
    },
  });
  if (!seat) return null;
  if (!canUseAgencySeatSession({ seatsEnabled: true, inviteStatus: seat.inviteStatus, active: seat.active })) {
    return null;
  }
  return seat;
}

export async function revokeAgencySeatInvite(email: string, workspaceId = AGENCY_WORKSPACE_ID) {
  if (!(await productSwitch("agency_seats"))) {
    throw new Error("Agency seats are turned off.");
  }
  await prisma.agencySeat.updateMany({
    where: { workspaceId, email: normalizeSeatEmail(email) },
    data: {
      inviteStatus: "revoked",
      active: false,
      inviteToken: null,
    },
  });
}
