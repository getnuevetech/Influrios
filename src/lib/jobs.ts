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
import { catalogCollabMessage, collabCatalogVars, deliverCatalogEmail, displayMoney } from "@/lib/email-live";
import { mailSettingsView, sendMail } from "@/lib/mail";

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
    const catalog = await deliverCatalogEmail({
      templateId: "account.claim",
      to: invitation.email,
      vars: {
        first_name: invitation.displayName.split(/\s+/)[0] || invitation.displayName,
        action_url: vars.link,
        expires_at: vars.expiry,
      },
    });
    if (!catalog.sent && (catalog.reason === "paused" || catalog.reason === "preference" || catalog.reason === "feature_off")) {
      throw new Error("The claim invitation email is paused or turned off for this recipient.");
    }
    const result = catalog.sent
      ? { ok: true as const, smtpResponse: "catalog" }
      : await sendMail({
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
    return { externalId: result.smtpResponse };
  }
  if (kind === "verification_email") {
    if (!data.email || !data.code) throw new Error("Verification job is missing an address or code.");
    const expires = new Date(Date.now() + 30 * 60 * 1000);
    const catalog = await deliverCatalogEmail({
      templateId: "account.verify",
      to: data.email,
      vars: {
        verification_code: data.code,
        expires_in: "30 minutes",
        expires_at: expires.toISOString(),
      },
      log: false,
    });
    if (!catalog.sent && catalog.reason === "paused") throw new Error("Verification email is paused.");
    const result = catalog.sent
      ? { ok: true as const, smtpResponse: "catalog" }
      : await sendMail({
          to: data.email,
          subject: "Your Influrios verification code",
          text: `Your Influrios verification code is ${data.code}. It expires in 30 minutes.`,
        });
    if (!result.ok) throw new Error(result.error);
    const { queuePreferredSms } = await import("@/lib/sms");
    await queuePreferredSms({
      userId: data.userId,
      email: data.email,
      body: `Your Influrios verification code is ${data.code}. It expires in 30 minutes.`,
      templateKey: "verification_email",
    });
    return { externalId: result.smtpResponse };
  }
  if (kind === "claim_verification_email") {
    if (!data.email || !data.code) throw new Error("Claim verification job is missing an address or code.");
    const catalog = await deliverCatalogEmail({
      templateId: "account.card_verify",
      to: data.email,
      vars: {
        verification_code: data.code,
        expires_in: "30 minutes",
        expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
      },
      log: false,
    });
    if (!catalog.sent && catalog.reason === "paused") throw new Error("Claim verification email is paused.");
    const result = catalog.sent
      ? { ok: true as const, smtpResponse: "catalog" }
      : await sendMail({
          to: data.email,
          subject: "Verify your Influrios Influencer Card",
          text: `Your Influrios claim verification code is ${data.code}. Enter it to continue publishing your Influencer Card. This code does not verify a social account.`,
        });
    if (!result.ok) throw new Error(result.error);
    const { queuePreferredSms } = await import("@/lib/sms");
    await queuePreferredSms({
      email: data.email,
      body: `Your Influrios claim verification code is ${data.code}.`,
      templateKey: "claim_verification_email",
    });
    return { externalId: result.smtpResponse };
  }
  if (kind === "password_reset_email") {
    if (!data.email || !data.token) throw new Error("Password reset job is missing an address or token.");
    const origin = getAppOrigin();
    const link = `${origin}/account/reset?token=${encodeURIComponent(data.token)}`;
    const catalog = await deliverCatalogEmail({
      templateId: "account.reset",
      to: data.email,
      vars: {
        action_url: link,
        expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
        expires_in: "30 minutes",
      },
      log: false,
    });
    if (!catalog.sent && catalog.reason === "paused") throw new Error("Password reset email is paused.");
    const result = catalog.sent
      ? { ok: true as const, smtpResponse: "catalog" }
      : await sendMail({
          to: data.email,
          subject: "Reset your Influrios password",
          text: `Reset your Influrios password: ${link}. This link expires in 30 minutes.`,
        });
    if (!result.ok) throw new Error(result.error);
    return { externalId: result.smtpResponse };
  }
  if (kind === "mail_test") {
    const { sendInvitationTest } = await import("@/lib/mail");
    if (!data.to) throw new Error("Test send is missing a recipient.");
    const result = await sendInvitationTest(data.to, false);
    if (!result.ok) throw new Error(result.message);
    const match = / \((.+)\)\.$/.exec(result.message);
    return match?.[1] ? { externalId: match[1] } : undefined;
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
  if (kind === "invitation_followup_sweep") {
    await runInvitationFollowUpSweep();
    return;
  }
  if (kind === "quote_expiry_sweep") {
    await runQuoteExpirySweep();
    return;
  }
  if (kind === "collab_notification") {
    if (!data.to || !data.subject || !data.text) {
      throw new Error("Collaboration notification job is missing a recipient or copy.");
    }
    const fromName = data.catalog === "1" ? (await mailSettingsView().catch(() => null))?.fromName ?? "" : "";
    const result = await sendMail({
      to: data.to,
      subject: data.subject,
      text: data.text,
      html: data.html || undefined,
      fromName: data.catalog === "1" ? fromName : undefined,
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
      const lastSucceeded = await prisma.job.findFirst({
        where: { kind, status: "succeeded" },
        orderBy: { updatedAt: "desc" },
        select: { id: true, updatedAt: true },
      });
      return {
        kind,
        status: latest?.status ?? "never",
        at: latest?.updatedAt.toISOString() ?? null,
        lastError: latest?.lastError ?? null,
        /** Latest succeeded row id — Phase M E1 evidence. */
        succeededId: lastSucceeded?.id ?? null,
        succeededAt: lastSucceeded?.updatedAt.toISOString() ?? null,
      };
    }),
  );
  return rows;
}

async function finishQueuedJob(jobId: string): Promise<"succeeded" | "failed" | "queued" | "skipped"> {
  const claimed = await prisma.job.updateMany({
    where: { id: jobId, status: "queued" },
    data: { status: "running", attempts: { increment: 1 } },
  });
  if (claimed.count !== 1) return "skipped";
  const current = await prisma.job.findUnique({ where: { id: jobId } });
  if (!current) return "skipped";
  try {
    const outcome = await runJob(current.kind, current.payload);
    const clearCode =
      current.kind === "verification_email" ||
      current.kind === "claim_verification_email" ||
      current.kind === "password_reset_email";
    const nextPayload =
      current.payload && typeof current.payload === "object" && !Array.isArray(current.payload)
        ? { ...(current.payload as Record<string, unknown>) }
        : {};
    if (clearCode) {
      delete nextPayload.code;
      delete nextPayload.token;
    }
    if (outcome?.externalId) nextPayload.externalId = outcome.externalId;
    const payloadChanged = clearCode || Boolean(outcome?.externalId);
    await prisma.job.update({
      where: { id: jobId },
      data: {
        status: "succeeded",
        lastError: null,
        ...(payloadChanged ? { payload: nextPayload as Prisma.InputJsonValue } : {}),
      },
    });
    return "succeeded";
  } catch (error) {
    const message = error instanceof Error ? error.message : "Job failed";
    const status = nextJobStatus(current.attempts, false);
    await prisma.job.update({
      where: { id: jobId },
      data: {
        status,
        lastError: message.slice(0, 500),
        runAfter: status === "queued" ? new Date(Date.now() + 60_000) : new Date(),
      },
    });
    return status === "failed" ? "failed" : "queued";
  }
}

/** Run one queued job now — used so verification mail is not stuck behind a sweep backlog. */
export async function processJobNow(id: string) {
  return finishQueuedJob(id);
}

export async function processDueJobs(limit = 8) {
  const due = await prisma.job.findMany({
    where: { status: "queued", runAfter: { lte: new Date() } },
    orderBy: { createdAt: "asc" },
    take: limit,
  });
  let processed = 0;
  for (const job of due) {
    const result = await finishQueuedJob(job.id);
    if (result === "succeeded") processed += 1;
  }
  return { processed };
}

export async function enqueueVerificationEmail(userId: string, code: string) {
  const { mailReady } = await import("@/lib/mail");
  if (!(await mailReady())) return { queued: false };
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return { queued: false };
  const job = await prisma.job.create({
    data: {
      kind: "verification_email",
      status: "queued",
      payload: { userId, email: user.email, code },
    },
  });
  const result = await processJobNow(job.id);
  return { queued: result === "succeeded" };
}

/** Claim funnel email before a User row exists. */
export async function enqueueClaimVerificationEmail(email: string, code: string) {
  const { mailReady } = await import("@/lib/mail");
  if (!(await mailReady())) return { queued: false };
  const job = await prisma.job.create({
    data: {
      kind: "claim_verification_email",
      status: "queued",
      payload: { email: email.trim().toLowerCase(), code },
    },
  });
  const result = await processJobNow(job.id);
  return { queued: result === "succeeded" };
}

export async function enqueuePasswordResetEmail(email: string, token: string) {
  const { mailReady } = await import("@/lib/mail");
  if (!(await mailReady())) return { queued: false };
  const job = await prisma.job.create({
    data: {
      kind: "password_reset_email",
      status: "queued",
      payload: { email: email.trim().toLowerCase(), token },
    },
  });
  const result = await processJobNow(job.id);
  return { queued: result === "succeeded" };
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

export async function listFundingSweepResults() {
  return prisma.job.findMany({
    where: { kind: { in: ["milestone_auto_approval", "recurring_cycle_sweep"] } },
    orderBy: { updatedAt: "desc" },
    take: 8,
  });
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

async function partyEmails(input: { businessName: string; creatorSlug: string; workspaceId?: string | null }) {
  let businessEmail = "";
  let influencerEmail = "";
  if (input.workspaceId?.trim()) {
    const workspace = await prisma.businessWorkspace.findUnique({
      where: { id: input.workspaceId.trim() },
      include: { owner: { select: { email: true } } },
    });
    businessEmail = workspace?.owner?.email?.trim().toLowerCase() ?? "";
  }
  if (!businessEmail && input.businessName.trim()) {
    const business = await prisma.businessProfile.findFirst({
      where: { name: { equals: input.businessName, mode: "insensitive" } },
      include: { user: { select: { email: true } } },
    });
    businessEmail = business?.user.email?.trim().toLowerCase() ?? "";
  }
  const creator = await prisma.creator.findUnique({
    where: { slug: input.creatorSlug },
    include: { user: { select: { email: true } } },
  });
  influencerEmail = creator?.user?.email?.trim().toLowerCase() ?? "";
  return { businessEmail, influencerEmail };
}

async function queueCollabNotices(input: {
  kind: CollabNotificationKind;
  recipients: string[];
  legacy: { subject: string; text: string };
  vars: Record<string, string>;
  businessEmail: string;
  influencerEmail: string;
  fundingId?: string;
}) {
  let count = 0;
  for (const to of input.recipients) {
    const role = to === input.businessEmail ? "business" : to === input.influencerEmail ? "influencer" : "admin";
    const catalog = await catalogCollabMessage({ kind: input.kind, role, to, vars: input.vars });
    if (catalog && "paused" in catalog && catalog.paused) continue;
    if (catalog && "skipped" in catalog && catalog.skipped) continue;
    const live = catalog && "html" in catalog ? catalog : null;
    await prisma.job.create({
      data: {
        kind: "collab_notification",
        status: "queued",
        payload: live
          ? {
              to,
              subject: live.subject,
              text: live.text,
              html: live.html,
              catalog: "1",
              templateKey: live.templateId,
              notificationKind: input.kind,
              ...(input.fundingId ? { fundingId: input.fundingId } : {}),
            }
          : {
              to,
              subject: input.legacy.subject,
              text: input.legacy.text,
              notificationKind: input.kind,
              ...(input.fundingId ? { fundingId: input.fundingId } : {}),
            },
      },
    });
    count += 1;
  }
  return count;
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
    input.kind === "payout_returned" ||
    input.kind === "stale_funding" ||
    input.kind === "ledger_mismatch" ||
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

  const parties = await partyEmails({
    businessName: funding.businessName,
    creatorSlug: funding.creatorSlug,
    workspaceId: funding.workspaceId,
  });
  const count = await queueCollabNotices({
    kind: input.kind,
    recipients,
    legacy: rendered,
    businessEmail: parties.businessEmail,
    influencerEmail: parties.influencerEmail,
    fundingId: funding.id,
    vars: collabCatalogVars({
      business: vars.business,
      influencer: vars.influencer,
      title: vars.title,
      milestone: vars.milestone,
      detail: vars.detail,
      fundingId: funding.id,
      amounts: {
        expected: displayMoney(funding.grossCents),
        observed: displayMoney(funding.grossCents),
        payout: input.milestone ? displayMoney(funding.grossCents) : "—",
      },
    }),
  });
  if (count > 0 && input.processNow !== false) await processDueJobs();
  return { queued: count > 0, count };
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
  const parties = await partyEmails({ businessName: input.businessName, creatorSlug: input.creatorSlug });
  const count = await queueCollabNotices({
    kind: input.kind,
    recipients,
    legacy: rendered,
    businessEmail: parties.businessEmail,
    influencerEmail: parties.influencerEmail,
    vars: collabCatalogVars({
      business: input.businessName,
      influencer: creator?.displayName || input.creatorSlug,
      title: input.title,
      milestone: input.milestone,
      detail: input.detail,
    }),
  });
  if (count > 0 && input.processNow !== false) await processDueJobs();
  return { queued: count > 0, count };
}

/** W3.11 — remind businesses when a review window is about to close. */
export async function runReviewDeadlineSweep(now = new Date()) {
  const { loadProcessTimings } = await import("@/lib/process-timing");
  const leadHours = (await loadProcessTimings().catch(() => null))?.reviewDeadlineLeadHours;
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
        leadHours,
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
  const { shouldRemindDisputeSla } = await import("@/lib/collab-ops-jobs");
  const { loadProcessTimings } = await import("@/lib/process-timing");
  const slaHours = (await loadProcessTimings().catch(() => null))?.disputeSlaHours;
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
        slaHours,
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
      detail: `${dispute.reasonLabel} · open since ${dispute.createdAt.toISOString().slice(0, 10)} (${slaHours ?? "default"}h SLA)`,
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
  const { shouldWarnProviderHold } = await import("@/lib/collab-ops-jobs");
  const { loadProcessTimings } = await import("@/lib/process-timing");
  const warnHours = (await loadProcessTimings().catch(() => null))?.providerHoldWarnHours;
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
        warnHours,
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
      detail: `Held for ${ageHours}h (warn after ${warnHours ?? "default"}h). Gross ${funding.grossCents}¢ ${funding.currency}.`,
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
  const { paymentChargeEnabled } = await import("@/lib/payment-charge-switches");
  if (!(await paymentChargeEnabled("payout_retry"))) return { scanned: 0, retried: 0 };
  const { shouldRetryFailedPayout } = await import("@/lib/collab-ops-jobs");
  const { loadProcessTimings } = await import("@/lib/process-timing");
  const payoutTiming = await loadProcessTimings().catch(() => null);
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
        backoffHours: payoutTiming?.failedPayoutBackoffHours,
        maxAttempts: payoutTiming?.failedPayoutMaxAttempts,
      })
    ) {
      continue;
    }
    const { failedPayoutCommandAllowsRetry } = await import("@/lib/provider-outbox");
    const command = await prisma.providerCommand.findFirst({
      where: { fundingId: milestone.fundingId, milestoneId: milestone.id, operation: "release" },
      orderBy: { createdAt: "desc" },
    });
    if (!failedPayoutCommandAllowsRetry(command?.status)) continue;
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
      kind: "payout_retry",
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
  const { shouldFlagStaleFundingIntent, shouldFlagLedgerMismatch } = await import("@/lib/collab-ops-jobs");
  const { loadProcessTimings } = await import("@/lib/process-timing");
  const staleHours = (await loadProcessTimings().catch(() => null))?.staleFundingHours;
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
        staleHours,
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
      kind: "stale_funding",
      detail: `Stale funding intent still awaiting provider after ${staleHours ?? "default"}h.`,
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
      kind: "ledger_mismatch",
      detail: `Ledger/provider mismatch: held ${reconciled.heldCents}¢ / released ${reconciled.releasedCents}¢ / refunded ${reconciled.refundedCents}¢ vs gross ${funding.grossCents}¢.`,
      processNow: false,
    });
  }
  if (flagged > 0) await processDueJobs();
  return { scanned: awaiting.length + held.length, flagged };
}

