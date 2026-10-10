import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getDirectoryCreator } from "@/lib/directory";
import { entitlementsForPlan } from "@/lib/entitlements-db";
import {
  PLAN_ENTITLEMENTS,
  type EntitlementDecision,
  type EntitlementLimits,
  type PlanCode,
} from "@/lib/entitlements";

export const COLLABORATION_STATUSES = ["draft", "sent", "accepted", "declined", "withdrawn"] as const;
export type CollaborationStatus = (typeof COLLABORATION_STATUSES)[number];

/** Rows that consume the proposal allowance. Drafts and withdrawals do not. */
export const COUNTED_PROPOSAL_STATUSES = ["sent", "accepted", "declined"] as const;

export const DEFAULT_COMMERCIAL_OPTIONS = [
  "Open to discussion",
  "Paid brand partnership",
  "Cross-promotion / barter",
  "Joint pitch to a brand",
];

const TRANSITIONS: Record<CollaborationStatus, readonly CollaborationStatus[]> = {
  draft: ["sent", "withdrawn"],
  sent: ["accepted", "declined", "withdrawn"],
  accepted: [],
  declined: [],
  withdrawn: [],
};

const PLAN_ORDER: PlanCode[] = ["STARTER", "PLUS", "PRO"];

export function isCollaborationStatus(value: string): value is CollaborationStatus {
  return (COLLABORATION_STATUSES as readonly string[]).includes(value);
}

export function proposalCountsTowardLimit(status: string): boolean {
  return (COUNTED_PROPOSAL_STATUSES as readonly string[]).includes(status);
}

export function transitionCollaboration(
  from: string,
  to: string,
): { ok: true; from: CollaborationStatus; to: CollaborationStatus } | { ok: false; error: string } {
  if (!isCollaborationStatus(from) || !isCollaborationStatus(to)) {
    return { ok: false, error: "Unknown collaboration status." };
  }
  if (from === to) return { ok: false, error: "Already in that status." };
  if (!TRANSITIONS[from].includes(to)) {
    return { ok: false, error: `A ${from} proposal cannot move to ${to}.` };
  }
  return { ok: true, from, to };
}

export function decideProposalAllowance(
  limits: EntitlementLimits,
  plan: PlanCode,
  used: number,
): EntitlementDecision {
  const limit = limits.proposalsMax;
  if (used < limit) return { ok: true };
  const start = PLAN_ORDER.indexOf(plan);
  let upgradePlanCode: PlanCode | null = null;
  for (let i = start + 1; i < PLAN_ORDER.length; i++) {
    const code = PLAN_ORDER[i];
    if (PLAN_ENTITLEMENTS[code].proposalsMax > limit && PLAN_ENTITLEMENTS[code].proposalsMax > used) {
      upgradePlanCode = code;
      break;
    }
  }
  return { ok: false, feature: "collaboration.proposals.max", limit, upgradePlanCode };
}

export function proposalDenialMessage(
  decision: Extract<EntitlementDecision, { ok: false }>,
  windowDays: number,
): string {
  const upgrade = decision.upgradePlanCode
    ? ` Upgrade to ${decision.upgradePlanCode.charAt(0) + decision.upgradePlanCode.slice(1).toLowerCase()} to raise ${decision.feature}.`
    : "";
  if (decision.limit <= 0) {
    return `Sending proposals is off for this plan (${decision.feature}).${upgrade}`;
  }
  return `This profile has used ${decision.limit} of ${decision.limit} proposals in the last ${windowDays} days (${decision.feature}).${upgrade}`;
}

export function commercialChoices(raw: string | null | undefined): string[] {
  const lines = String(raw ?? "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  return lines.length ? lines : [...DEFAULT_COMMERCIAL_OPTIONS];
}

export function normalizeCommercialOptions(raw: string): string | null {
  const lines = raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 12);
  if (!lines.length) return null;
  if (lines.some((line) => line.length > 80)) return null;
  return lines.join("\n");
}

export function clampWindowDays(value: number): number {
  if (!Number.isFinite(value)) return 30;
  return Math.min(365, Math.max(1, Math.round(value)));
}

export function reasonList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
}

export function windowStart(windowDays: number, now = new Date()): Date {
  const days = clampWindowDays(windowDays);
  return new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
}

export async function getCollaborationSettings() {
  const existing = await prisma.collaborationSettings.findUnique({ where: { id: "default" } });
  if (existing) return existing;
  return prisma.collaborationSettings.create({
    data: {
      id: "default",
      windowDays: 30,
      commercialOptions: DEFAULT_COMMERCIAL_OPTIONS.join("\n"),
    },
  });
}

export async function countCountedProposals(initiatorSlug: string, windowDays: number, now = new Date()) {
  return prisma.collaboration.count({
    where: {
      initiatorSlug,
      status: { in: [...COUNTED_PROPOSAL_STATUSES] },
      sentAt: { gte: windowStart(windowDays, now) },
    },
  });
}

export async function proposalUsage(initiatorSlug: string, plan: PlanCode) {
  const [settings, limits] = await Promise.all([
    getCollaborationSettings(),
    entitlementsForPlan(plan),
  ]);
  const used = await countCountedProposals(initiatorSlug, settings.windowDays);
  const decision = decideProposalAllowance(limits, plan, used);
  return {
    settings,
    limits,
    used,
    decision,
    remaining: Math.max(0, limits.proposalsMax - used),
  };
}

function cleanText(value: string, max: number) {
  return value.trim().slice(0, max);
}

