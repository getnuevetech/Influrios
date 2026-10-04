import { prisma } from "@/lib/db";
import { getAppOrigin } from "@/lib/billing";
import {
  COLLAB_NOTIFICATION_TEMPLATES,
  type CollabNotificationKind,
  type CollabNotificationVars,
  renderCollabNotification,
  shouldNotifyReviewDeadline,
} from "@/lib/collab-notifications";
import { renderInvitationCopy } from "@/lib/invitations";
import { sendMail } from "@/lib/mail";

const MAX_ATTEMPTS = 3;

export function nextJobStatus(attempts: number, ok: boolean): "succeeded" | "queued" | "failed" {
  if (ok) return "succeeded";
  if (attempts >= MAX_ATTEMPTS) return "failed";
  return "queued";
}

function payloadOf(payload: unknown): Record<string, string> {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return {};
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(payload)) {
    if (typeof value === "string") out[key] = value;
  }
  return out;
}

async function runJob(kind: string, payload: unknown) {
  const data = payloadOf(payload);
  if (kind === "invitation_email") {
    if (!data.invitationId) throw new Error("Invitation job is missing an id.");
    const invitation = await prisma.creatorInvitation.findUnique({
      where: { id: data.invitationId },
      include: { template: true },
    });
    if (!invitation) throw new Error("Invitation not found.");
    if (!invitation.email) throw new Error("Invitation has no email address.");
    const vars = {
      name: invitation.displayName,
      link: `${getAppOrigin()}/invite/${invitation.token}`,
      expiry: invitation.expiresAt.toISOString().slice(0, 10),
      profile: invitation.creatorSlug,
    };
    const result = await sendMail({
      to: invitation.email,
      subject: renderInvitationCopy(invitation.template.subject, vars),
      text: renderInvitationCopy(invitation.template.body, vars),
    });
    if (!result.ok) throw new Error(result.error);
    await prisma.invitationEvent.create({
      data: { invitationId: invitation.id, kind: "send_delivered", actor: "smtp", detail: invitation.email },
    });
    return;
  }
  if (kind === "verification_email") {
    if (!data.email || !data.code) throw new Error("Verification job is missing an address or code.");
    const result = await sendMail({
      to: data.email,
      subject: "Your Influrios verification code",
      text: `Your Influrios verification code is ${data.code}. It expires in 30 minutes. The same code stays on the verify screen if this message does not arrive.`,
    });
    if (!result.ok) throw new Error(result.error);
    return;
  }
  if (kind === "claim_verification_email") {
    if (!data.email || !data.code) throw new Error("Claim verification job is missing an address or code.");
    const result = await sendMail({
      to: data.email,
      subject: "Verify your Influrios Influencer Card",
      text: `Your Influrios claim verification code is ${data.code}. Enter it to continue publishing your Influencer Card. This code does not verify your social account.`,
    });
    if (!result.ok) throw new Error(result.error);
    return;
  }
  if (kind === "mail_test") {
    const { sendInvitationTest } = await import("@/lib/mail");
    if (!data.to) throw new Error("Test send is missing a recipient.");
    const result = await sendInvitationTest(data.to, false);
    if (!result.ok) throw new Error(result.message);
    return;
  }
  if (kind === "milestone_auto_approval") {
    const { runAutoApprovalSweep } = await import("@/lib/marketplace-ledger");
    const result = await runAutoApprovalSweep();
    if (result.disabled) return;
    return;
  }
  if (kind === "review_deadline_sweep") {
    await runReviewDeadlineSweep();
    return;
  }
  if (kind === "collab_notification") {
    if (!data.to || !data.subject || !data.text) {
      throw new Error("Collaboration notification job is missing a recipient or copy.");
    }
    const result = await sendMail({
      to: data.to,
      subject: data.subject,
      text: data.text,
    });
    if (!result.ok) throw new Error(result.error);
    return;
  }
  if (kind === "provider_webhook" || kind === "ai_provider") {
    throw new Error("This row is a record. Stripe redelivers webhooks, and specialty suggestions are run again from the creator dashboard.");
  }
  throw new Error(`Unknown job kind ${kind}.`);
}

