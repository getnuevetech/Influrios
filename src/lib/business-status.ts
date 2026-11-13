/**
 * Business dashboard status. Profile completion, verification, seats, requests,
 * and this month's confirmed funding stay on separate evidence.
 */
import { randomBytes } from "crypto";
import { agencyWorkspaceIdForOwner } from "@/lib/agency";
import { prisma } from "@/lib/db";
import { formatMoney, storedCurrencyCode } from "@/lib/money";

export const ACCOUNT_MONTH_TIME_ZONE = "America/Chicago";

export type BusinessVerificationState = "unverified" | "pending" | "verified" | "rejected" | "expired";

export type SectionState = "ready" | "empty" | "unavailable";

const VERIFICATION_CHECKS = ["entity", "authority"] as const;
const OPEN_REQUEST = new Set(["active", "published", "open"]);
const STARTED = new Set(["in_review", "in_progress", "action_required", "verified", "pending"]);

export function newIncidentReference() {
  return `inc-${randomBytes(4).toString("hex")}`;
}

export function profileIsComplete(input: { name: string; industry: string; contactName: string }) {
  return Boolean(input.name.trim() && input.industry.trim() && input.contactName.trim());
}

/** Approved verification tasks only. A completed profile and a verified email do not qualify. */
export function presentBusinessVerification(
  tasks: { role?: string | null; checkKey: string; status: string }[],
): BusinessVerificationState {
  const relevant = tasks.filter(
    (task) =>
      (!task.role || task.role === "paying_business") &&
      (VERIFICATION_CHECKS as readonly string[]).includes(task.checkKey),
  );
  if (relevant.some((task) => task.status === "expired")) return "expired";
  if (relevant.some((task) => task.status === "rejected" || task.status === "restricted")) return "rejected";
  const byKey = new Map(relevant.map((task) => [task.checkKey, task.status]));
  if (VERIFICATION_CHECKS.every((key) => byKey.get(key) === "verified")) return "verified";
  if (relevant.some((task) => STARTED.has(task.status))) return "pending";
  return "unverified";
}

export function businessTrustLabels(input: {
  profileComplete: boolean;
  verification: BusinessVerificationState | "unavailable";
}) {
  const verification =
    input.verification === "verified"
      ? "Verified Business"
      : input.verification === "pending"
        ? "Business verification pending"
        : input.verification === "rejected"
          ? "Business verification rejected"
          : input.verification === "expired"
            ? "Business verification expired"
            : input.verification === "unavailable"
              ? "Business verification unavailable"
              : "Business verification not started";
  return {
    profile: input.profileComplete ? "Profile complete" : "Profile incomplete",
    verification,
    showVerifiedBadge: input.verification === "verified",
  };
}

export type SeatRecord = { inviteStatus: string; active: boolean };

/** The owner plus accepted, active seats. A pending or revoked invitation is not a used seat. */
export function occupiedSeatCount(input: { ownerPresent: boolean; seats: SeatRecord[] }) {
  const accepted = input.seats.filter((seat) => seat.active && seat.inviteStatus === "accepted").length;
  return (input.ownerPresent ? 1 : 0) + accepted;
}

/** Open requests, one canonical id each. A collaboration id is not a request. */
export function activeRequestIds(input: {
  briefs: { id: string; status: string }[];
  requests: { id: string; briefId?: string | null; status: string }[];
}) {
  const ids = new Set<string>();
  for (const brief of input.briefs) {
    if (!OPEN_REQUEST.has(brief.status)) continue;
    ids.add(`brief:${brief.id}`);
  }
  for (const request of input.requests) {
    if (!OPEN_REQUEST.has(request.status)) continue;
    const briefId = request.briefId?.trim();
    ids.add(briefId ? `brief:${briefId}` : `request:${request.id}`);
  }
  return [...ids];
}

export function activeCollaborationIds(items: { id: string; stage: string }[]) {
  const ids = new Set<string>();
  for (const item of items) {
    if (item.stage === "Released") continue;
    if (item.id.trim()) ids.add(item.id);
  }
  return [...ids];
}

function timeZoneOffset(date: Date, timeZone: string) {
  const formatted = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(date);
  const map: Record<string, string> = {};
  for (const part of formatted) map[part.type] = part.value;
  let hour = Number(map.hour);
  if (hour === 24) hour = 0;
  const asUtc = Date.UTC(Number(map.year), Number(map.month) - 1, Number(map.day), hour, Number(map.minute), Number(map.second));
  return asUtc - date.getTime();
}

function zonedDateTime(year: number, month: number, day: number, timeZone: string) {
  const utc = new Date(Date.UTC(year, month - 1, day, 0, 0, 0));
  const offset = timeZoneOffset(utc, timeZone);
  const instant = new Date(utc.getTime() - offset);
  const corrected = timeZoneOffset(instant, timeZone);
  return corrected === offset ? instant : new Date(utc.getTime() - corrected);
}

