/**
 * Creator account home — only stored account, card, inquiry, and ledger rows.
 * Claim templates, brand-default art, and unsynced follower counts stay off the live figures.
 */
import { getAccountSession } from "@/lib/accounts";
import { agreementPresentation, isCurrentCollaboration } from "@/lib/collaboration-hub";
import { applicationIsInvitation, applicationIsOpenPipeline } from "@/lib/marketplace-listings";
import { isPlaceholderBio } from "@/lib/onboarding";
import { completenessFor, draftToSeedCreator, getCreatorSessionDraft } from "@/lib/claim";
import { loadCreatorHub } from "@/lib/collaboration-hub";
import { contractPartyProgress, listContractsForUser } from "@/lib/contract-document";
import { syncAccountNotices } from "@/lib/account-notices";
import { prisma } from "@/lib/db";
import { isBrandDefaultAvatar, isBrandDefaultBanner, isRemoteMediaUrl } from "@/lib/profile-media";
import { isLiveSocialAccount, isProviderUsername } from "@/lib/social-sync";
import { primaryShortHost } from "@/lib/short-link";
import { specialtyLabel } from "@/lib/seed-data";

const VISIT_EVENTS = ["resolve", "qr_scan", "alias_redirect", "nfc_tap", "campaign_redirect"] as const;

export type HomeSocialStatus = "connected" | "on_card" | "attention";

export type HomeSocial = {
  id: string;
  platform: string;
  handle: string;
  followers: number | null;
  status: HomeSocialStatus;
  statusLabel: string;
  detail: string | null;
};

export type HomeOpportunity = {
  id: string;
  href: string;
  title: string;
  subtitle: string;
  tags: string[];
  budget: string;
  badge: string;
  badgeTone: "success" | "violet" | "info" | "neutral";
};

export type HomeChecklistItem = {
  id: string;
  label: string;
  done: boolean;
  href: string;
};

export type HomePipelineItem = {
  id: string;
  title: string;
  counterparty: string;
  stage: string;
  href: string;
  next: string;
};

export type HomeAttentionItem = {
  id: string;
  title: string;
  detail: string;
  action: string;
  href: string;
  kind: "invitation" | "agreement" | "deliverable";
};

export type HomeEarnings = {
  failed: boolean;
  cents: number;
  currency: string;
  note: string;
};

export function countByRecentDays(dates: Array<Date | string>, days = 7, now = Date.now()): number[] {
  const buckets = Array.from({ length: days }, () => 0);
  for (const value of dates) {
    const time = value instanceof Date ? value.getTime() : new Date(value).getTime();
    if (!Number.isFinite(time)) continue;
    const age = Math.floor((now - time) / 86400000);
    if (age < 0 || age >= days) continue;
    buckets[days - 1 - age] += 1;
  }
  return buckets;
}

export function visitDelta(series: number[]): { label: string; positive: boolean } | null {
  if (series.length < 2) return null;
  const split = Math.ceil(series.length / 2);
  const recent = series.slice(split).reduce((sum, n) => sum + n, 0);
  const prior = series.slice(0, split).reduce((sum, n) => sum + n, 0);
  if (prior === 0 && recent === 0) return null;
  if (prior === 0) return { label: "↑ 100%", positive: true };
  const pct = Math.round(((recent - prior) / prior) * 100);
  return { label: `${pct >= 0 ? "↑" : "↓"} ${Math.abs(pct)}%`, positive: pct >= 0 };
}

/** What the earnings tile should say. A failed load must not look like zero. */
export function earningsSummaryNote(input: { failed: boolean; currency: string; cents: number }) {
  if (input.failed) return "Earnings could not be loaded. This is not zero.";
  if (!input.currency || input.cents === 0) return "Nothing released this month.";
  return "Released to you this month.";
}

export function portraitAt<T>(images: readonly T[], index: number): T | null {
  if (images.length === 0) return null;
  const normalized = ((Math.floor(index) % images.length) + images.length) % images.length;
  return images[normalized] ?? null;
}

