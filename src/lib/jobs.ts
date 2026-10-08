import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { SWEEP_JOB_KINDS } from "@/lib/sweep-clock";
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

async function runJob(kind: string, payload: unknown): Promise<{ externalId?: string } | void> {
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
    const { queuePreferredSms } = await import("@/lib/sms");
    await queuePreferredSms({
      email: invitation.email,
      body: `Influrios invitation: ${vars.link}`,
      templateKey: "invitation_email",
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
    const { queuePreferredSms } = await import("@/lib/sms");
    await queuePreferredSms({
      userId: data.userId,
      email: data.email,
      body: `Your Influrios verification code is ${data.code}. It expires in 30 minutes.`,
      templateKey: "verification_email",
    });
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
    const { queuePreferredSms } = await import("@/lib/sms");
    await queuePreferredSms({
      email: data.email,
      body: `Your Influrios claim verification code is ${data.code}.`,
      templateKey: "claim_verification_email",
    });
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
  if (kind === "dispute_sla_sweep") {
    await runDisputeSlaSweep();
    return;
  }
  if (kind === "provider_hold_warn_sweep") {
    await runProviderHoldWarnSweep();
    return;
  }
  if (kind === "failed_payout_retry_sweep") {
    await runFailedPayoutRetrySweep();
    return;
  }
  if (kind === "funding_recon_sweep") {
    await runFundingReconciliationSweep();
    return;
  }
  if (kind === "scheduled_release_sweep") {
    await runScheduledReleaseSweep();
    return;
  }
  if (kind === "marketplace_application_expire_sweep") {
    const { sweepExpiredMarketplaceApplications } = await import("@/lib/marketplace-listings");
    await sweepExpiredMarketplaceApplications();
    return;
  }
  if (kind === "recurring_cycle_sweep") {
    const { sweepDueRecurrences } = await import("@/lib/marketplace-ledger");
    await sweepDueRecurrences();
    return;
  }
  if (kind === "short_link_schedule_sweep") {
    const { applyDueShortLinkSchedules } = await import("@/lib/short-link");
    await applyDueShortLinkSchedules();
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
    const { queuePreferredSms } = await import("@/lib/sms");
    await queuePreferredSms({
      email: data.to,
      body: data.text,
      templateKey: data.notificationKind || "collab_notification",
    });
    return;
  }
  if (kind === "reindex_creators") {
    const { reindexCreators } = await import("@/lib/creator-search");
    await reindexCreators();
    return;
  }
  if (kind === "sms_send") {
    if (!data.to || !data.body) throw new Error("SMS job is missing a destination or body.");
    const { deliverSms } = await import("@/lib/sms");
    const sent = await deliverSms({ to: data.to, body: data.body });
    if (!sent.ok) throw new Error(sent.message);
    return { externalId: sent.externalId };
  }
  if (kind === "provider_webhook" || kind === "ai_provider" || kind === "provider_instruction") {
    throw new Error("This row is a record. Stripe redelivers webhooks, specialty suggestions rerun from the creator dashboard, and provider refund/cancel instructions await a signed payout.refunded webhook.");
  }
  throw new Error(`Unknown job kind ${kind}.`);
}

export async function enqueueDueSweeps() {
  const open = await prisma.job.findMany({
    where: { kind: { in: [...SWEEP_JOB_KINDS] }, status: { in: ["queued", "running"] } },
    select: { kind: true },
  });
  const have = new Set(open.map((row) => row.kind));
  let queued = 0;
  for (const kind of SWEEP_JOB_KINDS) {
    if (have.has(kind)) continue;
    await prisma.job.create({
      data: {
        kind,
        status: "queued",
        payload: { enqueuedAt: new Date().toISOString() },
      },
    });
    queued += 1;
  }
  return { queued };
}

export async function listSweepStatus() {
  const rows = await Promise.all(
    SWEEP_JOB_KINDS.map(async (kind) => {
      const latest = await prisma.job.findFirst({
        where: { kind },
        orderBy: { createdAt: "desc" },
      });
      return {
        kind,
        status: latest?.status ?? "never",
        at: latest?.updatedAt.toISOString() ?? null,
        lastError: latest?.lastError ?? null,
      };
    }),
  );
  return rows;
}

export async function processDueJobs(limit = 8) {
  const due = await prisma.job.findMany({
    where: { status: "queued", runAfter: { lte: new Date() } },
    orderBy: { createdAt: "asc" },
    take: limit,
  });
  let processed = 0;
  for (const job of due) {
    const claimed = await prisma.job.updateMany({
      where: { id: job.id, status: "queued" },
      data: { status: "running", attempts: { increment: 1 } },
    });
    if (claimed.count !== 1) continue;
    const current = await prisma.job.findUnique({ where: { id: job.id } });
    if (!current) continue;
    try {
      const outcome = await runJob(current.kind, current.payload);
      const clearCode =
        current.kind === "verification_email" || current.kind === "claim_verification_email";
      const nextPayload =
        current.payload && typeof current.payload === "object" && !Array.isArray(current.payload)
          ? { ...(current.payload as Record<string, unknown>) }
          : {};
      if (clearCode) delete nextPayload.code;
      if (outcome?.externalId) nextPayload.externalId = outcome.externalId;
      const payloadChanged = clearCode || Boolean(outcome?.externalId);
      await prisma.job.update({
        where: { id: job.id },
        data: {
          status: "succeeded",
          lastError: null,
          ...(payloadChanged ? { payload: nextPayload as Prisma.InputJsonValue } : {}),
        },
      });
      processed += 1;
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
  return { processed };
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
  workspaceId?: string | null;
}): Promise<string[]> {
  const emails = new Set<string>();
  const needBusiness = input.audience === "business" || input.audience === "both";
  const needInfluencer = input.audience === "influencer" || input.audience === "both";
  const needAdmin = input.audience === "admin";

  if (needBusiness) {
    if (input.workspaceId?.trim()) {
      const workspace = await prisma.businessWorkspace.findUnique({
        where: { id: input.workspaceId.trim() },
        include: { owner: { select: { email: true } } },
      });
      if (workspace?.owner?.email) emails.add(workspace.owner.email.trim().toLowerCase());
    }
    if (![...emails].length) {
      const business = await prisma.businessProfile.findFirst({
        where: { name: { equals: input.businessName, mode: "insensitive" } },
        include: { user: { select: { email: true } } },
      });
      if (business?.user.email) emails.add(business.user.email.trim().toLowerCase());
    }
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
    workspaceId: funding.workspaceId,
  });
  for (const email of input.extraEmails ?? []) {
    const cleaned = email.trim().toLowerCase();
    if (cleaned && !recipients.includes(cleaned)) recipients.push(cleaned);
  }
  // Dev §18: dispute / payout_failed / provider limitation also reach admin.
  if (
    input.kind === "dispute_opened" ||
    input.kind === "dispute_resolved" ||
    input.kind === "dispute_sla_reminder" ||
    input.kind === "payout_failed" ||
    input.kind === "provider_jurisdiction_limitation" ||
    input.kind === "provider_hold_period_warning" ||
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

/** Dev §16 — remind parties when an open dispute is past the SLA window. */
export async function runDisputeSlaSweep(now = new Date()) {
  const { shouldRemindDisputeSla, DEFAULT_DISPUTE_SLA_HOURS } = await import("@/lib/collab-ops-jobs");
  const open = await prisma.milestoneDispute.findMany({
    where: { status: { in: ["open", "under_review"] } },
    include: { milestone: true, funding: true },
    take: 100,
    orderBy: { createdAt: "asc" },
  });
  let notified = 0;
  for (const dispute of open) {
    if (
      !shouldRemindDisputeSla({
        status: dispute.status,
        openedAt: dispute.createdAt,
        now,
        slaHours: DEFAULT_DISPUTE_SLA_HOURS,
      })
    ) {
      continue;
    }
    const already = await prisma.auditLog.findFirst({
      where: {
        action: "dispute_sla_reminded",
        objectType: "MilestoneDispute",
        objectId: dispute.id,
      },
    });
    if (already) continue;
    const result = await notifyCollabFundingEvent({
      fundingId: dispute.fundingId,
      kind: "dispute_sla_reminder",
      milestone: dispute.milestone?.title,
      detail: `${dispute.reasonLabel} · open since ${dispute.createdAt.toISOString().slice(0, 10)} (${DEFAULT_DISPUTE_SLA_HOURS}h SLA)`,
      processNow: false,
    });
    if (result.count > 0) {
      notified += 1;
      await prisma.auditLog
        .create({
          data: {
            actor: "system",
            action: "dispute_sla_reminded",
            objectType: "MilestoneDispute",
            objectId: dispute.id,
            after: { fundingId: dispute.fundingId, at: now.toISOString() },
          },
        })
        .catch(() => undefined);
    }
  }
  if (notified > 0) await processDueJobs();
  return { scanned: open.length, notified };
}

export async function enqueueDisputeSlaSweep() {
  await prisma.job.create({
    data: {
      kind: "dispute_sla_sweep",
      status: "queued",
      payload: { enqueuedAt: new Date().toISOString() },
    },
  });
  await processDueJobs();
  return { queued: true };
}

/** Dev §16 — warn ops when provider-held funds sit past the hold warning window. */
export async function runProviderHoldWarnSweep(now = new Date()) {
  const { shouldWarnProviderHold, DEFAULT_PROVIDER_HOLD_WARN_HOURS } = await import("@/lib/collab-ops-jobs");
  const held = await prisma.collaborationFunding.findMany({
    where: { status: "held" },
    include: {
      entries: { where: { kind: "hold" }, orderBy: { createdAt: "asc" }, take: 1 },
    },
    take: 100,
    orderBy: { createdAt: "asc" },
  });
  let notified = 0;
  for (const funding of held) {
    const heldAt = funding.entries[0]?.createdAt ?? funding.createdAt;
    if (
      !shouldWarnProviderHold({
        fundingStatus: funding.status,
        heldAt,
        now,
        warnHours: DEFAULT_PROVIDER_HOLD_WARN_HOURS,
      })
    ) {
      continue;
    }
    const already = await prisma.auditLog.findFirst({
      where: {
        action: "provider_hold_warned",
        objectType: "CollaborationFunding",
        objectId: funding.id,
      },
    });
    if (already) continue;
    const ageHours = Math.round((now.getTime() - heldAt.getTime()) / (60 * 60 * 1000));
    const result = await notifyCollabFundingEvent({
      fundingId: funding.id,
      kind: "provider_hold_period_warning",
      detail: `Held for ${ageHours}h (warn after ${DEFAULT_PROVIDER_HOLD_WARN_HOURS}h). Gross ${funding.grossCents}¢ ${funding.currency}.`,
      processNow: false,
    });
    if (result.count > 0) {
      notified += 1;
      await prisma.auditLog
        .create({
          data: {
            actor: "system",
            action: "provider_hold_warned",
            objectType: "CollaborationFunding",
            objectId: funding.id,
            after: { heldAt: heldAt.toISOString(), at: now.toISOString() },
          },
        })
        .catch(() => undefined);
    }
  }
  if (notified > 0) await processDueJobs();
  return { scanned: held.length, notified };
}

export async function enqueueProviderHoldWarnSweep() {
  await prisma.job.create({
    data: {
      kind: "provider_hold_warn_sweep",
      status: "queued",
      payload: { enqueuedAt: new Date().toISOString() },
    },
  });
  await processDueJobs();
  return { queued: true };
}

/**
 * Dev §16 — provider-safe failed payout retry.
 * Resets payout_failed → approved after backoff when no release ledger exists (no double-pay).
 */
export async function runFailedPayoutRetrySweep(now = new Date()) {
  const {
    shouldRetryFailedPayout,
    DEFAULT_FAILED_PAYOUT_BACKOFF_HOURS,
    DEFAULT_FAILED_PAYOUT_MAX_ATTEMPTS,
  } = await import("@/lib/collab-ops-jobs");
  const failed = await prisma.fundingMilestone.findMany({
    where: { status: "payout_failed" },
    include: {
      funding: true,
      entries: { where: { kind: "release" }, take: 1 },
    },
    take: 100,
    orderBy: { payoutFailedAt: "asc" },
  });
  let retried = 0;
  for (const milestone of failed) {
    if (
      !shouldRetryFailedPayout({
        milestoneStatus: milestone.status,
        hasReleaseLedgerEntry: milestone.entries.length > 0,
        payoutFailedAt: milestone.payoutFailedAt,
        payoutRetryCount: milestone.payoutRetryCount,
        now,
        backoffHours: DEFAULT_FAILED_PAYOUT_BACKOFF_HOURS,
        maxAttempts: DEFAULT_FAILED_PAYOUT_MAX_ATTEMPTS,
      })
    ) {
      continue;
    }
    const updated = await prisma.fundingMilestone.updateMany({
      where: { id: milestone.id, status: "payout_failed" },
      data: {
        status: "approved",
        payoutFailedAt: null,
        payoutRetryCount: { increment: 1 },
      },
    });
    if (updated.count !== 1) continue;
    retried += 1;
    await prisma.auditLog
      .create({
        data: {
          actor: "system",
          action: "payout_retry_queued",
          objectType: "FundingMilestone",
          objectId: milestone.id,
          after: {
            fundingId: milestone.fundingId,
            attempt: milestone.payoutRetryCount + 1,
            at: now.toISOString(),
          },
        },
      })
      .catch(() => undefined);
    await notifyCollabFundingEvent({
      fundingId: milestone.fundingId,
      kind: "payout_failed",
      milestone: milestone.title,
      detail: `Provider-safe retry #${milestone.payoutRetryCount + 1} queued (milestone back to approved; awaiting provider payout.released).`,
      processNow: false,
    });
  }
  if (retried > 0) await processDueJobs();
  return { scanned: failed.length, retried };
}

export async function enqueueFailedPayoutRetrySweep() {
  await prisma.job.create({
    data: {
      kind: "failed_payout_retry_sweep",
      status: "queued",
      payload: { enqueuedAt: new Date().toISOString() },
    },
  });
  await processDueJobs();
  return { queued: true };
}

/** Dev §16 — stale funding intents + unbalanced held ledgers. */
export async function runFundingReconciliationSweep(now = new Date()) {
  const { shouldFlagStaleFundingIntent, shouldFlagLedgerMismatch, DEFAULT_STALE_FUNDING_HOURS } =
    await import("@/lib/collab-ops-jobs");
  const { ledgerMovements, reconcileLedger } = await import("@/lib/ledger");
  const awaiting = await prisma.collaborationFunding.findMany({
    where: { status: "awaiting_provider" },
    take: 100,
    orderBy: { createdAt: "asc" },
  });
  const held = await prisma.collaborationFunding.findMany({
    where: { status: { in: ["held", "payment_risk"] } },
    include: { entries: true },
    take: 100,
    orderBy: { createdAt: "asc" },
  });
  let flagged = 0;
  for (const funding of awaiting) {
    if (
      !shouldFlagStaleFundingIntent({
        fundingStatus: funding.status,
        createdAt: funding.createdAt,
        now,
        staleHours: DEFAULT_STALE_FUNDING_HOURS,
      })
    ) {
      continue;
    }
    const already = await prisma.auditLog.findFirst({
      where: {
        action: "funding_recon_stale",
        objectType: "CollaborationFunding",
        objectId: funding.id,
      },
    });
    if (already) continue;
    flagged += 1;
    await prisma.auditLog
      .create({
        data: {
          actor: "system",
          action: "funding_recon_stale",
          objectType: "CollaborationFunding",
          objectId: funding.id,
          after: { createdAt: funding.createdAt.toISOString(), at: now.toISOString() },
        },
      })
      .catch(() => undefined);
    await notifyCollabFundingEvent({
      fundingId: funding.id,
      kind: "provider_jurisdiction_limitation",
      detail: `Stale funding intent still awaiting provider after ${DEFAULT_STALE_FUNDING_HOURS}h.`,
      processNow: false,
    });
  }
  for (const funding of held) {
    const reconciled = reconcileLedger(ledgerMovements(funding.entries), funding.grossCents);
    if (!shouldFlagLedgerMismatch({ balanced: reconciled.balanced, fundingStatus: funding.status })) {
      continue;
    }
    const already = await prisma.auditLog.findFirst({
      where: {
        action: "funding_recon_mismatch",
        objectType: "CollaborationFunding",
        objectId: funding.id,
      },
    });
    if (already) continue;
    flagged += 1;
    await prisma.auditLog
      .create({
        data: {
          actor: "system",
          action: "funding_recon_mismatch",
          objectType: "CollaborationFunding",
          objectId: funding.id,
          after: {
            heldCents: reconciled.heldCents,
            releasedCents: reconciled.releasedCents,
            refundedCents: reconciled.refundedCents,
            at: now.toISOString(),
          },
        },
      })
      .catch(() => undefined);
    await notifyCollabFundingEvent({
      fundingId: funding.id,
      kind: "provider_jurisdiction_limitation",
      detail: `Ledger/provider mismatch: held ${reconciled.heldCents}¢ / released ${reconciled.releasedCents}¢ / refunded ${reconciled.refundedCents}¢ vs gross ${funding.grossCents}¢.`,
      processNow: false,
    });
  }
  if (flagged > 0) await processDueJobs();
  return { scanned: awaiting.length + held.length, flagged };
}

export async function enqueueFundingReconciliationSweep() {
  await prisma.job.create({
    data: {
      kind: "funding_recon_sweep",
      status: "queued",
      payload: { enqueuedAt: new Date().toISOString() },
    },
  });
  await processDueJobs();
  return { queued: true };
}

/**
 * Dev §8 / §16 — due release_scheduled milestones → provider release instruction + release_requested.
 * Ledger still moves only on signed payout.released.
 */
export async function runScheduledReleaseSweep(now = new Date()) {
  const { shouldRequestScheduledRelease } = await import("@/lib/collab-ops-jobs");
  const { releasableCents } = await import("@/lib/ledger");
  const { splitMilestoneRelease } = await import("@/lib/account-purpose");
  const { readShareSnapshot, shareLines } = await import("@/lib/fx-share");
  const { adapterForProvider } = await import("@/lib/payment-provider-adapter");
  const { verifyMarketplaceSignature } = await import("@/lib/ledger");
  const due = await prisma.fundingMilestone.findMany({
    where: {
      status: "release_scheduled",
      releaseScheduledAt: { lte: now },
      funding: { status: "held" },
    },
    include: { funding: true },
    take: 100,
    orderBy: { releaseScheduledAt: "asc" },
  });
  let requested = 0;
  for (const milestone of due) {
    if (
      !shouldRequestScheduledRelease({
        milestoneStatus: milestone.status,
        releaseScheduledAt: milestone.releaseScheduledAt,
        now,
      })
    ) {
      continue;
    }
    const openDispute = await prisma.milestoneDispute.findFirst({
      where: {
        fundingId: milestone.fundingId,
        status: { in: ["open", "under_review", "refund_requested", "escalated_provider", "escalated_legal"] },
        OR: [{ milestoneId: milestone.id }, { milestoneId: null }],
      },
    });
    if (openDispute) continue;
    const amount = releasableCents(milestone.amountCents, milestone.refundedCents);
    if (amount <= 0) continue;
    const parties = readShareSnapshot(milestone.funding.shareSnapshotJson);
    const legs = splitMilestoneRelease({
      releasableCents: amount,
      fundingGrossCents: milestone.funding.grossCents,
      fundingFeeCents: milestone.funding.feeCents,
      financialPlanJson: (milestone.funding.feeSnapshotJson as { financialPlan?: unknown } | null)?.financialPlan,
      milestoneTitle: milestone.title,
    });
    const lines = parties && legs.creatorCents > 0 ? shareLines(legs.creatorCents, parties) : null;
    const adapter = await adapterForProvider(milestone.funding.providerCode, {
      verifySignature: verifyMarketplaceSignature,
    });
    const instruction = await adapter.createReleaseOrTransfer({
      fundingId: milestone.fundingId,
      milestoneId: milestone.id,
      amountCents: amount,
      shares: lines?.map((line) => ({ label: line.label, amountCents: line.amountCents })),
    });
    if (!instruction.ok) continue;
    const updated = await prisma.fundingMilestone.updateMany({
      where: { id: milestone.id, status: "release_scheduled" },
      data: { status: "release_requested" },
    });
    if (updated.count !== 1) continue;
    requested += 1;
    await prisma.auditLog
      .create({
        data: {
          actor: "system",
          action: "milestone_release_requested",
          objectType: "FundingMilestone",
          objectId: milestone.id,
          after: {
            fundingId: milestone.fundingId,
            reference: instruction.reference,
            amountCents: amount,
            at: now.toISOString(),
          },
        },
      })
      .catch(() => undefined);
    await notifyCollabFundingEvent({
      fundingId: milestone.fundingId,
      kind: "milestone_approved",
      milestone: milestone.title,
      detail: `Provider release requested (${instruction.reference}); awaiting signed payout.released.`,
      processNow: false,
    });
  }
  if (requested > 0) await processDueJobs();
  return { scanned: due.length, requested };
}

export async function enqueueScheduledReleaseSweep() {
  await prisma.job.create({
    data: {
      kind: "scheduled_release_sweep",
      status: "queued",
      payload: { enqueuedAt: new Date().toISOString() },
    },
  });
  await processDueJobs();
  return { queued: true };
}

/** W2.3c — queue marketplace application auto-expire sweep (no-op when mode is manual). */
export async function enqueueMarketplaceApplicationExpireSweep() {
  await prisma.job.create({
    data: {
      kind: "marketplace_application_expire_sweep",
      status: "queued",
      payload: { enqueuedAt: new Date().toISOString() },
    },
  });
  await processDueJobs();
  return { queued: true };
}
