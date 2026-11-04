import { getAccountSession } from "@/lib/accounts";
import { classifyProfileTopics } from "@/lib/ai-runtime";
import { completenessFor, getCreatorSessionDraft } from "@/lib/claim";
import { getDirectory } from "@/lib/directory";
import { COMMERCIAL_MODE, CONTENT_STYLE, listDiscoveryFacets } from "@/lib/discovery-facets";
import { entitlementsForPlan } from "@/lib/entitlements-db";
import { getInfluencerIdentity } from "@/lib/landing-pages";
import { listFundingsForCreator, marketplaceConfig } from "@/lib/marketplace-ledger";
import { getCreatorOptIn, listIntrosForCreator } from "@/lib/managed-matching";
import { listDisputeReasons } from "@/lib/milestone-disputes";
import { listReferralsForCreator } from "@/lib/referrals";
import { SPECIALTY_TAXONOMY } from "@/lib/seed-data";
import {
  ensureCreatorShortLink,
  getCreatorShortLinkAnalytics,
  listCreatorCampaignLinks,
  listPendingShortLinkSchedules,
  listShortLinkDestinationHistory,
  listShortLinkSlugHistory,
  primaryShortHost,
} from "@/lib/short-link";
import { canAddCampaignLink } from "@/lib/short-link-phase4";
import { socialConnectState } from "@/lib/social-connect";
import { redirect } from "next/navigation";

export async function requireCreatorDraft() {
  const draft = await getCreatorSessionDraft();
  if (!draft) {
    const account = await getAccountSession().catch(() => null);
    if (!account) redirect("/login?next=/creator");
    redirect("/creator");
  }
  return draft;
}

export async function loadCreatorProfileBundle() {
  const draft = await requireCreatorDraft();
  const optIn = await getCreatorOptIn(draft.slug).catch(() => null);
  const intros = await listIntrosForCreator(draft.slug).catch(() => []);
  const [directory, identity, facetCatalog] = await Promise.all([
    getDirectory().catch(() => null),
    getInfluencerIdentity().catch(() => null),
    listDiscoveryFacets().catch(() => []),
  ]);
  const selfDescriptions =
    identity?.selfDescriptions?.length
      ? identity.selfDescriptions
      : ["Influencer", "Content Creator", "Other"];
  const specialtyGroups = (
    directory?.taxonomy ??
    SPECIALTY_TAXONOMY.map((parent) => ({
      slug: parent.slug,
      name: parent.name,
      active: true,
      children: (parent.children ?? []).map((child) => ({ ...child, active: true })),
    }))
  ).filter((parent) => parent.active);

  const social = await socialConnectState(draft.slug).catch(() => null);
  const planCode = draft.planTier || "STARTER";
  const linkLimits = await entitlementsForPlan(planCode).catch(() => null);
  const shortLink =
    draft.stage === "published" ? await ensureCreatorShortLink(draft.slug).catch(() => null) : null;
  const shortHost = await primaryShortHost().catch(() => "inflr.me");
  const destinationHistory =
    shortLink && linkLimits?.dynamicQr
      ? await listShortLinkDestinationHistory(shortLink.id, 5).catch(() => [])
      : [];
  const pendingSchedules =
    shortLink && linkLimits?.dynamicQr && shortLink.dynamic
      ? await listPendingShortLinkSchedules(shortLink.id).catch(() => [])
      : [];
  const campaignLinks = shortLink ? await listCreatorCampaignLinks(draft.slug).catch(() => []) : [];
  const slugHistory = shortLink ? await listShortLinkSlugHistory(shortLink.id).catch(() => []) : [];
  const referrals = await listReferralsForCreator(draft.slug).catch(() => []);
  const campaignMax = linkLimits?.campaignLinksMax ?? 0;
  const campaignRoom = canAddCampaignLink({
    campaignMax,
    campaignCount: campaignLinks.length,
  });
  const linkAnalytics =
    shortLink && shortLink.status === "active"
      ? await getCreatorShortLinkAnalytics(draft.slug).catch(() => null)
      : null;
  const topics = await classifyProfileTopics(`${draft.title}\n${draft.bio}`).catch(() => ({
    suggestions: [] as { slug: string; name: string; reason?: string }[],
    source: "fallback" as const,
    providerError: undefined as string | undefined,
  }));
  const suggestionRows = new Map<string, { slug: string; name: string; reason?: string }>();
  for (const item of topics.suggestions) suggestionRows.set(item.slug, item);
  for (const slug of draft.specialties) {
    if (!suggestionRows.has(slug)) suggestionRows.set(slug, { slug, name: slug });
  }
  const specialtyCap = linkLimits?.specialtiesMax ?? 1;
  const [fundings, disputeReasons, marketplace] = await Promise.all([
    listFundingsForCreator(draft.slug).catch(() => []),
    listDisputeReasons().catch(() => []),
    marketplaceConfig().catch(() => null),
  ]);
  const activeReasons = disputeReasons.filter((reason) => reason.active);
  const { score, items } = completenessFor(draft);
  const nextActions = items.filter((i) => !i.done).slice(0, 5);
  const contentStyles = facetCatalog.filter((row) => row.kind === CONTENT_STYLE && row.active);
  const commercialModes = facetCatalog.filter((row) => row.kind === COMMERCIAL_MODE && row.active);

  const specialtyName = (slug: string) => {
    for (const group of specialtyGroups) {
      if (group.slug === slug) return group.name;
      const child = group.children.find((c) => c.slug === slug);
      if (child) return child.name;
    }
    return slug;
  };

  const activeIntros = intros.filter((i) =>
    ["outreach", "introduced", "in_conversation", "paid"].includes(i.status),
  );
  const historyIntros = intros.filter((i) => ["declined", "closed"].includes(i.status));

  return {
    draft,
    optIn,
    intros,
    activeIntros,
    historyIntros,
    specialtyGroups,
    selfDescriptions,
    social,
    planCode,
    linkLimits,
    shortLink,
    shortHost,
    destinationHistory,
    pendingSchedules,
    campaignLinks,
    slugHistory,
    referrals,
    campaignMax,
    campaignRoom,
    linkAnalytics,
    topics,
    suggestionRows,
    specialtyCap,
    fundings,
    activeReasons,
    marketplace,
    score,
    items,
    nextActions,
    contentStyles,
    commercialModes,
    specialtyName,
  };
}

export type CreatorProfileBundle = Awaited<ReturnType<typeof loadCreatorProfileBundle>>;
