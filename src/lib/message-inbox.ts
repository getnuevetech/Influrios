/**
 * One conversation is one thread id built from the contract and who can already read it.
 * all:{contractId} is the shared thread. party:{contractId}:{partyA}:{partyB} is private,
 * with the two party ids sorted. A collaboration opens the same contract, so it is the same id.
 */
import {
  adoptUnboundContractParty,
  messageVisible,
  postContractMessage,
  resolveContractPartyForAccount,
  type MessageAudience,
} from "@/lib/contract-document";
import { prisma } from "@/lib/db";

export type InboxParty = {
  id: string;
  role: string;
  name: string;
  email: string;
  userId: string | null;
};

export type InboxMessage = {
  id: string;
  documentId: string;
  senderUserId: string | null;
  senderAdminId: string | null;
  senderName: string;
  body: string;
  audience: string;
  recipientPartyId: string | null;
  createdAt: Date;
};

export type InboxDocument = {
  id: string;
  title: string;
  fundingId?: string | null;
  collaborationId?: string | null;
  parties: InboxParty[];
  messages: InboxMessage[];
};

export type InboxSource = {
  via: "contract" | "collaboration";
  document: InboxDocument;
};

export type InboxThread = {
  id: string;
  documentId: string;
  contractRef: string;
  campaign: string;
  otherParty: string;
  otherInitials: string;
  participants: string[];
  latestSender: string;
  latestFromViewer: boolean;
  preview: string;
  previewLine: string;
  at: string;
  timeLabel: string;
  unread: boolean;
  sharedTitle: boolean;
  fundingId: string | null;
};

export type ThreadMessageView = {
  id: string;
  senderName: string;
  body: string;
  timeLabel: string;
  fromViewer: boolean;
  initials: string;
};

export type ThreadView = {
  thread: InboxThread;
  messages: ThreadMessageView[];
  visibleTo: string;
  replyRecipients: string;
  contractHref: string;
};

export type OpenThreadResult = { ok: true; view: ThreadView } | { ok: false; error: string };

type PartyViewer = { kind: "party"; userId: string; partyId: string };
type AdminViewer = { kind: "admin"; userId: string; roleId: string; permissions: string[] };
type ThreadViewer = PartyViewer | AdminViewer;

type ThreadAccess =
  | {
      ok: true;
      party: InboxParty;
      audience: "all_parties" | "party";
      recipientPartyId: string | null;
      threadId: string;
      partyIds: string[];
    }
  | { ok: false; error: string };

const SEGMENT = "[A-Za-z0-9_-]{1,80}";

export function denied(action: "read" | "reply") {
  return action === "read" ? "You cannot read this conversation." : "You cannot reply to this conversation.";
}

export function parseThreadId(threadId: string):
  | { kind: "all"; documentId: string }
  | { kind: "party"; documentId: string; partyIds: string[] }
  | { kind: "staff"; documentId: string; audience: "admin" | "contract_manager" }
  | null {
  if (!threadId || threadId.length > 200) return null;
  const all = new RegExp(`^all:(${SEGMENT})$`).exec(threadId);
  if (all) return { kind: "all", documentId: all[1] };
  const staff = new RegExp(`^(admin|manager):(${SEGMENT})$`).exec(threadId);
  if (staff) {
    return {
      kind: "staff",
      documentId: staff[2],
      audience: staff[1] === "admin" ? "admin" : "contract_manager",
    };
  }
  const party = new RegExp(`^party:(${SEGMENT}):(${SEGMENT})(?::(${SEGMENT}))?$`).exec(threadId);
  if (!party) return null;
  const partyIds = [party[2], party[3]].filter((id): id is string => Boolean(id));
  return { kind: "party", documentId: party[1], partyIds };
}

export function messageThreadId(
  message: Pick<InboxMessage, "id" | "documentId" | "audience" | "recipientPartyId" | "senderUserId">,
  parties: Pick<InboxParty, "id" | "userId">[],
  viewer?: { userId: string; partyId: string },
) {
  if (message.audience === "all_parties") return `all:${message.documentId}`;
  if (message.audience === "admin") return `admin:${message.documentId}`;
  if (message.audience === "contract_manager") return `manager:${message.documentId}`;
  if (message.audience !== "party") return `note:${message.documentId}:${message.id}`;
  const sender = senderPartyId(message, parties, viewer);
  const ids = [...new Set([sender, message.recipientPartyId].filter((id): id is string => Boolean(id)))].sort();
  if (ids.length === 0) return `note:${message.documentId}:${message.id}`;
  return `party:${message.documentId}:${ids.join(":")}`;
}

