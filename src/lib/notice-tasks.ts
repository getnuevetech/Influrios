/**
 * Action required follows the live task, not the notice kind (master-spec §5.3, P1-AUD-01).
 * A notice whose invitation was answered, withdrawn or expired stays in history but is no
 * longer Action required. Read state is never touched here.
 */
import { prisma } from "@/lib/db";
import { invitationWaitingForInvitee } from "@/lib/invitation-turn";
import { proposalIsExpired } from "@/lib/team-proposal";

type NoticeRef = { id: string; kind: string; sourceId: string };

export function invitationNoticeSource(notice: { kind: string; sourceId: string }):
  | { type: "application"; id: string }
  | { type: "team"; id: string }
  | null {
  if (notice.kind !== "invitation") return null;
  const team = /^invitation:team:(.+)$/.exec(notice.sourceId);
  if (team) return { type: "team", id: team[1] };
  const app = /^invitation:(.+)$/.exec(notice.sourceId);
  return app ? { type: "application", id: app[1] } : null;
}

/** Ids of invitation notices whose task is no longer open for this member. */
export async function closedTaskNoticeIds(notices: NoticeRef[], creatorSlug: string | null, now = new Date()): Promise<Set<string>> {
  const closed = new Set<string>();
  const sources = notices.map((notice) => ({ notice, source: invitationNoticeSource(notice) })).filter((row) => row.source);
  if (!sources.length) return closed;
  const appIds = sources.filter((row) => row.source?.type === "application").map((row) => row.source!.id);
  const teamIds = sources.filter((row) => row.source?.type === "team").map((row) => row.source!.id);
  const [apps, proposals] = await Promise.all([
    appIds.length
      ? prisma.marketplaceApplication.findMany({
          where: { id: { in: appIds } },
          select: { id: true, status: true, turn: true, interestRecorded: true, openQuestion: true, responseDeadline: true },
        })
      : [],
    teamIds.length
      ? prisma.teamProposal.findMany({
          where: { id: { in: teamIds } },
          select: { id: true, status: true, expiresAt: true, members: { select: { creatorSlug: true, status: true } } },
        })
      : [],
  ]);
  const appById = new Map(apps.map((row) => [row.id, row]));
  const teamById = new Map(proposals.map((row) => [row.id, row]));
  for (const { notice, source } of sources) {
    if (source?.type === "application") {
      const app = appById.get(source.id);
      if (!app || !invitationWaitingForInvitee(app, now)) closed.add(notice.id);
    } else if (source?.type === "team") {
      const proposal = teamById.get(source.id);
      const member = proposal?.members.find((row) => row.creatorSlug === creatorSlug);
      const open =
        proposal &&
        member?.status === "invited" &&
        (proposal.status === "sent" || proposal.status === "partial") &&
        !proposalIsExpired({ status: proposal.status, expiresAt: proposal.expiresAt, now });
      if (!open) closed.add(notice.id);
    }
  }
  return closed;
}