export function deliverableWhen(due: Date, now = new Date()) {
  const label = due.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "America/Chicago",
  });
  return due.getTime() < now.getTime() ? `Overdue · due ${label}` : `Deliverable due ${label}`;
}

export function displayBio(bio: string | null | undefined): string {
  const value = (bio ?? "").trim();
  if (isPlaceholderBio(value)) return "";
  return value;
}

/** Uploaded photos only. Brand defaults and repeated copies are not a media kit. */
export function mediaKitPhotos(avatar: string | null | undefined, cover: string | null | undefined): string[] {
  const photos: string[] = [];
  const avatarPath = (avatar ?? "").trim();
  const coverPath = (cover ?? "").trim();
  if (avatarPath && !isRemoteMediaUrl(avatarPath) && !isBrandDefaultAvatar(avatarPath)) photos.push(avatarPath);
  if (
    coverPath &&
    coverPath !== avatarPath &&
    !isRemoteMediaUrl(coverPath) &&
    !isBrandDefaultBanner(coverPath)
  ) {
    photos.push(coverPath);
  }
  return photos;
}

function claimHandleKey(value: string) {
  return value
    .trim()
    .replace(/^@/, "")
    .toLowerCase()
    .replace(/-\d+$/, "")
    .replace(/[^a-z0-9]/g, "");
}

/** The signup handle copied onto a card row is not that network's account. */
export function isClaimPlaceholderHandle(handle: string, slug: string) {
  const left = claimHandleKey(handle);
  const right = claimHandleKey(slug);
  if (!left || !right) return false;
  return left === right;
}

export function classifySocialRow(input: {
  id: string;
  platform: string;
  handle: string;
  followers: number | null;
  source: string;
  refreshedAt: Date | null;
  connectionStatus: string | null;
  lastError: string | null;
  slug?: string;
}): HomeSocial {
  const live = isLiveSocialAccount({
    source: input.source,
    refreshedAt: input.refreshedAt,
    followers: input.followers,
  });
  const oauth = input.connectionStatus === "connected";
  const attention = input.connectionStatus === "error";
  const status: HomeSocialStatus = oauth ? "connected" : attention ? "attention" : "on_card";
  const providerConfirmed =
    (input.source === "PROVIDER_SYNCED" || input.source === "PLATFORM_VERIFIED") && isProviderUsername(input.handle);
  const claimCopy = !oauth && !attention && isClaimPlaceholderHandle(input.handle, input.slug ?? "");
  const handle = oauth || attention ? (providerConfirmed ? input.handle : "") : claimCopy ? "" : input.handle;
  return {
    id: input.id,
    platform: input.platform,
    handle,
    followers: live ? input.followers : null,
    status,
    statusLabel: oauth ? "Connected" : attention ? "Needs attention" : "Unverified",
    detail: attention
      ? input.lastError
      : oauth && !providerConfirmed
        ? "Signed in. Sync now to load the @username from this network."
        : oauth && !live
          ? "Signed in. Audience figures are not synced yet."
          : claimCopy
            ? "This row still has the claim handle. Connect the network to replace it."
            : null,
  };
}

export function sharedCurrency(codes: string[]): string {
  const clean = codes.map((code) => code.trim().toUpperCase()).filter((code) => /^[A-Z]{3}$/.test(code));
  if (clean.length === 0) return "";
  const first = clean[0]!;
  return clean.every((code) => code === first) ? first : "";
}

function statusTone(status: string): HomeOpportunity["badgeTone"] {
  const value = status.toLowerCase();
  if (value === "lead_created" || value === "published" || value === "open" || value === "active") return "success";
  if (value.includes("review")) return "info";
  return "violet";
}