/** Title and scope are required. A blank role or match explanation stays blank. */
export function buildProposalFields(input: {
  title: string;
  scope: string;
  roleInitiator: string;
  roleRecipient: string;
  why: string;
}):
  | {
      ok: true;
      title: string;
      scope: string;
      roleInitiator: string;
      roleRecipient: string;
      why: string;
    }
  | { ok: false; error: string } {
  const title = cleanText(input.title, 120);
  const scope = cleanText(input.scope, 2000);
  if (!title || !scope) return { ok: false, error: "A title and a scope are required." };
  return {
    ok: true,
    title,
    scope,
    roleInitiator: cleanText(input.roleInitiator, 200),
    roleRecipient: cleanText(input.roleRecipient, 200),
    why: cleanText(input.why, 1000),
  };
}

export async function createCollaboration(input: {
  initiatorSlug: string;
  recipientSlug: string;
  initiatorUserId: string;
  title: string;
  scope: string;
  roleInitiator: string;
  roleRecipient: string;
  commercial: string;
  intent: "draft" | "sent";
  why: string;
  reasons: string[];
  score: number;
  offerSpecialty: string | null;
  needSpecialty: string | null;
  plan: PlanCode;
}): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const initiator = await getDirectoryCreator(input.initiatorSlug);
  const recipient = await getDirectoryCreator(input.recipientSlug);
  if (!initiator || !recipient || initiator.slug === recipient.slug) {
    return { ok: false, error: "Choose two different creators." };
  }
  const fields = buildProposalFields(input);
  if (!fields.ok) return fields;

  try {
    const usage = await proposalUsage(initiator.slug, input.plan);
    const choices = commercialChoices(usage.settings.commercialOptions);
    if (!choices.includes(input.commercial)) {
      return { ok: false, error: "Choose a commercial option from the list." };
    }
    if (usage.limits.proposalsMax <= 0) {
      const denied = decideProposalAllowance(usage.limits, input.plan, usage.used);
      if (!denied.ok) return { ok: false, error: proposalDenialMessage(denied, usage.settings.windowDays) };
    }
    if (input.intent === "sent" && !usage.decision.ok) {
      return { ok: false, error: proposalDenialMessage(usage.decision, usage.settings.windowDays) };
    }

    const row = await prisma.collaboration.create({
      data: {
        initiatorSlug: initiator.slug,
        recipientSlug: recipient.slug,
        initiatorUserId: input.initiatorUserId,
        title: fields.title,
        scope: fields.scope,
        roleInitiator: fields.roleInitiator,
        roleRecipient: fields.roleRecipient,
        commercial: input.commercial,
        status: input.intent,
        why: fields.why,
        reasons: input.reasons as Prisma.InputJsonValue,
        score: Math.max(0, Math.min(100, Math.round(input.score))),
        offerSpecialty: input.offerSpecialty,
        needSpecialty: input.needSpecialty,
        sentAt: input.intent === "sent" ? new Date() : null,
        events: {
          create: {
            fromStatus: null,
            toStatus: input.intent,
            actorUserId: input.initiatorUserId,
            note: "created",
          },
        },
      },
    });
    return { ok: true, id: row.id };
  } catch (error) {
    console.error("collaboration create", error);
    return { ok: false, error: "The proposal could not be saved." };
  }
}

export async function advanceCollaboration(input: {
  id: string;
  to: CollaborationStatus;
  actorUserId: string | null;
  plan?: PlanCode;
  note?: string;
  enforceLimit?: boolean;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const row = await prisma.collaboration.findUnique({ where: { id: input.id } });
    if (!row) return { ok: false, error: "That proposal was not found." };
    const gate = transitionCollaboration(row.status, input.to);
    if (!gate.ok) return gate;

    if (input.to === "sent" && input.enforceLimit !== false) {
      const creator = await getDirectoryCreator(row.initiatorSlug);
      const plan = input.plan ?? (creator?.planTier as PlanCode | undefined) ?? "STARTER";
      const usage = await proposalUsage(row.initiatorSlug, plan);
      if (!usage.decision.ok) {
        return { ok: false, error: proposalDenialMessage(usage.decision, usage.settings.windowDays) };
      }
    }

    const deciding = input.to === "accepted" || input.to === "declined" || input.to === "withdrawn";
    await prisma.collaboration.update({
      where: { id: row.id },
      data: {
        status: input.to,
        sentAt: input.to === "sent" ? new Date() : row.sentAt,
        decidedAt: deciding ? new Date() : row.decidedAt,
        decidedByUserId: input.to === "accepted" || input.to === "declined" ? input.actorUserId : row.decidedByUserId,
        events: {
          create: {
            fromStatus: row.status,
            toStatus: input.to,
            actorUserId: input.actorUserId,
            note: input.note ?? null,
          },
        },
      },
    });
    return { ok: true };
  } catch (error) {
    console.error("collaboration advance", error);
    return { ok: false, error: "The proposal could not be updated." };
  }
}

export async function getCollaboration(id: string) {
  return prisma.collaboration.findUnique({
    where: { id },
    include: { events: { orderBy: { createdAt: "asc" } } },
  });
}

export async function listCollaborations(filter?: { slug?: string }) {
  const slug = filter?.slug?.trim();
  return prisma.collaboration.findMany({
    where: slug ? { OR: [{ initiatorSlug: slug }, { recipientSlug: slug }] } : undefined,
    orderBy: { updatedAt: "desc" },
    take: 50,
  });
}
