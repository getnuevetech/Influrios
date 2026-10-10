import { randomBytes } from "crypto";
import { prisma } from "@/lib/db";
import { getDirectoryCreator } from "@/lib/directory";

export const INVITATION_STATUSES = [
  "queued",
  "opened",
  "claimed",
  "published",
  "declined",
  "expired",
  "suppressed",
] as const;

export type InvitationStatus = (typeof INVITATION_STATUSES)[number];

export const DEFAULT_INVITATION_SETTINGS = {
  defaultExpiryDays: 14,
  defaultFollowUpDays: 7,
};

export const DEFAULT_INVITATION_TEMPLATE = {
  key: "claim_card",
  name: "Claim your card",
  subject: "{{name}}, your Influrios profile is ready",
  body: "Hi {{name}}, we prepared your Influrios profile. Open {{link}} before {{expiry}} to claim {{profile}}.",
};

export const DEFAULT_INVITATION_CAMPAIGN = "Influencer outreach";

const RANK: Record<string, number> = { queued: 0, opened: 1, claimed: 2, published: 3 };

export function smtpConfigured(env?: { SMTP_HOST?: string; SMTP_FROM?: string }) {
  const host = env ? env.SMTP_HOST : process.env.SMTP_HOST;
  const from = env ? env.SMTP_FROM : process.env.SMTP_FROM;
  return Boolean(host && from);
}

export function newInvitationToken() {
  return randomBytes(24).toString("base64url");
}

export function clampDays(value: number, fallback: number) {
  if (!Number.isFinite(value)) return fallback;
  return Math.min(365, Math.max(1, Math.floor(value)));
}

export function suppressionValue(kind: "email" | "slug", value: string) {
  const cleaned = value.trim().toLowerCase();
  if (kind === "email") return cleaned;
  return cleaned.replace(/^@/, "");
}

export function renderInvitationCopy(template: string, vars: Record<string, string>) {
  return template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key: string) => vars[key] ?? "");
}

/** Terminal outreach states stay put. Claim progress only moves forward. */
export function advanceStatus(current: string, next: InvitationStatus): InvitationStatus {
  if (current === "published") return "published";
  if (next === "declined" || next === "expired" || next === "suppressed") {
    if (current === "claimed" && next !== "suppressed") return current as InvitationStatus;
    return next;
  }
  const currentRank = RANK[current];
  const nextRank = RANK[next];
  if (currentRank === undefined) return current as InvitationStatus;
  if (nextRank > currentRank) return next;
  return current as InvitationStatus;
}

export function invitationGate(input: {
  status: string;
  expiresAt: Date;
  now?: Date;
  suppressed: boolean;
}): "ready" | "claimed" | "published" | "declined" | "expired" | "suppressed" {
  if (input.status === "published") return "published";
  if (input.status === "claimed") return "claimed";
  if (input.status === "declined") return "declined";
  if (input.suppressed || input.status === "suppressed") return "suppressed";
  const now = input.now ?? new Date();
  if (input.status === "expired" || input.expiresAt.getTime() <= now.getTime()) return "expired";
  return "ready";
}

function addDays(from: Date, days: number) {
  return new Date(from.getTime() + days * 86400000);
}

async function recordEvent(invitationId: string, kind: string, actor: string, detail?: string) {
  await prisma.invitationEvent.create({
    data: { invitationId, kind, actor, detail },
  });
}

export async function ensureInvitationDefaults() {
  const template = await prisma.invitationTemplate.upsert({
    where: { key: DEFAULT_INVITATION_TEMPLATE.key },
    create: { ...DEFAULT_INVITATION_TEMPLATE, sortOrder: 0, active: true },
    update: {},
  });
  const campaign = await prisma.invitationCampaign.findFirst({
    where: { name: DEFAULT_INVITATION_CAMPAIGN },
  });
  const ensuredCampaign =
    campaign ??
    (await prisma.invitationCampaign.create({
      data: { name: DEFAULT_INVITATION_CAMPAIGN, active: true },
    }));
  const settings = await prisma.invitationSettings.upsert({
    where: { id: "default" },
    create: { id: "default", ...DEFAULT_INVITATION_SETTINGS },
    update: {},
  });
  return { template, campaign: ensuredCampaign, settings };
}