function senderPartyId(
  message: { senderUserId: string | null },
  parties: Pick<InboxParty, "id" | "userId">[],
  viewer?: { userId: string; partyId: string },
) {
  if (!message.senderUserId) return null;
  const match = parties.find((party) => party.userId && party.userId === message.senderUserId);
  if (match) return match.id;
  if (viewer && message.senderUserId === viewer.userId) return viewer.partyId;
  return null;
}

export function asInboxDocument(document: {
  id: string;
  title: string;
  fundingId?: string | null;
  collaborationId?: string | null;
  parties: InboxParty[];
  messages: Array<Omit<InboxMessage, "createdAt"> & { createdAt: Date | string }>;
}): InboxDocument {
  return {
    id: document.id,
    title: document.title,
    fundingId: document.fundingId ?? null,
    collaborationId: document.collaborationId ?? null,
    parties: document.parties.map((party) => ({
      id: party.id,
      role: party.role,
      name: party.name,
      email: party.email,
      userId: party.userId,
    })),
    messages: document.messages.map((message) => ({
      id: message.id,
      documentId: message.documentId,
      senderUserId: message.senderUserId,
      senderAdminId: message.senderAdminId,
      senderName: message.senderName,
      body: message.body,
      audience: message.audience,
      recipientPartyId: message.recipientPartyId,
      createdAt: message.createdAt instanceof Date ? message.createdAt : new Date(message.createdAt),
    })),
  };
}

export function readableContractMessages(document: InboxDocument, viewer: ThreadViewer) {
  const seen = new Set<string>();
  const partyViewer = viewer.kind === "party" ? { userId: viewer.userId, partyId: viewer.partyId } : undefined;
  const rows: Array<InboxMessage & { threadId: string }> = [];
  for (const message of document.messages) {
    if (seen.has(message.id)) continue;
    if (
      !messageVisible({
        audience: message.audience,
        recipientPartyId: message.recipientPartyId,
        senderUserId: message.senderUserId,
        senderAdminId: message.senderAdminId,
        viewer,
      })
    ) {
      continue;
    }
    seen.add(message.id);
    rows.push({ ...message, threadId: messageThreadId(message, document.parties, partyViewer) });
  }
  return rows;
}

export function threadAccess(input: {
  threadId: string;
  document: InboxDocument;
  account: { id: string; email: string };
  action: "read" | "reply";
}): ThreadAccess {
  const deny = { ok: false as const, error: denied(input.action) };
  const parsed = parseThreadId(input.threadId);
  if (!parsed || parsed.kind === "staff" || parsed.documentId !== input.document.id) return deny;
  const party = resolveContractPartyForAccount(input.document.parties, input.account);
  if (!party) return deny;
  if (parsed.kind === "all") {
    return {
      ok: true,
      party,
      audience: "all_parties",
      recipientPartyId: null,
      threadId: `all:${input.document.id}`,
      partyIds: input.document.parties.map((row) => row.id),
    };
  }
  if (parsed.partyIds.length === 0 || parsed.partyIds.some((id) => !input.document.parties.some((row) => row.id === id))) {
    return deny;
  }
  if (!parsed.partyIds.includes(party.id)) return deny;
  const canonical = `party:${input.document.id}:${[...parsed.partyIds].sort().join(":")}`;
  if (input.threadId !== canonical) return deny;
  if (input.action === "reply" && parsed.partyIds.length !== 2) return deny;
  const recipient = parsed.partyIds.find((id) => id !== party.id) ?? null;
  if (input.action === "reply" && !recipient) return deny;
  return {
    ok: true,
    party,
    audience: "party",
    recipientPartyId: recipient,
    threadId: canonical,
    partyIds: [...parsed.partyIds],
  };
}

export function partyInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
}

