/**
 * Support tickets. The /support form opens a ticket; staff answer from Admin → Support tickets; the requester
 * follows and replies on their ticket page (signed in, or from the private link in their email).
 */
import { randomBytes, timingSafeEqual } from "crypto";
import { prisma } from "@/lib/db";

export const TICKET_STATUSES = ["open", "waiting_on_member", "resolved", "closed"] as const;
export type TicketStatus = (typeof TICKET_STATUSES)[number];

export const TICKET_STATUS_LABEL: Record<TicketStatus, string> = {
  open: "Open",
  waiting_on_member: "Waiting on member",
  resolved: "Resolved",
  closed: "Closed",
};

/** What the requester sees for each status. */
export const TICKET_STATUS_MEMBER_LABEL: Record<TicketStatus, string> = {
  open: "With our team",
  waiting_on_member: "Waiting for your reply",
  resolved: "Resolved",
  closed: "Closed",
};

export function ticketStatus(value: string): TicketStatus {
  return (TICKET_STATUSES as readonly string[]).includes(value) ? (value as TicketStatus) : "open";
}

export function ticketRef(number: number) {
  return `S-${number}`;
}

export function newTicketToken() {
  return randomBytes(24).toString("base64url");
}

/** Constant-time token check; an empty or wrong-length token never matches. */
export function tokenMatches(expected: string, given: string | null | undefined) {
  const a = Buffer.from(expected);
  const b = Buffer.from(String(given ?? ""));
  return a.length > 0 && a.length === b.length && timingSafeEqual(a, b);
}

export function cleanReply(body: string) {
  const text = body.trim().slice(0, 4000);
  if (text.length < 2) return { ok: false as const, error: "Write a reply first." };
  return { ok: true as const, text };
}

/** A member reply re-opens a ticket that was waiting on them or resolved; a closed ticket stays closed. */
export function statusAfterMemberReply(current: TicketStatus): TicketStatus | null {
  if (current === "closed") return null;
  return "open";
}

function appOrigin() {
  return (process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || "https://influrios.com").replace(/\/+$/, "");
}

export function memberTicketUrl(ticket: { id: string; accessToken: string }) {
  return `${appOrigin()}/support/tickets/${ticket.id}?t=${encodeURIComponent(ticket.accessToken)}`;
}

async function staffRecipients() {
  const { getSupportSettings } = await import("@/lib/support");
  const settings = await getSupportSettings();
  if (settings.email) return [settings.email];
  const admins = await prisma.adminUser
    .findMany({ where: { active: true }, select: { email: true }, take: 3, orderBy: { createdAt: "asc" } })
    .catch(() => []);
  return admins.map((row) => row.email).filter(Boolean);
}

async function mail(to: string, subject: string, text: string, replyTo?: string) {
  const { sendMail } = await import("@/lib/mail");
  return sendMail({ to, subject, text, ...(replyTo ? { replyTo } : {}) }).catch(() => ({ ok: false as const, error: "send failed" }));
}

/** Tell staff about a new ticket or a member reply. Mail failures never lose the ticket. */
async function notifyStaff(ticket: { id: string; number: number; subject: string; requesterName: string; requesterEmail: string }, lead: string, body: string) {
  const recipients = await staffRecipients();
  const text = [
    lead,
    `From: ${ticket.requesterName} <${ticket.requesterEmail}>`,
    "",
    body,
    "",
    `Open the ticket: ${appOrigin()}/admin/support/${ticket.id}`,
  ].join("\n");
  for (const to of recipients) {
    await mail(to, `[${ticketRef(ticket.number)}] ${ticket.subject}`, text);
  }
}

export type NewTicketInput = {
  name: string;
  email: string;
  topic: string;
  message: string;
  reference: string;
  userId: string | null;
};

