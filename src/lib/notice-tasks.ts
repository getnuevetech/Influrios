/**
 * Invitation notices follow the live invitation, not the text they were created with
 * (master-spec §5.2a, §5.3, P1-AUD-01).
 * - Action required = the notice's task is still open for this member.
 * - The detail line shows the invitation's current state, so an old notice never
 *   contradicts what the invitation now says.
 * History and read state are never touched here.
 */
import { prisma } from "@/lib/db";
import {
  businessInvitationLabel,
  businessInvitationTask,
  invitationCase,
  invitationState,
  invitationWaitingForInvitee,
  inviteeInvitationView,
} from "@/lib/invitation-turn";
import { proposalIsExpired } from "@/lib/team-proposal";

type NoticeRef = { id: string; kind: string; sourceId: string };

export type NoticeSource =
  | { type: "application"; id: string; role: "invitee" | "invitee-reply" | "business" }
  | { type: "team"; id: string };

export function invitationNoticeSource(notice: { kind: string; sourceId: string }): NoticeSource | null {
  if (notice.kind === "invitation") {
    const team = /^invitation:team:(.+)$/.exec(notice.sourceId);
    if (team) return { type: "team", id: team[1] };
    const app = /^invitation:(.+)$/.exec(notice.sourceId);
    return app ? { type: "application", id: app[1], role: "invitee" } : null;
  }
  if (notice.kind === "invitation_reply") {
    const app = /^invitation_reply:(.+)$/.exec(notice.sourceId);
    return app ? { type: "application", id: app[1], role: "invitee-reply" } : null;
  }
  if (notice.kind === "invitation_response") {
    const app = /^response:(.+)$/.exec(notice.sourceId);
    return app ? { type: "application", id: app[1], role: "business" } : null;
  }
  return null;
}

export type LiveNotice = { open: boolean; status: string | null };

/** Live state for every invitation notice in the list, keyed by notice id. */
export async function liveInvitationNotices(notices: NoticeRef[], creatorSlug: string | null, now = new Date()): Promise<Map<string, LiveNotice>> {
  const live = new Map<string, LiveNotice>();
  const sources = notices
    .map((notice) => ({ notice, source: invitationNoticeSource(notice) }))
    .filter((row): row is { notice: NoticeRef; source: NoticeSource } => row.source !== null);
  if (!sources.length) return live;
  const appIds = [...new Set(sources.filter((row) => row.source.type === "application").map((row) => row.source.id))];
  const teamIds = [...new Set(sources.filter((row) => row.source.type === "team").map((row) => row.source.id))];
  const [apps, proposals] = await Promise.all([
    appIds.length
      ? prisma.marketplaceApplication.findMany({
          where: { id: { in: appIds } },
          select: {
            id: true,
            status: true,
            turn: true,
            interestRecorded: true,
            openQuestion: true,
            responseDeadline: true,
            toSlug: true,
            events: { select: { toStatus: true, note: true }, orderBy: { createdAt: "asc" } },
            businessRequest: { select: { brand: true, workspace: { select: { name: true } } } },
            briefId: true,
          },
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
  // Real names for the live labels: the business that owns the invitation, the influencer it went to.
  const briefIds = [...new Set(apps.map((row) => row.briefId).filter((id): id is string => Boolean(id)))];
  const slugs = [...new Set(apps.map((row) => row.toSlug).filter((slug): slug is string => Boolean(slug)))];
  const [briefs, creators] = await Promise.all([
    briefIds.length ? prisma.businessBrief.findMany({ where: { id: { in: briefIds } }, select: { id: true, workspace: { select: { name: true } } } }) : [],
    slugs.length ? prisma.creator.findMany({ where: { slug: { in: slugs } }, select: { slug: true, displayName: true } }) : [],
  ]);
  const businessName = (app: (typeof apps)[number]) =>
    app.businessRequest?.workspace?.name || briefs.find((row) => row.id === app.briefId)?.workspace.name || app.businessRequest?.brand || "The business";
  const influencerName = (app: (typeof apps)[number]) =>
    creators.find((row) => row.slug === app.toSlug)?.displayName || app.toSlug || "The influencer";
  const teamById = new Map(proposals.map((row) => [row.id, row]));
  for (const { notice, source } of sources) {
    if (source.type === "application") {
      const app = appById.get(source.id);
      if (!app) {
        live.set(notice.id, { open: false, status: null });
        continue;
      }
      if (source.role === "business") {
        live.set(notice.id, { open: businessInvitationTask(app, now) !== null, status: businessInvitationLabel(app, influencerName(app), now) });
      } else {
        const view = inviteeInvitationView(app, businessName(app), now);
        const open =
          source.role === "invitee-reply"
            ? invitationCase(invitationState(app), { responseDeadline: app.responseDeadline, now }) === 3
            : invitationWaitingForInvitee(app, now);
        live.set(notice.id, { open, status: view.label });
      }
    } else {
      const proposal = teamById.get(source.id);
      const member = proposal?.members.find((row) => row.creatorSlug === creatorSlug);
      const closed = !proposal || proposal.status === "declined" || proposal.status === "expired" ||
        proposalIsExpired({ status: proposal.status, expiresAt: proposal.expiresAt, now });
      const open = !closed && member?.status === "invited" && (proposal.status === "sent" || proposal.status === "partial");
      const status = closed ? "This invitation is closed" : member?.status === "accepted" ? "You accepted · Waiting for teammates" : open ? "Waiting for your reply" : null;
      live.set(notice.id, { open: Boolean(open), status });
    }
  }
  return live;
}

/** Ids of invitation notices whose task is no longer open for this member. */
export async function closedTaskNoticeIds(notices: NoticeRef[], creatorSlug: string | null, now = new Date()): Promise<Set<string>> {
  const live = await liveInvitationNotices(notices, creatorSlug, now);
  return new Set([...live.entries()].filter(([, value]) => !value.open).map(([id]) => id));
}