export async function runInvitationFollowUpSweep(now = new Date()) {
  const due = await prisma.creatorInvitation.findMany({
    where: {
      followUpAt: { lte: now },
      claimedAt: null,
      email: { not: null },
      status: { in: ["queued", "sent", "opened"] },
      expiresAt: { gt: now },
    },
    take: 40,
    orderBy: { followUpAt: "asc" },
  });
  let sent = 0;
  for (const invitation of due) {
    if (!invitation.email) continue;
    const already = await prisma.invitationEvent.findFirst({
      where: { invitationId: invitation.id, kind: "follow_up_sent" },
    });
    if (already) continue;
    const result = await deliverCatalogEmail({
      templateId: "account.claim_followup",
      to: invitation.email,
      vars: {
        first_name: invitation.displayName.split(/\s+/)[0] || invitation.displayName,
        action_url: `${getAppOrigin().replace(/\/$/, "")}/invite/${invitation.token}`,
        expires_at: invitation.expiresAt.toISOString().slice(0, 10),
      },
    });
    if (!result.sent && result.reason !== "switch_off") continue;
    if (!result.sent) {
      const mailed = await sendMail({
        to: invitation.email,
        subject: "Your Influrios Card invitation is still open",
        text: `Your Influrios Card invitation is still open: ${getAppOrigin().replace(/\/$/, "")}/invite/${invitation.token}`,
      });
      if (!mailed.ok) continue;
    }
    await prisma.invitationEvent.create({
      data: { invitationId: invitation.id, kind: "follow_up_sent", actor: "smtp", detail: invitation.email },
    });
    sent += 1;
  }
  return { scanned: due.length, sent };
}

