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