export async function loadInvitationAdmin() {
  await ensureInvitationDefaults();
  const [settings, templates, campaigns, invitations, suppressions] = await Promise.all([
    prisma.invitationSettings.findUniqueOrThrow({ where: { id: "default" } }),
    prisma.invitationTemplate.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }] }),
    prisma.invitationCampaign.findMany({ orderBy: { name: "asc" } }),
    prisma.creatorInvitation.findMany({
      orderBy: { createdAt: "desc" },
      take: 100,
      include: {
        template: true,
        campaign: true,
        events: { orderBy: { createdAt: "desc" }, take: 8 },
      },
    }),
    prisma.outreachSuppression.findMany({ orderBy: { createdAt: "desc" } }),
  ]);
  const { mailReady } = await import("@/lib/mail");
  return { settings, templates, campaigns, invitations, suppressions, smtp: await mailReady() };
}

async function suppressed(slug: string, email?: string | null) {
  const values = [suppressionValue("slug", slug)];
  if (email) values.push(suppressionValue("email", email));
  const hit = await prisma.outreachSuppression.findFirst({ where: { value: { in: values } } });
  return Boolean(hit);
}

export async function createInvitation(input: {
  slug: string;
  templateId: string;
  campaignId: string;
  email?: string;
  expiryDays: number;
  followUpDays: number;
  actor: string;
}) {
  const creator = await getDirectoryCreator(input.slug);
  if (!creator) throw new Error("That profile is not in the directory.");
  const row = await prisma.creator.findUnique({ where: { slug: creator.slug } });
  if (row?.claimed) throw new Error("That profile is already claimed.");
  const email = input.email?.trim().toLowerCase() || null;
  if (await suppressed(creator.slug, email)) {
    throw new Error("That profile or email is on the do-not-contact list.");
  }
  const settings = await prisma.invitationSettings.findUnique({ where: { id: "default" } });
  const expiryDays = clampDays(input.expiryDays, settings?.defaultExpiryDays ?? DEFAULT_INVITATION_SETTINGS.defaultExpiryDays);
  const followUpDays = clampDays(
    input.followUpDays,
    settings?.defaultFollowUpDays ?? DEFAULT_INVITATION_SETTINGS.defaultFollowUpDays,
  );
  const now = new Date();
  const invitation = await prisma.creatorInvitation.create({
    data: {
      token: newInvitationToken(),
      creatorSlug: creator.slug,
      displayName: creator.displayName,
      email,
      templateId: input.templateId,
      campaignId: input.campaignId,
      status: "queued",
      expiresAt: addDays(now, expiryDays),
      followUpAt: addDays(now, followUpDays),
    },
  });
  await recordEvent(invitation.id, "created", input.actor, creator.slug);
  await prisma.auditLog.create({
    data: {
      actor: input.actor,
      action: "invitation.create",
      objectType: "CreatorInvitation",
      objectId: invitation.id,
      after: { slug: creator.slug, status: "queued" },
    },
  });
  return invitation;
}