export async function runQuoteExpirySweep(now = new Date()) {
  const horizon = new Date(now.getTime() + 48 * 60 * 60 * 1000);
  const documents = await prisma.contractDocument.findMany({
    where: { status: { in: ["draft", "sent"] } },
    include: { parties: true },
    orderBy: { updatedAt: "desc" },
    take: 40,
  });
  let sent = 0;
  for (const document of documents) {
    const terms = document.termsSnapshotJson;
    const plan =
      terms && typeof terms === "object" && "financialPlan" in terms
        ? (terms as { financialPlan?: { signedQuote?: { validUntil?: unknown } } }).financialPlan
        : null;
    const raw = plan?.signedQuote?.validUntil;
    if (typeof raw !== "string") continue;
    const until = new Date(raw);
    if (Number.isNaN(until.getTime()) || until <= now || until > horizon) continue;
    const already = await prisma.auditLog.findFirst({
      where: { action: "email_quote_expiring", objectType: "ContractDocument", objectId: document.id },
    });
    if (already) continue;
    const pending = document.parties.filter((party) => party.status === "pending" && party.email.includes("@"));
    for (const party of pending) {
      await deliverCatalogEmail({
        templateId: "contract.quote_expiring",
        to: party.email,
        vars: {
          first_name: party.name.split(/\s+/)[0] || "",
          collaboration_name: document.title,
          expires_at: until.toISOString(),
          quote_version: "signed quote",
          action_url: `${getAppOrigin().replace(/\/$/, "")}/collaboration/contracts/${document.id}`,
        },
      });
    }
    if (pending.length) {
      await prisma.auditLog.create({
        data: {
          actor: "system",
          action: "email_quote_expiring",
          objectType: "ContractDocument",
          objectId: document.id,
          after: { until: until.toISOString(), recipients: pending.length },
        },
      });
      sent += pending.length;
    }
  }
  return { scanned: documents.length, sent };
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
export async function runScheduledReleaseSweep(now = new Date(), onlyMilestoneId?: string) {
  const { markUnknownProviderCommands } = await import("@/lib/provider-outbox");
  await markUnknownProviderCommands(now);
  const { releasePushAuthorized, shouldRequestScheduledRelease } = await import("@/lib/collab-ops-jobs");
  const { getLaunchGate } = await import("@/lib/launch-gate");
  if (!onlyMilestoneId) {
    const { scheduleApprovedMilestones } = await import("@/lib/marketplace-ledger");
    await scheduleApprovedMilestones(now);
  }
  const launchGate = await getLaunchGate().catch(() => null);
  const approvalOn = launchGate?.automaticReleaseApprovalEnabled === true;
  const providerOn = launchGate?.automaticProviderReleaseEnabled === true;
  const { releasableCents } = await import("@/lib/ledger");
  const { splitMilestoneRelease } = await import("@/lib/account-purpose");
  const { readShareSnapshot, shareLines } = await import("@/lib/fx-share");
  const { adapterForProvider } = await import("@/lib/payment-provider-adapter");
  const { verifyMarketplaceSignature } = await import("@/lib/ledger");
  const due = await prisma.fundingMilestone.findMany({
    where: onlyMilestoneId
      ? { id: onlyMilestoneId, status: "release_scheduled", funding: { status: "held" } }
      : {
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
    if (!onlyMilestoneId && !providerOn) continue;
    if (
      !releasePushAuthorized({
        automaticReleaseApproval: approvalOn,
        releaseApprovedAt: milestone.releaseApprovedAt,
      })
    ) {
      continue;
    }
    const amount = releasableCents(milestone.amountCents, milestone.refundedCents);
    if (amount <= 0) continue;
    const plan = (milestone.funding.feeSnapshotJson as { financialPlan?: unknown } | null)?.financialPlan;
    const { readSignedDealMoney } = await import("@/lib/payment-engine");
    const { claimProviderCommand, recordProviderCommandResult, releaseInstructionAmount } = await import(
      "@/lib/provider-outbox"
    );
    const signed = readSignedDealMoney(plan);
    const siblings = await prisma.fundingMilestone.findMany({
      where: {
        fundingId: milestone.fundingId,
        id: { not: milestone.id },
        status: { in: ["released", "release_requested"] },
      },
      select: { amountCents: true, refundedCents: true },
    });
    const alreadyReleasedCents = siblings.reduce(
      (sum, row) => sum + releasableCents(row.amountCents, row.refundedCents),
      0,
    );
    const planned = releaseInstructionAmount({
      releasableCents: amount,
      signedInfluencerReceivesCents: signed?.influencerReceivesCents ?? null,
      alreadyReleasedCents,
    });
    if (!planned.ok) {
      await prisma.auditLog
        .create({
          data: {
            actor: "system",
            action: "milestone_release_skipped",
            objectType: "FundingMilestone",
            objectId: milestone.id,
            after: { fundingId: milestone.fundingId, error: planned.error, at: now.toISOString() },
          },
        })
        .catch(() => undefined);
      continue;
    }
    const agreementVersion =
      plan && typeof plan === "object" && "signedQuote" in plan
        ? Number((plan as { signedQuote?: { agreementVersion?: number } }).signedQuote?.agreementVersion ?? 1)
        : 1;
    const claim = await claimProviderCommand({
      agreementVersion: Number.isInteger(agreementVersion) ? agreementVersion : 1,
      fundingId: milestone.fundingId,
      milestoneId: milestone.id,
      operation: "release",
      amountCents: planned.amountCents,
      currency: milestone.funding.currency,
    });
    if (!claim.dispatch) continue;
    const parties = readShareSnapshot(milestone.funding.shareSnapshotJson);
    const legs = signed
      ? { creatorCents: planned.amountCents, feeCents: 0 }
      : splitMilestoneRelease({
          releasableCents: amount,
          fundingGrossCents: milestone.funding.grossCents,
          fundingFeeCents: milestone.funding.feeCents,
          financialPlanJson: plan,
          milestoneTitle: milestone.title,
        });
    const lines = parties && legs.creatorCents > 0 ? shareLines(legs.creatorCents, parties) : null;
    const adapter = await adapterForProvider(milestone.funding.providerCode, {
      verifySignature: verifyMarketplaceSignature,
    });
    let instruction: Awaited<ReturnType<typeof adapter.createReleaseOrTransfer>>;
    try {
      instruction = await adapter.createReleaseOrTransfer({
        fundingId: milestone.fundingId,
        milestoneId: milestone.id,
        amountCents: planned.amountCents,
        shares: lines?.map((line) => ({ label: line.label, amountCents: line.amountCents })),
      });
    } catch {
      await recordProviderCommandResult({ commandId: claim.commandId, ok: false });
      continue;
    }
    if (!instruction.ok) {
      await recordProviderCommandResult({ commandId: claim.commandId, ok: false });
      continue;
    }
    if (instruction.execution === "external") {
      await prisma.providerCommand.updateMany({
        where: { id: claim.commandId, status: "pending" },
        data: { status: "external", providerRef: instruction.reference.slice(0, 180), dispatchedAt: new Date() },
      });
      await prisma.auditLog
        .create({
          data: {
            actor: "system",
            action: "milestone_release_external",
            objectType: "FundingMilestone",
            objectId: milestone.id,
            after: {
              fundingId: milestone.fundingId,
              reference: instruction.reference,
              amountCents: planned.amountCents,
              at: now.toISOString(),
            },
          },
        })
        .catch(() => undefined);
      continue;
    }
    await recordProviderCommandResult({
      commandId: claim.commandId,
      ok: true,
      providerRef: instruction.reference,
    });
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
            amountCents: planned.amountCents,
            at: now.toISOString(),
          },
        },
      })
      .catch(() => undefined);
    await notifyCollabFundingEvent({
      fundingId: milestone.fundingId,
      kind: "payout_requested",
      milestone: milestone.title,
      detail: `Provider release requested (${instruction.reference}); awaiting signed payout.released.`,
      processNow: false,
    });
  }
  if (requested > 0) await processDueJobs();
  return { scanned: due.length, requested };
}