function statusLabel(status: string) {
  const value = status.trim().replace(/_/g, " ");
  if (!value) return "Open";
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export async function loadCreatorHome(userId: string) {
  const account = await getAccountSession();
  const [user, creator, draft, host, contracts] = await Promise.all([
    prisma.user
      .findUnique({
        where: { id: userId },
        select: { id: true, email: true, name: true, emailVerifiedAt: true, planTier: true },
      })
      .catch(() => null),
    prisma.creator
      .findUnique({
        where: { userId },
        select: {
          id: true,
          slug: true,
          displayName: true,
          title: true,
          bio: true,
          avatarUrl: true,
          coverUrl: true,
          locationCity: true,
          locationCountry: true,
          identityVerified: true,
          socialAccounts: { orderBy: { platform: "asc" } },
          socialConnections: { select: { platform: true, status: true, lastError: true } },
          specialties: { include: { specialty: { select: { name: true, slug: true } } } },
          payoutProfile: {
            select: {
              stripeConnectAccountId: true,
              providerConnectedAccountId: true,
              primaryStatus: true,
              secondaryStatus: true,
            },
          },
          shortLinks: {
            where: { status: { not: "archived" } },
            take: 1,
            select: { id: true, slug: true },
          },
          card: { select: { published: true } },
        },
      })
      .catch(() => null),
    getCreatorSessionDraft().catch(() => null),
    primaryShortHost().catch(() => "inflr.me"),
    listContractsForUser(userId, account?.email ?? "").catch(() => []),
  ]);

  const slug = creator?.slug || draft?.slug || "";
  const seed = draft ? draftToSeedCreator(draft) : null;
  const shortLink = creator?.shortLinks[0] ?? null;
  const since = new Date(Date.now() - 7 * 86400000);
  const since30 = new Date(Date.now() - 30 * 86400000);
  const monthStart = new Date();
  monthStart.setUTCDate(1);
  monthStart.setUTCHours(0, 0, 0, 0);

  const [visitLoad, inquiries, hub, releaseLoad, currencyLoad, deliverables, teamProposals] = await Promise.all([
    shortLink
      ? prisma.shortLinkEvent
          .findMany({
            where: { shortLinkId: shortLink.id, eventType: { in: [...VISIT_EVENTS] } },
            select: { createdAt: true },
          })
          .then((rows) => ({ rows, failed: false }))
          .catch((error) => {
            console.error("profile visits", error);
            return { rows: [] as { createdAt: Date }[], failed: true };
          })
      : Promise.resolve({ rows: [] as { createdAt: Date }[], failed: false }),
    slug
      ? prisma.businessInquiry
          .findMany({
            where: { creatorSlug: slug },
            orderBy: { createdAt: "desc" },
            take: 8,
            include: {
              workspace: { select: { name: true } },
              brief: { select: { title: true, budget: true, specialty: true, platform: true, goal: true } },
            },
          })
          .catch(() => [])
      : Promise.resolve([]),
    creator && seed ? loadCreatorHub({ userId, creator: seed }).catch(() => null) : Promise.resolve(null),
    slug
      ? prisma.ledgerEntry
          .findMany({
            where: {
              kind: "release",
              party: "Influencer",
              createdAt: { gte: monthStart },
              funding: { creatorSlug: slug },
            },
            select: { amountCents: true, createdAt: true },
          })
          .then((rows) => ({ rows, failed: false }))
          .catch((error) => {
            console.error("earnings releases", error);
            return { rows: [] as { amountCents: number; createdAt: Date }[], failed: true };
          })
      : Promise.resolve({ rows: [] as { amountCents: number; createdAt: Date }[], failed: false }),
    slug
      ? prisma.collaborationFunding
          .findMany({ where: { creatorSlug: slug }, select: { currency: true } })
          .then((rows) => ({ rows, failed: false }))
          .catch((error) => {
            console.error("earnings currency", error);
            return { rows: [] as { currency: string }[], failed: true };
          })
      : Promise.resolve({ rows: [] as { currency: string }[], failed: false }),
    slug
      ? prisma.fundingMilestone
          .findMany({
            where: {
              deliverableDueAt: { not: null },
              status: { notIn: ["released", "approved", "cancelled", "voided"] },
              funding: { creatorSlug: slug },
            },
            select: {
              id: true,
              title: true,
              deliverableDueAt: true,
              funding: { select: { id: true, title: true, collaborationId: true } },
            },
            orderBy: { deliverableDueAt: "asc" },
            take: 6,
          })
          .catch(() => [])
      : Promise.resolve([]),
    slug
      ? import("@/lib/team-proposal").then((mod) => mod.listTeamProposalsForCreator(slug)).catch(() => [])
      : Promise.resolve([]),
  ]);
  const visitEvents = visitLoad.rows;
  const releases = releaseLoad.rows;
  const fundingCurrencies = currencyLoad.rows;
  const earningsFailed = releaseLoad.failed || currencyLoad.failed;

  const recentVisits = visitEvents.filter((event) => event.createdAt >= since);
  const visits30 = visitEvents.filter((event) => event.createdAt >= since30);
  const visitSeries = countByRecentDays(recentVisits.map((event) => event.createdAt));
  const connectionByPlatform = new Map((creator?.socialConnections ?? []).map((row) => [row.platform, row]));
  const socials: HomeSocial[] = (creator?.socialAccounts ?? []).map((social) => {
    const connection = connectionByPlatform.get(social.platform);
    return classifySocialRow({
      id: social.id,
      platform: social.platform,
      handle: social.handle,
      slug,
      followers: social.followers,
      source: social.source,
      refreshedAt: social.refreshedAt,
      connectionStatus: connection?.status ?? null,
      lastError: connection?.lastError ?? null,
    });
  });

  const inquiryOpportunities: HomeOpportunity[] = inquiries.map((inquiry) => ({
    id: inquiry.id,
    href: "/collaboration/hub?view=opportunities",
    title: inquiry.workspace.name || inquiry.brief?.title || "Brand inquiry",
    subtitle: inquiry.brief?.title || inquiry.message,
    tags: [inquiry.brief?.specialty, inquiry.brief?.platform, inquiry.brief?.goal].filter(
      (tag): tag is string => Boolean(tag && tag.trim()),
    ),
    budget: inquiry.brief?.budget?.trim() || "",
    badge: statusLabel(inquiry.status),
    badgeTone: statusTone(inquiry.status),
  }));
  const appliedRequestIds = new Set(
    (hub?.applications ?? [])
      .filter((row) => row.businessRequestId && row.fromSlug && row.status !== "WITHDRAWN")
      .map((row) => row.businessRequestId as string),
  );
  const openBrandMatches = (hub?.brandMatches ?? []).filter((row) => !appliedRequestIds.has(row.request.id));
  const matchedOpportunities: HomeOpportunity[] = openBrandMatches
    .filter((row) => !inquiryOpportunities.some((item) => item.title === row.request.brand))
    .slice(0, 4)
    .map(({ request, score }) => ({
      id: request.id,
      href: `/collaboration/requests/${encodeURIComponent(request.id)}`,
      title: request.brand,
      subtitle: request.lookingFor || request.category,
      tags: request.tags.slice(0, 3),
      budget: request.budget,
      badge: `Fit ${score}`,
      badgeTone: "violet" as const,
    }));
  const opportunities = [...inquiryOpportunities, ...matchedOpportunities].slice(0, 4);
  const opportunityCount = inquiries.length + openBrandMatches.length;

  const dueByCollaboration = new Map<string, Date>();
  for (const row of deliverables) {
    const collaborationId = row.funding.collaborationId;
    const due = row.deliverableDueAt;
    if (!collaborationId || !due) continue;
    const current = dueByCollaboration.get(collaborationId);
    if (!current || due.getTime() < current.getTime()) dueByCollaboration.set(collaborationId, due);
  }
  const activeCollaborations: HomePipelineItem[] = (hub?.pipeline ?? [])
    .filter((item) => isCurrentCollaboration(item))
    .slice(0, 4)
    .map((item) => {
      const due = dueByCollaboration.get(item.id);
      const shown = agreementPresentation(item);
      return {
        id: item.id,
        title: item.title,
        counterparty: item.counterparty,
        stage: shown.label,
        href: shown.href,
        next: due ? deliverableWhen(due) : shown.next,
      };
    });

  const invitationRows = (hub?.applications ?? []).filter(
    (row) =>
      applicationIsInvitation(row) &&
      applicationIsOpenPipeline(row.status) &&
      (row.toSlug === slug || row.creatorSlug === slug),
  );
  const attention: HomeAttentionItem[] = [
    ...invitationRows.map((row) => ({
      id: `invitation:${row.id}`,
      title: row.requestBrand || row.opportunityLookingFor || "Campaign invitation",
      detail: "New campaign invitation",
      action: "Review invitation",
      href: `/collaboration/applications/${row.id}`,
      kind: "invitation" as const,
    })),
    ...teamProposals
      .filter((proposal) => proposal.members.some((member) => member.creatorSlug === slug && member.status === "invited"))
      .map((proposal) => ({
        id: `invitation:team:${proposal.id}`,
        title: proposal.title,
        detail: "New campaign invitation",
        action: "Review invitation",
        href: `/collaboration/team/${proposal.id}`,
        kind: "invitation" as const,
      })),
    ...contracts
      .filter((contract) => contractNeedsSignature(contract, userId, account?.email ?? ""))
      .map((contract) => ({
        id: `agreement:${contract.id}`,
        title: contract.title,
        detail: "Your signature is needed",
        action: "Review agreement",
        href: `/collaboration/contracts/${contract.id}#sign`,
        kind: "agreement" as const,
      })),
    ...deliverables
      .filter((row) => row.deliverableDueAt)
      .map((row) => ({
        id: `deliverable:${row.id}`,
        title: row.funding.title || row.title,
        detail: deliverableWhen(row.deliverableDueAt as Date),
        action: "Open workspace",
        href: `/collaboration/work/${row.funding.id}`,
        kind: "deliverable" as const,
      })),
  ];

  const pipeline: HomePipelineItem[] = activeCollaborations;

  const methodSubmitted =
    creator?.payoutProfile?.primaryStatus === "VERIFIED" ||
    creator?.payoutProfile?.primaryStatus === "PENDING" ||
    creator?.payoutProfile?.secondaryStatus === "VERIFIED" ||
    creator?.payoutProfile?.secondaryStatus === "PENDING";
  const payoutReady = Boolean(hub?.payout.readiness?.globalPayoutReady);
  const payoutBlocker = hub?.payout.readiness?.blockers[0] ?? "";
  const identityDone = Boolean(hub?.payout.readiness?.identityVerified || creator?.identityVerified === "VERIFIED");
  const published = creator?.card?.published === true || draft?.stage === "published";
  const claimed = Boolean(creator || (draft && draft.stage !== "draft"));
  const emailVerified = Boolean(user?.emailVerifiedAt || draft?.stage === "verified" || draft?.stage === "published");
  const bio = displayBio(creator?.bio || draft?.bio);
  const specialties =
    creator?.specialties.map((row) => row.specialty.name) ??
    (draft?.specialties.map((item) => specialtyLabel(item)) || []);
  const city = (creator?.locationCity || draft?.locationCity || "").trim();
  const country = (creator?.locationCountry || draft?.locationCountry || "").trim();
  const locationDone = city.length > 0 && country.length > 0 && city !== "Your city" && country !== "Your country";
  const photos = mediaKitPhotos(creator?.avatarUrl || draft?.image, creator?.coverUrl || draft?.coverImage);
  const oauthConnected = socials.some((social) => social.status === "connected");
  const profileHref = draft ? "/dashboard" : slug ? "/dashboard" : "/claim";
  const checklist: HomeChecklistItem[] = [
    { id: "claimed", label: "Build your profile", done: claimed, href: claimed ? profileHref : "/claim" },
    { id: "email", label: "Verify email", done: emailVerified, href: "/account" },
    { id: "published", label: "Publish Starter card", done: published, href: published && slug ? `/c/${slug}` : "/claim" },
    { id: "bio", label: "Write a short bio", done: bio.length >= 24, href: profileHref },
    { id: "location", label: "Set location", done: locationDone, href: profileHref },
    { id: "specialty", label: "Confirm specialty", done: specialties.length > 0, href: profileHref },
    { id: "social", label: "Connect a social account", done: oauthConnected, href: "/dashboard/social" },
    {
      id: "payout",
      label: payoutReady
        ? "Payouts ready"
        : methodSubmitted || hub?.payout.readiness?.hasVerifiedMethod
          ? payoutBlocker || "Finish identity and payout-region checks"
          : "Add a payout method",
      done: payoutReady,
      href: "/creator/earnings#payouts",
    },
  ];

  const completion = draft ? completenessFor(draft) : null;
  const monthCents = releases.reduce((sum, row) => sum + row.amountCents, 0);
  const currency = earningsFailed
    ? ""
    : sharedCurrency(fundingCurrencies.map((row) => row.currency)) || hub?.earnings.currency || "";
  const earnings: HomeEarnings = {
    failed: earningsFailed,
    cents: earningsFailed ? 0 : monthCents,
    currency,
    note: earningsSummaryNote({ failed: earningsFailed, currency, cents: monthCents }),
  };
  const pendingInvitations = attention.filter((item) => item.kind === "invitation").length;
  await syncAccountNotices(
    userId,
    attention.map((item) => ({
      kind: item.kind,
      sourceId: item.id,
      title: item.title,
      detail: item.detail,
      href: item.href,
    })),
  ).catch((error) => {
    console.error("account notices", error);
  });

  return {
    displayName: creator?.displayName || draft?.displayName || user?.name || account?.name || "Creator",
    firstName: ((user?.name || account?.name || creator?.displayName || "").trim().split(/\s+/)[0] ?? "") || "",
    slug,
    bio,
    title: (creator?.title || draft?.title || "").trim(),
    specialties,
    avatar: creator?.avatarUrl || draft?.image || null,
    identityVerified: identityDone,
    cardHref: slug ? `/c/${slug}` : "/claim",
    profileHref,
    shortLabel: shortLink ? `${host}/${shortLink.slug}` : "",
    photos,
    mediaPublished: published && photos.length > 0,
    socials,
    cardPlatforms: socials.map((social) => social.platform),
    opportunities,
    opportunityCount,
    pipeline,
    contracts,
    payoutReady,
    identityDone,
    checklist,
    checklistDone: checklist.filter((item) => item.done).length,
    visitCount: recentVisits.length,
    visitCount30: visitLoad.failed ? null : shortLink ? visits30.length : null,
    visitsFailed: visitLoad.failed,
    visitAllTime: visitEvents.length,
    visitSeries,
    visitDelta: visitDelta(visitSeries),
    activeCollabs: activeCollaborations.length,
    pendingInvitations,
    attention,
    monthCents: earnings.cents,
    currency: earnings.currency,
    earnings,
    incomplete: completion ? completion.score < 100 || checklist.some((item) => !item.done) : checklist.some((item) => !item.done),
    completionScore: checklist.length
      ? Math.round((checklist.filter((item) => item.done).length / checklist.length) * 100)
      : 0,
    published,
    hasCard: Boolean(creator || draft),
  };
}

export function contractNeedsSignature(
  contract: { signingChannel: string; status: string; parties: { userId: string | null; email: string; status: string }[] },
  userId: string,
  email: string,
) {
  const yours = contract.parties.find(
    (row) => row.userId === userId || row.email.trim().toLowerCase() === email.trim().toLowerCase(),
  );
  return (
    contract.signingChannel === "native" &&
    (contract.status === "sent" || contract.status === "draft") &&
    yours?.status === "pending"
  );
}

export { contractPartyProgress };