export function messagePreview(body: string) {
  const text = body.replace(/\s+/g, " ").trim();
  if (text.length <= 140) return text;
  return `${text.slice(0, 139)}…`;
}

export function previewLine(input: { senderName: string; fromViewer: boolean; body: string }) {
  const preview = messagePreview(input.body);
  return input.fromViewer ? `You: ${preview}` : `${input.senderName}: ${preview}`;
}

export function messageTimeLabel(at: Date, now: Date) {
  if (dayKey(at) === dayKey(now)) {
    return new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" }).format(at);
  }
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (dayKey(at) === dayKey(yesterday)) return "Yesterday";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    ...(at.getFullYear() === now.getFullYear() ? {} : { year: "numeric" }),
  }).format(at);
}

function dayKey(date: Date) {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

export function nameList(names: string[]) {
  if (names.length <= 1) return names[0] ?? "";
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.slice(0, -1).join(", ")}, and ${names[names.length - 1]}`;
}

export function visibleToLine(names: string[]) {
  if (names.length === 0) return "Visible to: only you";
  return `Visible to: ${nameList(names)}`;
}

export function replyRecipientLine(names: string[]) {
  if (names.length === 0) return "No one else will receive this reply.";
  if (names.length === 1) return `${names[0]} will receive this reply.`;
  return `${nameList(names)} will receive this reply.`;
}

export function replyRecipientNames(input: {
  audience: "all_parties" | "party";
  parties: InboxParty[];
  recipientPartyId: string | null;
  viewerPartyId: string;
}) {
  if (input.audience === "party") {
    const recipient = input.parties.find((party) => party.id === input.recipientPartyId && party.id !== input.viewerPartyId);
    return recipient?.name ? [recipient.name] : [];
  }
  return orderedParties(input.parties)
    .filter((party) => party.id !== input.viewerPartyId && party.name.trim())
    .map((party) => party.name);
}

export function messagesHref(input: { filter?: "all" | "unread"; q?: string; thread?: string }) {
  const params = new URLSearchParams();
  if (input.filter === "unread") params.set("filter", "unread");
  const q = input.q?.trim();
  if (q) params.set("q", q);
  if (input.thread) params.set("thread", input.thread);
  const query = params.toString();
  return query ? `/creator/messages?${query}` : "/creator/messages";
}

export function inboxFilter(value: string | undefined | null): "all" | "unread" {
  return value === "unread" ? "unread" : "all";
}

export function queryValue(value: string | string[] | undefined) {
  const raw = Array.isArray(value) ? value[0] : value;
  return raw?.trim() ?? "";
}

export function threadIsUnread(input: {
  latestSenderUserId: string | null;
  latestAt: Date;
  viewerUserId: string;
  readAt: Date | null;
}) {
  if (input.latestSenderUserId && input.latestSenderUserId === input.viewerUserId) return false;
  if (!input.readAt) return true;
  return input.latestAt.getTime() > input.readAt.getTime();
}

export function visibleInboxThreads(threads: InboxThread[], filter: "all" | "unread", q: string) {
  const needle = q.trim().toLowerCase();
  return threads.filter((thread) => {
    if (filter === "unread" && !thread.unread) return false;
    if (!needle) return true;
    const haystack = [
      thread.otherParty,
      thread.campaign,
      thread.latestSender,
      thread.preview,
      thread.previewLine,
      thread.contractRef,
      ...thread.participants,
    ]
      .join("\n")
      .toLowerCase();
    return haystack.includes(needle);
  });
}

export function latestUnreadThread(threads: InboxThread[]) {
  return [...threads]
    .sort((a, b) => Date.parse(b.at) - Date.parse(a.at) || a.id.localeCompare(b.id))
    .find((thread) => thread.unread) ?? null;
}

export function buildInbox(input: {
  sources: InboxSource[];
  account: { id: string; email: string };
  reads: { threadId: string; readAt: Date }[];
  now: Date;
}) {
  const documents = dedupeDocuments(input.sources.map((source) => source.document));
  const readAt = new Map(input.reads.map((row) => [row.threadId, row.readAt]));
  const threads: InboxThread[] = [];
  for (const document of documents) {
    const party = resolveContractPartyForAccount(document.parties, input.account);
    if (!party) continue;
    const visible = readableContractMessages(document, { kind: "party", userId: input.account.id, partyId: party.id });
    const groups = new Map<string, Array<InboxMessage & { threadId: string }>>();
    for (const message of visible) {
      if (!message.threadId.startsWith("all:") && !message.threadId.startsWith("party:")) continue;
      const group = groups.get(message.threadId) ?? [];
      group.push(message);
      groups.set(message.threadId, group);
    }
    for (const [threadId, messages] of groups) {
      const access = threadAccess({ threadId, document, account: input.account, action: "read" });
      if (!access.ok) continue;
      const described = describeConversation({
        document,
        access,
        messages,
        account: input.account,
        now: input.now,
        readAt: readAt.get(threadId) ?? null,
      });
      if (described) threads.push(described.thread);
    }
  }
  const titled = threads.map((thread) => {
    const key = thread.campaign.trim().toLowerCase();
    const shared = threads.filter((row) => row.campaign.trim().toLowerCase() === key).length > 1;
    return { ...thread, sharedTitle: shared };
  });
  titled.sort((a, b) => Date.parse(b.at) - Date.parse(a.at) || a.id.localeCompare(b.id));
  return titled;
}

export function projectThread(input: {
  documents: InboxDocument[];
  account: { id: string; email: string };
  threadId: string;
  now: Date;
  reads?: { threadId: string; readAt: Date }[];
}): OpenThreadResult {
  const parsed = parseThreadId(input.threadId);
  if (!parsed || parsed.kind === "staff") return { ok: false, error: denied("read") };
  const document = input.documents.find((row) => row.id === parsed.documentId);
  if (!document) return { ok: false, error: denied("read") };
  const access = threadAccess({ threadId: input.threadId, document, account: input.account, action: "read" });
  if (!access.ok) return { ok: false, error: access.error };
  const messages = readableContractMessages(document, {
    kind: "party",
    userId: input.account.id,
    partyId: access.party.id,
  })
    .filter((message) => message.threadId === access.threadId)
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime() || a.id.localeCompare(b.id));
  const readAt = input.reads?.find((row) => row.threadId === access.threadId)?.readAt ?? null;
  const described = describeConversation({
    document,
    access,
    messages,
    account: input.account,
    now: input.now,
    readAt,
    allowEmpty: true,
  });
  if (!described) return { ok: false, error: denied("read") };
  return { ok: true, view: described };
}

export function planThreadReply(input: {
  documents: InboxDocument[];
  account: { id: string; email: string; name?: string | null };
  threadId: string;
  body: string;
  now: Date;
}):
  | {
      ok: true;
      partyId: string;
      threadId: string;
      documentId: string;
      fundingId: string | null;
      message: InboxMessage;
    }
  | { ok: false; error: string } {
  const body = input.body.trim();
  if (!body) return { ok: false, error: "Write a message." };
  if (body.length > 2000) return { ok: false, error: "Keep the message under 2000 characters." };
  const parsed = parseThreadId(input.threadId);
  if (!parsed || parsed.kind === "staff") return { ok: false, error: denied("reply") };
  const document = input.documents.find((row) => row.id === parsed.documentId);
  if (!document) return { ok: false, error: denied("reply") };
  const access = threadAccess({ threadId: input.threadId, document, account: input.account, action: "reply" });
  if (!access.ok) return { ok: false, error: access.error };
  const message: InboxMessage = {
    id: "pending",
    documentId: document.id,
    senderUserId: input.account.id,
    senderAdminId: null,
    senderName: access.party.name || input.account.name || "Member",
    body,
    audience: access.audience,
    recipientPartyId: access.audience === "party" ? access.recipientPartyId : null,
    createdAt: input.now,
  };
  return {
    ok: true,
    partyId: access.party.id,
    threadId: access.threadId,
    documentId: document.id,
    fundingId: document.fundingId ?? null,
    message,
  };
}

export function appendReply(documents: InboxDocument[], message: InboxMessage) {
  return documents.map((document) =>
    document.id === message.documentId ? { ...document, messages: [...document.messages, message] } : document,
  );
}

function describeConversation(input: {
  document: InboxDocument;
  access: Extract<ThreadAccess, { ok: true }>;
  messages: Array<InboxMessage & { threadId: string }>;
  account: { id: string; email: string };
  now: Date;
  readAt: Date | null;
  allowEmpty?: boolean;
}): ThreadView | null {
  const ordered = [...input.messages].sort(
    (a, b) => a.createdAt.getTime() - b.createdAt.getTime() || a.id.localeCompare(b.id),
  );
  const latest = ordered[ordered.length - 1];
  if (!latest && !input.allowEmpty) return null;
  const visibleParties = orderedParties(input.document.parties.filter((party) => input.access.partyIds.includes(party.id)));
  const participants = visibleParties.map((party) => party.name).filter((name) => name.trim());
  const otherParty = counterpartyName(input.document.parties, input.access.party.id, input.access.partyIds);
  const fromViewer = Boolean(latest?.senderUserId && latest.senderUserId === input.account.id);
  const recipients = replyRecipientNames({
    audience: input.access.audience,
    parties: input.document.parties,
    recipientPartyId: input.access.recipientPartyId,
    viewerPartyId: input.access.party.id,
  });
  const thread: InboxThread = {
    id: input.access.threadId,
    documentId: input.document.id,
    contractRef: input.document.id,
    campaign: input.document.title,
    otherParty,
    otherInitials: partyInitials(otherParty),
    participants,
    latestSender: latest ? (fromViewer ? input.access.party.name : latest.senderName) : otherParty,
    latestFromViewer: fromViewer,
    preview: latest ? messagePreview(latest.body) : "",
    previewLine: latest
      ? previewLine({ senderName: latest.senderName, fromViewer, body: latest.body })
      : "",
    at: (latest?.createdAt ?? input.now).toISOString(),
    timeLabel: latest ? messageTimeLabel(latest.createdAt, input.now) : "",
    unread: latest
      ? threadIsUnread({
          latestSenderUserId: latest.senderUserId,
          latestAt: latest.createdAt,
          viewerUserId: input.account.id,
          readAt: input.readAt,
        })
      : false,
    sharedTitle: false,
    fundingId: input.document.fundingId ?? null,
  };
  return {
    thread,
    messages: ordered.map((message) => {
      const own = message.senderUserId === input.account.id;
      const senderName = own ? input.access.party.name : message.senderName;
      return {
        id: message.id,
        senderName,
        body: message.body,
        timeLabel: messageTimeLabel(message.createdAt, input.now),
        fromViewer: own,
        initials: partyInitials(senderName),
      };
    }),
    visibleTo: visibleToLine(participants),
    replyRecipients: replyRecipientLine(recipients),
    contractHref: `/collaboration/contracts/${input.document.id}`,
  };
}

function counterpartyName(parties: InboxParty[], viewerPartyId: string, visibleIds: string[]) {
  const visible = new Set(visibleIds);
  const others = parties.filter((party) => party.id !== viewerPartyId && visible.has(party.id));
  const business = others.find((party) => party.role === "business" && party.name.trim());
  if (business) return business.name;
  const names = others.map((party) => party.name).filter((name) => name.trim());
  return names.join(", ") || "Conversation";
}

function orderedParties(parties: InboxParty[]) {
  return [...parties].sort((a, b) => {
    const rank = (party: InboxParty) => (party.role === "business" ? 0 : 1);
    return rank(a) - rank(b) || a.name.localeCompare(b.name) || a.id.localeCompare(b.id);
  });
}

function dedupeDocuments(documents: InboxDocument[]) {
  const seen = new Set<string>();
  const unique: InboxDocument[] = [];
  for (const document of documents) {
    if (seen.has(document.id)) continue;
    seen.add(document.id);
    unique.push(document);
  }
  return unique;
}

export async function loadMessageInbox(account: { id: string; email: string }, now = new Date()) {
  try {
    const email = account.email.trim();
    const documents = await prisma.contractDocument.findMany({
      where: {
        OR: [
          { parties: { some: { userId: account.id } } },
          ...(email
            ? [{ parties: { some: { email: { equals: email, mode: "insensitive" as const } } } }]
            : []),
        ],
      },
      include: {
        parties: { orderBy: { createdAt: "asc" } },
        messages: { orderBy: { createdAt: "asc" } },
      },
      orderBy: { updatedAt: "desc" },
    });
    const reads = await prisma.messageThreadRead.findMany({
      where: { userId: account.id },
      select: { threadId: true, readAt: true },
    });
    return {
      ok: true as const,
      threads: buildInbox({
        sources: documents.map((document) => ({ via: "contract" as const, document: asInboxDocument(document) })),
        account,
        reads,
        now,
      }),
    };
  } catch {
    return { ok: false as const, error: "Conversations could not be loaded." };
  }
}

export async function openMessageThread(
  account: { id: string; email: string },
  threadId: string,
  now = new Date(),
  options?: { markRead?: boolean },
) {
  const parsed = parseThreadId(threadId);
  if (!parsed || parsed.kind === "staff") return { ok: false as const, error: denied("read") };
  const found = await prisma.contractDocument.findUnique({
    where: { id: parsed.documentId },
    include: {
      parties: { orderBy: { createdAt: "asc" } },
      messages: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!found) return { ok: false as const, error: denied("read") };
  const document = await withAdoptedParty(found, account);
  const projected = projectThread({ documents: [document], account, threadId, now });
  if (!projected.ok || options?.markRead === false) return projected;
  await prisma.messageThreadRead
    .upsert({
      where: { userId_threadId: { userId: account.id, threadId: projected.view.thread.id } },
      create: { userId: account.id, threadId: projected.view.thread.id, readAt: now },
      update: { readAt: now },
    })
    .catch(() => undefined);
  return projected;
}

export async function replyOnThread(input: {
  account: { id: string; email: string; name?: string | null };
  threadId: string;
  body: string;
  now?: Date;
}) {
  const parsed = parseThreadId(input.threadId);
  if (!parsed || parsed.kind === "staff") return { ok: false as const, error: denied("reply") };
  const found = await prisma.contractDocument.findUnique({
    where: { id: parsed.documentId },
    include: { parties: true, messages: { orderBy: { createdAt: "asc" } } },
  });
  if (!found) return { ok: false as const, error: denied("reply") };
  const document = await withAdoptedParty(found, input.account);
  const planned = planThreadReply({
    documents: [document],
    account: input.account,
    threadId: input.threadId,
    body: input.body,
    now: input.now ?? new Date(),
  });
  if (!planned.ok) return planned;
  const posted = await postContractMessage({
    documentId: planned.documentId,
    body: planned.message.body,
    audience: planned.message.audience as MessageAudience,
    recipientPartyId: planned.message.recipientPartyId,
    senderName: planned.message.senderName,
    senderUserId: input.account.id,
    senderEmail: input.account.email,
    viewerPartyId: planned.partyId,
  });
  if (!posted.ok) {
    if (posted.error === "Write a message." || posted.error === "Keep the message under 2000 characters.") return posted;
    return { ok: false as const, error: denied("reply") };
  }
  return {
    ok: true as const,
    id: posted.id,
    documentId: planned.documentId,
    fundingId: planned.fundingId,
    threadId: planned.threadId,
  };
}

export async function messagesForFundingMember(fundingId: string, account: { id: string; email: string }) {
  if (!fundingId.trim()) return { ok: false as const, error: denied("read") };
  const document = await prisma.contractDocument.findFirst({
    where: { fundingId },
    orderBy: { updatedAt: "desc" },
    include: {
      parties: { orderBy: { createdAt: "asc" } },
      messages: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!document) return { ok: false as const, error: denied("read") };
  const party = resolveContractPartyForAccount(document.parties, account);
  if (!party) return { ok: false as const, error: denied("read") };
  return {
    ok: true as const,
    documentId: document.id,
    messages: readableContractMessages(asInboxDocument(document), {
      kind: "party",
      userId: account.id,
      partyId: party.id,
    }),
  };
}

async function withAdoptedParty(document: Parameters<typeof asInboxDocument>[0], account: { id: string; email: string }) {
  const party = resolveContractPartyForAccount(document.parties, account);
  if (!party || party.userId) return asInboxDocument(document);
  const adopted = await adoptUnboundContractParty(party, account).catch(() => party);
  return asInboxDocument({
    ...document,
    parties: document.parties.map((row) => (row.id === adopted.id ? { ...row, userId: adopted.userId } : row)),
  });
}