/** Admin send. The provider switch does not have to be on. The payout still needs push approval. */
export async function pushScheduledRelease(milestoneId: string) {
  const milestone = await prisma.fundingMilestone.findUnique({ where: { id: milestoneId } });
  if (!milestone || milestone.status !== "release_scheduled") {
    return { ok: false as const, error: "That milestone is not waiting to be sent." };
  }
  const { getLaunchGate } = await import("@/lib/launch-gate");
  const { releasePushAuthorized } = await import("@/lib/collab-ops-jobs");
  const gate = await getLaunchGate().catch(() => null);
  if (
    !releasePushAuthorized({
      automaticReleaseApproval: gate?.automaticReleaseApprovalEnabled === true,
      releaseApprovedAt: milestone.releaseApprovedAt,
    })
  ) {
    return { ok: false as const, error: "Approve the payout before sending it to the provider." };
  }
  const result = await runScheduledReleaseSweep(new Date(), milestoneId);
  if (result.requested !== 1) {
    const command = await prisma.providerCommand.findFirst({
      where: { fundingId: milestone.fundingId, milestoneId: milestone.id, operation: "release" },
      orderBy: { createdAt: "desc" },
    });
    if (command?.status === "external") {
      return {
        ok: false as const,
        error: "This route records the payout for external handling. It does not send the payout.",
      };
    }
    return { ok: false as const, error: "The provider did not accept the payout instruction." };
  }
  return { ok: true as const };
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
