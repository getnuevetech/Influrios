/**
 * Withdrawal and expiry notices for the invitee (P1-AUD-01/02 · master-spec §5.7).
 * An in-app notice plus the matching email template, never the invitation template.
 * The original invitation notice stays in history; it leaves Action required because
 * its task (the invitation) is no longer open — see notice-tasks.ts.
 */
import { prisma } from "@/lib/db";
import { withdrawalReasonFromNote } from "@/lib/invitation-turn";

export async function notifyInvitationClosed(input: { applicationId: string; outcome: "withdrawn" | "expired"; note?: string | null }) {
  const row = await prisma.marketplaceApplication.findUnique({
    where: { id: input.applicationId },
    include: { businessRequest: { select: { brand: true, workspace: { select: { name: true } } } } },
  });
  if (!row || !row.toSlug || row.fromSlug) return;
  const creator = await prisma.creator.findUnique({
    where: { slug: row.toSlug },
    select: { userId: true, displayName: true, user: { select: { email: true } } },
  });
  if (!creator?.userId) return;
  // Brief-based invitations have no marketplace request; name the workspace that owns the brief.
  const briefWorkspace = !row.businessRequest && row.briefId
    ? await prisma.businessBrief.findUnique({ where: { id: row.briefId }, select: { workspace: { select: { name: true } } } }).catch(() => null)
    : null;
  const business = row.businessRequest?.workspace?.name || row.businessRequest?.brand || briefWorkspace?.workspace?.name || "The business";
  const collaboration = row.note?.trim() || row.businessRequest?.brand || "a collaboration";
  const reason = input.outcome === "withdrawn" ? withdrawalReasonFromNote(input.note) : null;
  const href = `/collaboration/applications/${row.id}`;
  const title = input.outcome === "withdrawn" ? `${business} withdrew an invitation` : `An invitation from ${business} expired`;
  const detail =
    input.outcome === "withdrawn"
      ? `${collaboration}${reason ? ` · Reason given: ${reason}` : ""} · Nothing was signed or funded`
      : `${collaboration} · Nothing was signed or funded`;
  await prisma.accountNotice
    .upsert({
      where: { userId_kind_sourceId: { userId: creator.userId, kind: `invitation_${input.outcome}`, sourceId: `invitation:${row.id}` } },
      create: { userId: creator.userId, kind: `invitation_${input.outcome}`, sourceId: `invitation:${row.id}`, title, detail, href },
      update: { title, detail, href },
    })
    .catch((error) => console.error("invitation closed notice", error));
  if (!creator.user?.email) return;
  const { deliverCatalogEmail, liveMailLinks } = await import("@/lib/email-live");
  const links = liveMailLinks();
  await deliverCatalogEmail({
    templateId: input.outcome === "withdrawn" ? "invite.withdrawn" : "invite.expired",
    to: creator.user.email,
    vars: {
      first_name: creator.displayName.split(/\s+/)[0] || creator.displayName,
      business_name: business,
      collaboration_name: collaboration,
      reason_line: reason ? `Reason given: ${reason}` : "",
      expires_at: row.responseDeadline ? row.responseDeadline.toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10),
      action_url: `${links.origin}${href}`,
    },
  }).catch(() => undefined);
}

type Parties = {
  row: NonNullable<Awaited<ReturnType<typeof loadInvitation>>>;
  influencerUserId: string | null;
  influencerName: string;
  businessUserId: string | null;
  businessName: string;
  campaign: string;
};

async function loadInvitation(applicationId: string) {
  return prisma.marketplaceApplication.findUnique({
    where: { id: applicationId },
    include: { businessRequest: { select: { brand: true, workspace: { select: { name: true, ownerUserId: true } } } } },
  });
}

async function parties(applicationId: string): Promise<Parties | null> {
  const row = await loadInvitation(applicationId);
  if (!row || !row.toSlug || row.fromSlug) return null;
  const [creator, brief] = await Promise.all([
    prisma.creator.findUnique({ where: { slug: row.toSlug }, select: { userId: true, displayName: true } }),
    row.briefId
      ? prisma.businessBrief.findUnique({ where: { id: row.briefId }, select: { title: true, workspace: { select: { name: true, ownerUserId: true } } } })
      : null,
  ]);
  const workspace = row.businessRequest?.workspace ?? brief?.workspace ?? null;
  return {
    row,
    influencerUserId: creator?.userId ?? null,
    influencerName: creator?.displayName || row.toSlug,
    businessUserId: workspace?.ownerUserId ?? null,
    businessName: workspace?.name || row.businessRequest?.brand || "The business",
    campaign: row.note?.trim() || brief?.title || row.businessRequest?.brand || "a collaboration",
  };
}

