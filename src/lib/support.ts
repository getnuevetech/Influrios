/**
 * Support contact: an admin-set support email address and the /support contact form.
 * Messages are emailed to the support address (falling back to active admins) with the sender as Reply-To.
 */
import { prisma } from "@/lib/db";

export const SUPPORT_KEY = "site.support";

export type SupportSettings = { email: string };

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function readSupportSettings(value: unknown): SupportSettings {
  const row = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  const email = typeof row.email === "string" ? row.email.trim().toLowerCase().slice(0, 200) : "";
  return { email: EMAIL.test(email) ? email : "" };
}

export async function getSupportSettings(): Promise<SupportSettings> {
  const row = await prisma.platformSetting.findUnique({ where: { key: SUPPORT_KEY } }).catch(() => null);
  return readSupportSettings(row?.value);
}

export async function saveSupportSettings(input: { email: string }) {
  const email = input.email.trim().toLowerCase();
  if (email && !EMAIL.test(email)) return { ok: false as const, error: "Enter a valid support email address, or leave it blank." };
  const value = { email };
  await prisma.platformSetting.upsert({ where: { key: SUPPORT_KEY }, create: { key: SUPPORT_KEY, value }, update: { value } });
  return { ok: true as const };
}

export const SUPPORT_TOPICS = [
  "Account and sign-in",
  "Payments and payouts",
  "A collaboration or agreement",
  "Plans and billing",
  "Report a problem",
  "Something else",
] as const;

export type SupportMessageInput = {
  name: string;
  email: string;
  topic: string;
  message: string;
  reference?: string;
  /** Honeypot: must stay empty. */
  website?: string;
  accountId?: string | null;
};

export function validateSupportMessage(input: SupportMessageInput) {
  const name = input.name.trim().slice(0, 120);
  const email = input.email.trim().toLowerCase().slice(0, 200);
  const topic = (SUPPORT_TOPICS as readonly string[]).includes(input.topic) ? input.topic : "Something else";
  const message = input.message.trim().slice(0, 4000);
  const reference = (input.reference ?? "").trim().slice(0, 120);
  if (input.website?.trim()) return { ok: false as const, error: "spam" };
  if (!name) return { ok: false as const, error: "Enter your name." };
  if (!EMAIL.test(email)) return { ok: false as const, error: "Enter an email address we can reply to." };
  if (message.length < 10) return { ok: false as const, error: "Tell us a little more (at least 10 characters)." };
  return { ok: true as const, value: { name, email, topic, message, reference } };
}

/** Email the message to support. Returns a short reference shown to the sender. */
export async function sendSupportMessage(input: SupportMessageInput) {
  const checked = validateSupportMessage(input);
  if (!checked.ok) return checked;
  const { name, email, topic, message, reference } = checked.value;
  // A few messages per sender per hour is plenty; more is almost always a loop or abuse.
  const recent = await prisma.auditLog
    .count({ where: { action: "support.message", objectId: email, createdAt: { gte: new Date(Date.now() - 60 * 60_000) } } })
    .catch(() => 0);
  if (recent >= 5) return { ok: false as const, error: "We've received several messages from you in the last hour. We'll reply to those first." };
  const settings = await getSupportSettings();
  const recipients = settings.email
    ? [settings.email]
    : (await prisma.adminUser.findMany({ where: { active: true }, select: { email: true }, take: 3, orderBy: { createdAt: "asc" } }).catch(() => []))
        .map((row) => row.email)
        .filter(Boolean);
  if (recipients.length === 0) return { ok: false as const, error: "Support is not set up yet. Please try again later." };
  const ticket = `S-${Date.now().toString(36).toUpperCase()}`;
  const { sendMail } = await import("@/lib/mail");
  const text = [
    `Support request ${ticket}`,
    `From: ${name} <${email}>`,
    `Topic: ${topic}`,
    reference ? `Reference: ${reference}` : "",
    input.accountId ? `Signed-in account: ${input.accountId}` : "Not signed in",
    "",
    message,
  ]
    .filter((line) => line !== "")
    .join("\n");
  for (const to of recipients) {
    const sent = await sendMail({ to, subject: `[Support ${ticket}] ${topic}`, text, replyTo: email });
    if (!sent.ok) return { ok: false as const, error: "Your message could not be sent right now. Please try again in a moment." };
  }
  await prisma.auditLog
    .create({ data: { actor: email, action: "support.message", objectType: "Support", objectId: email, after: { ticket, topic } } })
    .catch(() => undefined);
  return { ok: true as const, ticket };
}