export async function openInvitation(token: string) {
  const invitation = await prisma.creatorInvitation.findUnique({
    where: { token },
    include: { template: true, campaign: true },
  });
  if (!invitation) return { state: "missing" as const };

  const blocked = await suppressed(invitation.creatorSlug, invitation.email);
  const gate = invitationGate({
    status: invitation.status,
    expiresAt: invitation.expiresAt,
    suppressed: blocked,
  });

  if (gate === "expired" && invitation.status !== "expired") {
    await prisma.creatorInvitation.update({ where: { id: invitation.id }, data: { status: "expired" } });
    await recordEvent(invitation.id, "expired", "system");
  }
  if (
    gate === "suppressed" &&
    (invitation.status === "queued" || invitation.status === "opened")
  ) {
    await prisma.creatorInvitation.update({ where: { id: invitation.id }, data: { status: "suppressed" } });
    await recordEvent(invitation.id, "suppressed", "system", "do-not-contact");
  }
  if (gate !== "ready" && gate !== "claimed") {
    return { state: gate, invitation };
  }

  const creator = await getDirectoryCreator(invitation.creatorSlug);
  if (!creator) return { state: "missing" as const, invitation };
  const { createDraftFromProfile } = await import("@/lib/claim");
  let draft: Awaited<ReturnType<typeof createDraftFromProfile>>;
  try {
    draft = await createDraftFromProfile(creator, `ADMIN_INVITE:${invitation.token}`);
  } catch (error) {
    if (error instanceof Error && error.message === "This profile has no social platform.") {
      return { state: "unavailable" as const, invitation, message: error.message };
    }
    throw error;
  }
  if (draft.stage === "published" && invitation.status !== "published") {
    await prisma.creatorInvitation.update({
      where: { id: invitation.id },
      data: { status: "published", draftId: draft.id, publishedAt: new Date() },
    });
    await recordEvent(invitation.id, "published", "creator");
    return { state: "published" as const, invitation: { ...invitation, draftId: draft.id } };
  }
  if (!invitation.draftId || invitation.draftId !== draft.id) {
    await prisma.creatorInvitation.update({ where: { id: invitation.id }, data: { draftId: draft.id } });
  }
  if (gate === "ready" && invitation.status !== "opened" && invitation.status !== "claimed") {
    const status = advanceStatus(invitation.status, "opened");
    await prisma.creatorInvitation.update({
      where: { id: invitation.id },
      data: { status, openedAt: invitation.openedAt ?? new Date(), draftId: draft.id },
    });
    await recordEvent(invitation.id, "opened", "creator", creator.slug);
  }
  return { state: gate, invitation: { ...invitation, draftId: draft.id }, draft, creator };
}

export async function declineInvitation(token: string) {
  const invitation = await prisma.creatorInvitation.findUnique({ where: { token } });
  if (!invitation || invitation.status === "published") return;
  const status = advanceStatus(invitation.status, "declined");
  await prisma.creatorInvitation.update({ where: { id: invitation.id }, data: { status } });
  await recordEvent(invitation.id, "declined", "creator");
}

export async function advanceInvitationForDraft(draftId: string, next: "claimed" | "published") {
  const invitation = await prisma.creatorInvitation.findFirst({ where: { draftId } });
  if (!invitation) return;
  const status = advanceStatus(invitation.status, next);
  if (status === invitation.status) return;
  await prisma.creatorInvitation.update({
    where: { id: invitation.id },
    data: {
      status,
      claimedAt: next === "claimed" ? new Date() : invitation.claimedAt,
      publishedAt: next === "published" ? new Date() : invitation.publishedAt,
    },
  });
  await recordEvent(invitation.id, next, "creator");
}

export async function noteLinkCopied(id: string, actor: string) {
  await recordEvent(id, "link_copied", actor);
}

export async function queueInvitationEmail(id: string, actor: string) {
  const { mailReady } = await import("@/lib/mail");
  if (!(await mailReady())) {
    throw new Error("Email send is inactive until SMTP is configured.");
  }
  const invitation = await prisma.creatorInvitation.findUnique({ where: { id } });
  if (!invitation) throw new Error("Invitation not found.");
  await prisma.job.create({
    data: {
      kind: "invitation_email",
      status: "queued",
      payload: { invitationId: invitation.id, token: invitation.token },
    },
  });
  await recordEvent(invitation.id, "send_queued", actor);
  const { processDueJobs } = await import("@/lib/jobs");
  await processDueJobs();
}
