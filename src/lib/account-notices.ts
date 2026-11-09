/**
 * Bell events for one account. Reading a notice clears its unread flag.
 * The invitation stays pending until the member responds or it expires.
 */
import { prisma } from "@/lib/db";

export type NoticeDraft = {
  kind: string;
  sourceId: string;
  title: string;
  detail: string;
  href: string;
};

export async function syncAccountNotices(userId: string, drafts: NoticeDraft[]) {
  for (const draft of drafts) {
    if (!draft.sourceId || !draft.href.startsWith("/")) continue;
    await prisma.accountNotice.upsert({
      where: { userId_kind_sourceId: { userId, kind: draft.kind, sourceId: draft.sourceId } },
      create: {
        userId,
        kind: draft.kind,
        sourceId: draft.sourceId,
        title: draft.title,
        detail: draft.detail,
        href: draft.href,
      },
      update: { title: draft.title, detail: draft.detail, href: draft.href },
    });
  }
}

export async function listAccountNotices(userId: string) {
  return prisma.accountNotice.findMany({
    where: { userId },
    orderBy: [{ readAt: "asc" }, { createdAt: "desc" }],
    take: 30,
  });
}

export async function unreadNoticeCount(userId: string) {
  return prisma.accountNotice.count({ where: { userId, readAt: null } }).catch(() => 0);
}

/** Marks one of this member's notices read and returns the item it opens. */
export async function markNoticeRead(userId: string, id: string) {
  const row = await prisma.accountNotice.findFirst({ where: { id, userId } });
  if (!row) return null;
  if (!row.readAt) {
    await prisma.accountNotice.update({ where: { id: row.id }, data: { readAt: new Date() } });
  }
  return row.href.startsWith("/") ? row.href : "/creator";
}
