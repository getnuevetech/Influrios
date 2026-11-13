import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";

const REQUESTED = "country_change.requested";
const APPROVED = "country_change.approved";
const REJECTED = "country_change.rejected";

export type CountryChangeOutcome =
  | { kind: "apply"; country: string }
  | { kind: "review"; country: string; requestedCountry: string }
  | { kind: "unchanged"; country: string }
  | { kind: "invalid"; country: string };

/**
 * A verified country is not an ordinary profile edit.
 * The stored country stays put until a review approves the request.
 */
export function countryChangeOutcome(input: {
  identityVerified: boolean;
  currentCountry: string;
  requestedCountry: string;
}): CountryChangeOutcome {
  const current = input.currentCountry.trim();
  const requested = input.requestedCountry.trim();
  if (!requested) return { kind: "invalid", country: current };
  if (requested.toLowerCase() === current.toLowerCase()) return { kind: "unchanged", country: current };
  if (input.identityVerified) return { kind: "review", country: current, requestedCountry: requested };
  return { kind: "apply", country: requested };
}

export function profileCountryAfterChange(input: {
  identityVerified: boolean;
  currentCountry: string;
  requestedCountry: string;
}) {
  const outcome = countryChangeOutcome(input);
  if (outcome.kind === "apply") return { country: outcome.country, pendingReview: null as string | null };
  if (outcome.kind === "review") return { country: outcome.country, pendingReview: outcome.requestedCountry };
  return { country: outcome.country, pendingReview: null as string | null };
}

export type CountryReviewEvent = {
  action: string;
  requestedCountry: string;
  at: string;
};

/** The latest request stays pending until a later approve or reject. */
export function pendingCountryRequest(events: CountryReviewEvent[]): string | null {
  const ordered = [...events].sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : 0));
  const last = ordered[ordered.length - 1];
  if (!last || last.action !== REQUESTED) return null;
  const requested = last.requestedCountry.trim();
  return requested || null;
}

function requestedFrom(after: unknown) {
  if (!after || typeof after !== "object" || !("requestedCountry" in after)) return "";
  return String((after as { requestedCountry?: unknown }).requestedCountry ?? "").trim();
}

async function reviewEvents(creatorId: string): Promise<CountryReviewEvent[]> {
  const rows = await prisma.auditLog.findMany({
    where: { objectType: "Creator", objectId: creatorId, action: { in: [REQUESTED, APPROVED, REJECTED] } },
    orderBy: { createdAt: "asc" },
    take: 50,
  });
  return rows.map((row) => ({
    action: row.action,
    requestedCountry: requestedFrom(row.after),
    at: row.createdAt.toISOString(),
  }));
}

export async function pendingCountryForCreator(creatorId: string) {
  return pendingCountryRequest(await reviewEvents(creatorId));
}

export async function recordCountryChangeRequest(input: {
  creatorId: string;
  actor: string;
  currentCountry: string;
  requestedCountry: string;
}) {
  const pending = await pendingCountryForCreator(input.creatorId);
  if (pending && pending.toLowerCase() === input.requestedCountry.trim().toLowerCase()) return;
  await prisma.auditLog.create({
    data: {
      actor: input.actor,
      action: REQUESTED,
      objectType: "Creator",
      objectId: input.creatorId,
      before: { country: input.currentCountry } as Prisma.InputJsonValue,
      after: { requestedCountry: input.requestedCountry.trim(), status: "pending" } as Prisma.InputJsonValue,
    },
  });
}

export async function listPendingCountryReviews() {
  const rows = await prisma.auditLog.findMany({
    where: { objectType: "Creator", action: { in: [REQUESTED, APPROVED, REJECTED] } },
    orderBy: { createdAt: "asc" },
    take: 200,
  });
  const grouped = new Map<string, CountryReviewEvent[]>();
  for (const row of rows) {
    const id = row.objectId ?? "";
    if (!id) continue;
    const list = grouped.get(id) ?? [];
    list.push({
      action: row.action,
      requestedCountry: requestedFrom(row.after),
      at: row.createdAt.toISOString(),
    });
    grouped.set(id, list);
  }
  const pendingIds = [...grouped.entries()].flatMap(([creatorId, events]) => {
    const requested = pendingCountryRequest(events);
    return requested ? [{ creatorId, requestedCountry: requested }] : [];
  });
  if (pendingIds.length === 0) return [];
  const creators = await prisma.creator.findMany({
    where: { id: { in: pendingIds.map((row) => row.creatorId) } },
    select: { id: true, slug: true, displayName: true, locationCountry: true },
  });
  const byId = new Map(creators.map((row) => [row.id, row]));
  return pendingIds.flatMap((row) => {
    const creator = byId.get(row.creatorId);
    if (!creator) return [];
    return [{ ...row, slug: creator.slug, displayName: creator.displayName, currentCountry: creator.locationCountry ?? "" }];
  });
}

export async function decideCountryReview(input: {
  creatorId: string;
  actor: string;
  decision: "approved" | "rejected";
}) {
  const requested = await pendingCountryForCreator(input.creatorId);
  if (!requested) throw new Error("No country change is waiting for review.");
  const creator = await prisma.creator.findUnique({
    where: { id: input.creatorId },
    select: { id: true, slug: true, locationCountry: true },
  });
  if (!creator) throw new Error("Creator not found.");
  if (input.decision === "approved") {
    await prisma.creator.update({
      where: { id: creator.id },
      data: { locationCountry: requested },
    });
    const sessions = await prisma.onboardingSession.findMany({ where: { draftSlug: creator.slug } });
    for (const session of sessions) {
      const payload =
        session.payload && typeof session.payload === "object" && !Array.isArray(session.payload)
          ? (session.payload as Record<string, unknown>)
          : {};
      await prisma.onboardingSession.update({
        where: { id: session.id },
        data: { payload: { ...payload, locationCountry: requested } as Prisma.InputJsonValue },
      });
    }
  }
  await prisma.auditLog.create({
    data: {
      actor: input.actor,
      action: input.decision === "approved" ? APPROVED : REJECTED,
      objectType: "Creator",
      objectId: creator.id,
      before: { country: creator.locationCountry ?? "" } as Prisma.InputJsonValue,
      after: { requestedCountry: requested, status: input.decision } as Prisma.InputJsonValue,
    },
  });
}
