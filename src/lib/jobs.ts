import { prisma } from "@/lib/db";
import { getAppOrigin } from "@/lib/billing";
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