export async function createSupportTicket(input: NewTicketInput) {
  // A few tickets per sender per hour is plenty; more is almost always a loop or abuse.
  const recent = await prisma.supportTicket
    .count({ where: { requesterEmail: input.email, createdAt: { gte: new Date(Date.now() - 60 * 60_000) } } })
    .catch(() => 0);
  if (recent >= 5) {
    return { ok: false as const, error: "We've received several requests from you in the last hour. We'll reply to those first." };
  }
  const subject = input.reference ? `${input.topic} · ${input.reference}` : input.topic;
  const ticket = await prisma.supportTicket.create({
    data: {
      subject: subject.slice(0, 200),
      topic: input.topic,
      requesterName: input.name,
      requesterEmail: input.email,
      userId: input.userId,
      reference: input.reference,
      accessToken: newTicketToken(),
      messages: { create: { author: "member", authorName: input.name, body: input.message } },
    },
  });
  await prisma.auditLog
    .create({ data: { actor: input.email, action: "support.ticket_opened", objectType: "SupportTicket", objectId: ticket.id, after: { number: ticket.number, topic: input.topic } } })
    .catch(() => undefined);
  const ref = ticketRef(ticket.number);
  await notifyStaff(ticket, `New support ticket ${ref} · ${input.topic}${input.reference ? ` · Reference: ${input.reference}` : ""}`, input.message);
  await mail(
    input.email,
    `We got your request (${ref})`,
    [
      `Hi ${input.name},`,
      "",
      `Thanks for contacting Influrios support. Your request is ticket ${ref}. We'll email you when we reply.`,
      "",
      `See the conversation or add details here: ${memberTicketUrl(ticket)}`,
      "",
      "Please reply on that page rather than to this email, so your message reaches the ticket.",
    ].join("\n"),
  );
  return { ok: true as const, id: ticket.id, number: ticket.number, token: ticket.accessToken };
}

/** The requester's view: signed in as the ticket's account or holding the emailed token. */
export async function ticketForRequester(id: string, input: { token?: string | null; userId?: string | null; email?: string | null }) {
  const ticket = await prisma.supportTicket
    .findUnique({
      where: { id },
      include: { messages: { where: { author: { not: "note" } }, orderBy: { createdAt: "asc" } } },
    })
    .catch(() => null);
  if (!ticket) return null;
  const byToken = tokenMatches(ticket.accessToken, input.token);
  const byAccount =
    (Boolean(input.userId) && ticket.userId === input.userId) ||
    (Boolean(input.email) && ticket.requesterEmail === String(input.email).trim().toLowerCase());
  return byToken || byAccount ? ticket : null;
}

export async function listTicketsForMember(input: { userId: string; email: string }) {
  return prisma.supportTicket
    .findMany({
      where: { OR: [{ userId: input.userId }, { requesterEmail: input.email.trim().toLowerCase() }] },
      orderBy: { lastActivityAt: "desc" },
      take: 20,
      select: { id: true, number: true, subject: true, status: true, lastActivityAt: true },
    })
    .catch(() => []);
}

export async function addMemberReply(input: { id: string; token?: string | null; userId?: string | null; email?: string | null; body: string }) {
  const ticket = await ticketForRequester(input.id, input);
  if (!ticket) return { ok: false as const, error: "That ticket was not found." };
  const reply = cleanReply(input.body);
  if (!reply.ok) return reply;
  const next = statusAfterMemberReply(ticketStatus(ticket.status));
  if (!next) return { ok: false as const, error: "This ticket is closed. Open a new request on the support page." };
  await prisma.$transaction([
    prisma.supportTicketMessage.create({ data: { ticketId: ticket.id, author: "member", authorName: ticket.requesterName, body: reply.text } }),
    prisma.supportTicket.update({ where: { id: ticket.id }, data: { status: next, lastActivityAt: new Date() } }),
  ]);
  await notifyStaff(ticket, `${ticket.requesterName} replied on ${ticketRef(ticket.number)}`, reply.text);
  return { ok: true as const };
}

export async function memberResolveTicket(input: { id: string; token?: string | null; userId?: string | null; email?: string | null }) {
  const ticket = await ticketForRequester(input.id, input);
  if (!ticket) return { ok: false as const, error: "That ticket was not found." };
  if (ticket.status === "closed") return { ok: true as const };
  await prisma.supportTicket.update({ where: { id: ticket.id }, data: { status: "resolved", lastActivityAt: new Date() } });
  return { ok: true as const };
}

// ---------- Staff ----------