async function upsertNotice(userId: string | null, kind: string, sourceId: string, title: string, detail: string, href: string) {
  if (!userId) return;
  await prisma.accountNotice
    .upsert({
      where: { userId_kind_sourceId: { userId, kind, sourceId } },
      // A repeat event (e.g. a second answer) is a new, unread notice.
      create: { userId, kind, sourceId, title, detail, href },
      update: { title, detail, href, readAt: null, createdAt: new Date() },
    })
    .catch((error) => console.error("invitation notice", kind, error));
}

/** The invitee's in-app invitation notice, created when the invitation is sent (not only when home is opened). */
export async function notifyInvitationSent(applicationId: string) {
  const p = await parties(applicationId);
  if (!p) return;
  await upsertNotice(
    p.influencerUserId,
    "invitation",
    `invitation:${p.row.id}`,
    p.campaign,
    `${p.businessName} invited you · Waiting for your reply`,
    `/collaboration/applications/${p.row.id}`,
  );
}

/** Tell the business what the influencer did (interest, question, decline). One live notice per invitation. */
export async function notifyBusinessOfResponse(applicationId: string, intent: "interested" | "question" | "decline") {
  const p = await parties(applicationId);
  if (!p) return;
  const title =
    intent === "interested"
      ? `${p.influencerName} is interested`
      : intent === "question"
        ? `${p.influencerName} asked a question`
        : `${p.influencerName} declined your invitation`;
  const detail =
    intent === "decline"
      ? `${p.campaign} · Nothing was signed or funded`
      : intent === "question"
        ? `${p.campaign} · Answer on the invitation`
        : `${p.campaign} · Accept or decide it's not a fit`;
  await upsertNotice(
    p.businessUserId,
    intent === "decline" ? "invitation_declined" : "invitation_response",
    `response:${p.row.id}`,
    title,
    detail,
    `/collaboration/applications/${p.row.id}`,
  );
}

/** Tell the influencer what the business did (answered, accepted, not a fit). */
export async function notifyInviteeOfBusinessAction(applicationId: string, action: "answered" | "accepted" | "not_a_fit") {
  const p = await parties(applicationId);
  if (!p) return;
  const [kind, title, detail] =
    action === "answered"
      ? ["invitation_reply", `${p.businessName} replied`, `${p.campaign} · Read their answer on the invitation`]
      : action === "accepted"
        ? ["invitation_accepted", `${p.businessName} accepted you`, `${p.campaign} · They're preparing the agreement. You don't need to do anything yet`]
        : ["invitation_not_selected", `${p.businessName} went with someone else`, `${p.campaign} · Nothing was signed or funded`];
  await upsertNotice(p.influencerUserId, kind, `${kind}:${p.row.id}`, title, detail, `/collaboration/applications/${p.row.id}`);
}

/** Parties of an application an influencer sent to a business's public request (fromSlug = applicant). */
async function applicationParties(applicationId: string) {
  const row = await loadInvitation(applicationId);
  if (!row || !row.fromSlug) return null;
  const creator = await prisma.creator.findUnique({ where: { slug: row.fromSlug }, select: { userId: true, displayName: true } });
  const workspace = row.businessRequest?.workspace ?? null;
  return {
    row,
    influencerUserId: creator?.userId ?? row.fromUserId ?? null,
    influencerName: creator?.displayName || row.fromSlug,
    businessUserId: workspace?.ownerUserId ?? null,
    businessName: workspace?.name || row.businessRequest?.brand || "The business",
    campaign: row.businessRequest?.brand || "your request",
  };
}

/** The business hears about a new application the moment it arrives (it saw nothing before). */
export async function notifyBusinessOfApplication(applicationId: string) {
  const p = await applicationParties(applicationId);
  if (!p) return;
  await upsertNotice(
    p.businessUserId,
    "application_received",
    `application_received:${p.row.id}`,
    `${p.influencerName} applied`,
    `${p.campaign} · Review the application and accept or decline`,
    `/collaboration/applications/${p.row.id}`,
  );
}

/** The applicant hears the business's decision. */
export async function notifyApplicantOfDecision(applicationId: string, outcome: "accepted" | "declined") {
  const p = await applicationParties(applicationId);
  if (!p) return;
  const [title, detail] =
    outcome === "accepted"
      ? [`${p.businessName} accepted your application`, `${p.campaign} · They're preparing the agreement. You don't need to do anything yet`]
      : [`${p.businessName} went with someone else`, `${p.campaign} · Nothing was signed or funded`];
  await upsertNotice(
    p.influencerUserId,
    outcome === "accepted" ? "application_accepted" : "application_declined",
    `application_${outcome}:${p.row.id}`,
    title,
    detail,
    `/collaboration/applications/${p.row.id}`,
  );
}
