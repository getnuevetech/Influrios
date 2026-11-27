/**
 * Support contact: the /support form opens a support ticket (see support-tickets.ts). The admin-set support
 * email address is notified of new tickets and member replies (falling back to active admins).
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

/** Open a support ticket from the contact form. Returns the ticket reference shown to the sender. */
export async function sendSupportMessage(input: SupportMessageInput) {
  const checked = validateSupportMessage(input);
  if (!checked.ok) return checked;
  const { createSupportTicket, ticketRef } = await import("@/lib/support-tickets");
  const created = await createSupportTicket({ ...checked.value, userId: input.accountId ?? null });
  if (!created.ok) return created;
  return { ok: true as const, ticket: ticketRef(created.number), id: created.id, token: created.token };
}