export async function listTicketsForStaff(input: { status?: string; q?: string }) {
  const status = input.status && input.status !== "all" ? ticketStatus(input.status) : null;
  const q = (input.q ?? "").trim();
  const number = /^s?-?(\d+)$/i.exec(q)?.[1];
  const where = {
    ...(status ? { status } : {}),
    ...(q
      ? {
          OR: [
            ...(number ? [{ number: Number(number) }] : []),
            { requesterEmail: { contains: q.toLowerCase() } },
            { requesterName: { contains: q, mode: "insensitive" as const } },
            { subject: { contains: q, mode: "insensitive" as const } },
            { reference: { contains: q, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };
  const [rows, counts] = await Promise.all([
    prisma.supportTicket
      .findMany({
        where,
        orderBy: [{ lastActivityAt: "desc" }],
        take: 100,
        include: { messages: { orderBy: { createdAt: "desc" }, take: 1, select: { author: true, body: true } } },
      })
      .catch(() => []),
    prisma.supportTicket.groupBy({ by: ["status"], _count: { _all: true } }).catch(() => []),
  ]);
  const countByStatus = Object.fromEntries(counts.map((row) => [row.status, row._count._all])) as Partial<Record<TicketStatus, number>>;
  return { rows, countByStatus };
}

export async function openTicketCount() {
  return prisma.supportTicket.count({ where: { status: "open" } }).catch(() => 0);
}

export async function ticketForStaff(id: string) {
  return prisma.supportTicket
    .findUnique({ where: { id }, include: { messages: { orderBy: { createdAt: "asc" } } } })
    .catch(() => null);
}

export async function staffReply(input: { id: string; staffEmail: string; staffName: string; body: string; status: string }) {
  const ticket = await prisma.supportTicket.findUnique({ where: { id: input.id } });
  if (!ticket) return { ok: false as const, error: "Ticket not found." };
  const reply = cleanReply(input.body);
  if (!reply.ok) return reply;
  const status = input.status ? ticketStatus(input.status) : "waiting_on_member";
  await prisma.$transaction([
    prisma.supportTicketMessage.create({ data: { ticketId: ticket.id, author: "staff", authorName: input.staffName || "Influrios support", body: reply.text } }),
    prisma.supportTicket.update({
      where: { id: ticket.id },
      data: { status, lastActivityAt: new Date(), assignedTo: ticket.assignedTo || input.staffEmail },
    }),
  ]);
  await prisma.auditLog
    .create({ data: { actor: input.staffEmail, action: "support.ticket_replied", objectType: "SupportTicket", objectId: ticket.id, after: { status } } })
    .catch(() => undefined);
  const ref = ticketRef(ticket.number);
  const sent = await mail(
    ticket.requesterEmail,
    `Re: ${ticket.subject} (${ref})`,
    [
      `Hi ${ticket.requesterName},`,
      "",
      reply.text,
      "",
      "— Influrios support",
      "",
      status === "resolved" || status === "closed"
        ? `We've marked ticket ${ref} as ${TICKET_STATUS_LABEL[status].toLowerCase()}. If you still need help, reply here: ${memberTicketUrl(ticket)}`
        : `Reply or add details here: ${memberTicketUrl(ticket)}`,
    ].join("\n"),
  );
  return { ok: true as const, emailed: sent.ok };
}

export async function staffNote(input: { id: string; staffEmail: string; staffName: string; body: string }) {
  const note = cleanReply(input.body);
  if (!note.ok) return note;
  const ticket = await prisma.supportTicket.findUnique({ where: { id: input.id }, select: { id: true } });
  if (!ticket) return { ok: false as const, error: "Ticket not found." };
  await prisma.supportTicketMessage.create({ data: { ticketId: ticket.id, author: "note", authorName: input.staffName || input.staffEmail, body: note.text } });
  return { ok: true as const };
}

export async function staffSetStatus(input: { id: string; staffEmail: string; status: string }) {
  const status = ticketStatus(input.status);
  const ticket = await prisma.supportTicket.findUnique({ where: { id: input.id }, select: { id: true, status: true } });
  if (!ticket) return { ok: false as const, error: "Ticket not found." };
  if (ticket.status === status) return { ok: true as const };
  await prisma.supportTicket.update({ where: { id: ticket.id }, data: { status, lastActivityAt: new Date() } });
  await prisma.auditLog
    .create({ data: { actor: input.staffEmail, action: "support.ticket_status", objectType: "SupportTicket", objectId: ticket.id, before: { status: ticket.status }, after: { status } } })
    .catch(() => undefined);
  return { ok: true as const };
}

export async function staffAssign(input: { id: string; staffEmail: string; assignee: string }) {
  await prisma.supportTicket.update({ where: { id: input.id }, data: { assignedTo: input.assignee.trim().toLowerCase().slice(0, 200) } }).catch(() => null);
  return { ok: true as const };
}