/** The calendar month currently shown on the dashboard. */
export function selectedMonthWindow(now = new Date(), timeZone = ACCOUNT_MONTH_TIME_ZONE) {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone, year: "numeric", month: "numeric" }).formatToParts(now);
  const year = Number(parts.find((part) => part.type === "year")?.value);
  const month = Number(parts.find((part) => part.type === "month")?.value);
  const start = zonedDateTime(year, month, 1, timeZone);
  const end = month === 12 ? zonedDateTime(year + 1, 1, 1, timeZone) : zonedDateTime(year, month + 1, 1, timeZone);
  return { start, end, year, month, timeZone };
}

export type FundingMovement = {
  id: string;
  currency: string;
  entries: { kind: string; amountCents: number; party?: string | null; createdAt: Date }[];
};

export type CurrencyPeriodTotals = {
  currency: string;
  fundedCents: number;
  releasedCents: number;
  refundedCents: number;
};

function inWindow(value: Date, window: { start: Date; end: Date }) {
  return value instanceof Date && !Number.isNaN(value.getTime()) && value >= window.start && value < window.end;
}

/** Confirmed collection, release, and refund timestamps in the selected month. Currencies are not added together. */
export function summarizeMonthlyFunding(
  fundings: FundingMovement[],
  window: { start: Date; end: Date },
): CurrencyPeriodTotals[] {
  const totals = new Map<string, CurrencyPeriodTotals>();
  for (const funding of fundings) {
    const currency = storedCurrencyCode(funding.currency);
    if (!currency) continue;
    for (const entry of funding.entries) {
      if (!inWindow(entry.createdAt, window)) continue;
      const party = (entry.party ?? "").trim().toLowerCase();
      const bucket =
        entry.kind === "hold" && !party.startsWith("influencer")
          ? "fundedCents"
          : entry.kind === "release"
            ? "releasedCents"
            : entry.kind === "refund"
              ? "refundedCents"
              : null;
      if (!bucket) continue;
      const row = totals.get(currency) ?? { currency, fundedCents: 0, releasedCents: 0, refundedCents: 0 };
      row[bucket] += entry.amountCents;
      totals.set(currency, row);
    }
  }
  return [...totals.values()].sort((left, right) => left.currency.localeCompare(right.currency));
}

export function formatPeriodFunding(rows: CurrencyPeriodTotals[]) {
  if (rows.length === 0) {
    return { value: "0", note: "No confirmed funding this month." };
  }
  if (rows.length === 1) {
    const row = rows[0]!;
    return {
      value: formatMoney(row.fundedCents, row.currency),
      note: `Released ${formatMoney(row.releasedCents, row.currency)} · Refunded ${formatMoney(row.refundedCents, row.currency)}`,
    };
  }
  return {
    value: rows.map((row) => formatMoney(row.fundedCents, row.currency)).join(" · "),
    note: rows
      .map((row) => `${row.currency} released ${formatMoney(row.releasedCents, row.currency)}, refunded ${formatMoney(row.refundedCents, row.currency)}`)
      .join(" · "),
  };
}

export async function loadAccountBusinessVerification(userId: string) {
  try {
    const tasks = await prisma.paymentVerificationTask.findMany({
      where: { userId, role: "paying_business" },
      select: { checkKey: true, status: true, role: true },
    });
    return { state: presentBusinessVerification(tasks) };
  } catch (error) {
    const incident = newIncidentReference();
    console.error("business verification", incident, error);
    return { state: "unavailable" as const, incident };
  }
}

export async function loadWorkspaceBusinessVerification(workspaceId: string) {
  try {
    const workspace = await prisma.businessWorkspace.findUnique({
      where: { id: workspaceId },
      select: { ownerUserId: true },
    });
    if (!workspace?.ownerUserId) return { state: "unverified" as const };
    return loadAccountBusinessVerification(workspace.ownerUserId);
  } catch (error) {
    const incident = newIncidentReference();
    console.error("counterparty verification", incident, error);
    return { state: "unavailable" as const, incident };
  }
}

export async function loadOccupiedSeats(ownerUserId: string) {
  try {
    const seats = await prisma.agencySeat.findMany({
      where: { workspaceId: agencyWorkspaceIdForOwner(ownerUserId) },
      select: { email: true, role: true, inviteStatus: true, active: true },
    });
    const members = seats
      .filter((seat) => seat.active && seat.inviteStatus === "accepted")
      .map((seat) => ({ email: seat.email, role: seat.role }));
    return { ok: true as const, used: occupiedSeatCount({ ownerPresent: true, seats }), members };
  } catch (error) {
    const incident = newIncidentReference();
    console.error("business seats", incident, error);
    return { ok: false as const, incident };
  }
}

export async function loadMonthlyBusinessFunding(workspaceId: string, now = new Date()) {
  try {
    const rows = await prisma.collaborationFunding.findMany({
      where: { workspaceId },
      select: {
        id: true,
        currency: true,
        entries: { select: { kind: true, amountCents: true, party: true, createdAt: true } },
      },
    });
    return { ok: true as const, rows: summarizeMonthlyFunding(rows, selectedMonthWindow(now)) };
  } catch (error) {
    const incident = newIncidentReference();
    console.error("monthly funding", incident, error);
    return { ok: false as const, incident };
  }
}