export async function processDueJobs(limit = 8) {
  const due = await prisma.job.findMany({
    where: { status: "queued", runAfter: { lte: new Date() } },
    orderBy: { createdAt: "asc" },
    take: limit,
  });
  for (const job of due) {
    const claimed = await prisma.job.updateMany({
      where: { id: job.id, status: "queued" },
      data: { status: "running", attempts: { increment: 1 } },
    });
    if (claimed.count !== 1) continue;
    const current = await prisma.job.findUnique({ where: { id: job.id } });
    if (!current) continue;
    try {
      await runJob(current.kind, current.payload);
      await prisma.job.update({
        where: { id: job.id },
        data: { status: "succeeded", lastError: null },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Job failed";
      const status = nextJobStatus(current.attempts, false);
      await prisma.job.update({
        where: { id: job.id },
        data: {
          status,
          lastError: message.slice(0, 500),
          runAfter: status === "queued" ? new Date(Date.now() + 60_000) : new Date(),
        },
      });
    }
  }
}

export async function enqueueVerificationEmail(userId: string, code: string) {
  const { mailReady } = await import("@/lib/mail");
  if (!(await mailReady())) return { queued: false };
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return { queued: false };
  await prisma.job.create({
    data: {
      kind: "verification_email",
      status: "queued",
      payload: { userId, email: user.email, code },
    },
  });
  await processDueJobs();
  return { queued: true };
}

/** Claim funnel email before a User row exists. */
export async function enqueueClaimVerificationEmail(email: string, code: string) {
  const { mailReady } = await import("@/lib/mail");
  if (!(await mailReady())) return { queued: false };
  await prisma.job.create({
    data: {
      kind: "claim_verification_email",
      status: "queued",
      payload: { email: email.trim().toLowerCase(), code },
    },
  });
  await processDueJobs();
  return { queued: true };
}

export async function retryFailedJob(id: string) {
  const updated = await prisma.job.updateMany({
    where: { id, status: "failed" },
    data: { status: "queued", attempts: 0, lastError: null, runAfter: new Date() },
  });
  if (updated.count === 1) await processDueJobs();
  return updated.count === 1;
}

export async function listJobs(limit = 50) {
  return prisma.job.findMany({ orderBy: { createdAt: "desc" }, take: limit });
}

/** W3.5 — queue an idempotent milestone auto-approval sweep. */
export async function enqueueAutoApprovalSweep() {
  await prisma.job.create({
    data: {
      kind: "milestone_auto_approval",
      status: "queued",
      payload: { enqueuedAt: new Date().toISOString() },
    },
  });
  await processDueJobs();
  return { queued: true };
}

async function resolveCollabRecipients(input: {
  audience: (typeof COLLAB_NOTIFICATION_TEMPLATES)[CollabNotificationKind]["audience"];
  businessName: string;
  creatorSlug: string;
}): Promise<string[]> {
  const emails = new Set<string>();
  const needBusiness = input.audience === "business" || input.audience === "both";
  const needInfluencer = input.audience === "influencer" || input.audience === "both";
  const needAdmin = input.audience === "admin";

  if (needBusiness) {
    const business = await prisma.businessProfile.findFirst({
      where: { name: { equals: input.businessName, mode: "insensitive" } },
      include: { user: { select: { email: true } } },
    });
    if (business?.user.email) emails.add(business.user.email.trim().toLowerCase());
  }
  if (needInfluencer) {
    const creator = await prisma.creator.findUnique({
      where: { slug: input.creatorSlug },
      include: { user: { select: { email: true } } },
    });
    if (creator?.user?.email) emails.add(creator.user.email.trim().toLowerCase());
  }
  if (needAdmin) {
    const admins = await prisma.adminUser.findMany({
      where: { active: true },
      select: { email: true },
      take: 5,
      orderBy: { createdAt: "asc" },
    });
    for (const admin of admins) {
      if (admin.email.trim()) emails.add(admin.email.trim().toLowerCase());
    }
  }
  return [...emails].filter(Boolean);
}

/**
 * W3.11 — enqueue Influencer-terminology collaboration emails for a funding event.
 * No-ops when SMTP is unset or no party emails resolve (tests stay quiet).
 */
export async function notifyCollabFundingEvent(input: {
  fundingId: string;
  kind: CollabNotificationKind;
  milestone?: string;
  detail?: string;
  /** Extra recipients (e.g. admin on payout failure). */
  extraEmails?: string[];
  processNow?: boolean;
}) {
  const { mailReady } = await import("@/lib/mail");
  if (!(await mailReady())) return { queued: false, count: 0 };

  const funding = await prisma.collaborationFunding.findUnique({ where: { id: input.fundingId } });
  if (!funding) return { queued: false, count: 0 };

  const creator = await prisma.creator.findUnique({
    where: { slug: funding.creatorSlug },
    select: { displayName: true },
  });
  const template = COLLAB_NOTIFICATION_TEMPLATES[input.kind];
  const vars: CollabNotificationVars = {
    business: funding.businessName,
    influencer: creator?.displayName || funding.creatorSlug,
    title: funding.title,
    milestone: input.milestone,
    detail: input.detail,
  };
  const rendered = renderCollabNotification(input.kind, vars);
  const recipients = await resolveCollabRecipients({
    audience: template.audience,
    businessName: funding.businessName,
    creatorSlug: funding.creatorSlug,
  });
  for (const email of input.extraEmails ?? []) {
    const cleaned = email.trim().toLowerCase();
    if (cleaned && !recipients.includes(cleaned)) recipients.push(cleaned);
  }
  // Dev §18: dispute / payout_failed / provider limitation also reach admin.
  if (
    input.kind === "dispute_opened" ||
    input.kind === "dispute_resolved" ||
    input.kind === "payout_failed" ||
    input.kind === "provider_jurisdiction_limitation" ||
    input.kind === "preexisting_relationship_claimed"
  ) {
    const admins = await prisma.adminUser.findMany({
      where: { active: true },
      select: { email: true },
      take: 5,
      orderBy: { createdAt: "asc" },
    });
    for (const admin of admins) {
      const cleaned = admin.email.trim().toLowerCase();
      if (cleaned && !recipients.includes(cleaned)) recipients.push(cleaned);
    }
  }

  for (const to of recipients) {
    await prisma.job.create({
      data: {
        kind: "collab_notification",
        status: "queued",
        payload: {
          to,
          subject: rendered.subject,
          text: rendered.text,
          notificationKind: input.kind,
          fundingId: funding.id,
        },
      },
    });
  }
  if (recipients.length > 0 && input.processNow !== false) await processDueJobs();
  return { queued: recipients.length > 0, count: recipients.length };
}

/** Notify without a funding row (pre-existing claim, jurisdiction block before create). */
export async function notifyCollabParties(input: {
  kind: CollabNotificationKind;
  businessName: string;
  creatorSlug: string;
  title?: string;
  milestone?: string;
  detail?: string;
  processNow?: boolean;
}) {
  const { mailReady } = await import("@/lib/mail");
  if (!(await mailReady())) return { queued: false, count: 0 };

  const creator = await prisma.creator.findUnique({
    where: { slug: input.creatorSlug },
    select: { displayName: true },
  });
  const template = COLLAB_NOTIFICATION_TEMPLATES[input.kind];
  const rendered = renderCollabNotification(input.kind, {
    business: input.businessName,
    influencer: creator?.displayName || input.creatorSlug,
    title: input.title,
    milestone: input.milestone,
    detail: input.detail,
  });
  const recipients = await resolveCollabRecipients({
    audience: template.audience,
    businessName: input.businessName,
    creatorSlug: input.creatorSlug,
  });
  if (
    input.kind === "preexisting_relationship_claimed" ||
    input.kind === "provider_jurisdiction_limitation"
  ) {
    const admins = await prisma.adminUser.findMany({
      where: { active: true },
      select: { email: true },
      take: 5,
      orderBy: { createdAt: "asc" },
    });
    for (const admin of admins) {
      const cleaned = admin.email.trim().toLowerCase();
      if (cleaned && !recipients.includes(cleaned)) recipients.push(cleaned);
    }
  }
  for (const to of recipients) {
    await prisma.job.create({
      data: {
        kind: "collab_notification",
        status: "queued",
        payload: {
          to,
          subject: rendered.subject,
          text: rendered.text,
          notificationKind: input.kind,
        },
      },
    });
  }
  if (recipients.length > 0 && input.processNow !== false) await processDueJobs();
  return { queued: recipients.length > 0, count: recipients.length };
}

/** W3.11 — remind businesses when a review window is about to close. */
export async function runReviewDeadlineSweep(now = new Date()) {
  const due = await prisma.fundingMilestone.findMany({
    where: { status: "submitted", autoApproveAt: { not: null, gt: now } },
    include: { funding: true },
    take: 100,
  });
  let notified = 0;
  for (const milestone of due) {
    if (
      !shouldNotifyReviewDeadline({
        milestoneStatus: milestone.status,
        autoApproveAt: milestone.autoApproveAt,
        now,
      })
    ) {
      continue;
    }
    const already = await prisma.auditLog.findFirst({
      where: {
        action: "review_deadline_notified",
        objectType: "FundingMilestone",
        objectId: milestone.id,
      },
    });
    if (already) continue;
    const result = await notifyCollabFundingEvent({
      fundingId: milestone.fundingId,
      kind: "review_deadline_approaching",
      milestone: milestone.title,
      processNow: false,
    });
    if (result.count > 0) {
      notified += 1;
      await prisma.auditLog
        .create({
          data: {
            actor: "system",
            action: "review_deadline_notified",
            objectType: "FundingMilestone",
            objectId: milestone.id,
            after: { fundingId: milestone.fundingId, at: now.toISOString() },
          },
        })
        .catch(() => undefined);
    }
  }
  if (notified > 0) await processDueJobs();
  return { scanned: due.length, notified };
}

export async function enqueueReviewDeadlineSweep() {
  await prisma.job.create({
    data: {
      kind: "review_deadline_sweep",
      status: "queued",
      payload: { enqueuedAt: new Date().toISOString() },
    },
  });
  await processDueJobs();
  return { queued: true };
}
