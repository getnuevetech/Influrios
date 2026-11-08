import { redirect } from "next/navigation";
import { CreatorCollaborations } from "@/components/account/creator-collaborations";
import { CreatorOpportunities } from "@/components/account/creator-opportunities";
import { getAccountSession } from "@/lib/accounts";
import { getCreatorSessionDraft } from "@/lib/claim";
import { collabOsV1Enabled } from "@/lib/collab-os";
import { loadCreatorHub, scoreBusinessRequestForCreator } from "@/lib/collaboration-hub";
import { getCms } from "@/lib/cms";
import { prisma } from "@/lib/db";
import { getDirectoryCreator, indexCreatorsBySlug, getDirectory } from "@/lib/directory";
import { cardsFromStoredCollaborationMatches } from "@/lib/matching";
import {
  listMarketplaceApplications,
  listPublishedBusinessRequests,
  listPublishedCreatorOpportunities,
  listSavedListings,
} from "@/lib/marketplace-listings";
import { listTeamProposalsForCreator } from "@/lib/team-proposal";

export const dynamic = "force-dynamic";

type Props = {
  searchParams: Promise<{
    q?: string;
    category?: string;
    platform?: string;
    location?: string;
    budget?: string;
    type?: string;
    tab?: string;
    sort?: string;
    view?: string;
    saved?: string;
    applied?: string;
    error?: string;
  }>;
};

type HubView = "opportunities" | "collaborations";

function resolveHubView(raw: string | undefined): HubView {
  return raw === "collaborations" ? "collaborations" : "opportunities";
}

export async function generateMetadata({ searchParams }: Props) {
  const params = await searchParams;
  return { title: resolveHubView(params.view) === "collaborations" ? "Collaborations" : "Opportunities" };
}

export default async function CollaborationHubPage({ searchParams }: Props) {
  if (!(await collabOsV1Enabled().catch(() => true))) {
    redirect("/collaboration/propose?notice=collab_os_off");
  }
  const params = await searchParams;
  const view = resolveHubView(params.view);
  const account = await getAccountSession().catch(() => null);
  if (!account) {
    redirect(`/login?next=${encodeURIComponent("/collaboration/hub")}&gate=hub`);
  }

  const draft = await getCreatorSessionDraft().catch(() => null);
  if (!draft?.slug) {
    redirect("/claim");
  }

  const creator = await getDirectoryCreator(draft.slug);
  if (!creator) {
    redirect("/claim");
  }

  const [hub, directory, cms, teamProposals] = await Promise.all([
    loadCreatorHub({ userId: account.id, creator }),
    getDirectory().catch(() => null),
    getCms().catch(() => null),
    listTeamProposalsForCreator(draft.slug).catch(() => []),
  ]);
  const bySlug = indexCreatorsBySlug(directory?.creators ?? []);
  const matchCards = cardsFromStoredCollaborationMatches(cms?.collaborationMatches.matches ?? []);

  if (view === "collaborations") {
    const weekEnd = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const milestones = await prisma.fundingMilestone
      .findMany({
        where: {
          releaseScheduledAt: { not: null },
          funding: { creatorSlug: draft.slug },
        },
        orderBy: { releaseScheduledAt: "asc" },
        take: 8,
        select: {
          id: true,
          title: true,
          releaseScheduledAt: true,
          funding: { select: { title: true, businessName: true } },
        },
      })
      .catch(() => []);
    const deadlines = milestones
      .filter((row) => row.releaseScheduledAt && row.releaseScheduledAt.getTime() >= Date.now())
      .map((row) => ({
        id: row.id,
        title: row.funding.businessName || row.funding.title,
        detail: row.title,
        at: row.releaseScheduledAt as Date,
      }));
    const names: Record<string, string> = {};
    for (const row of hub.pipeline) {
      const creatorRow = bySlug.get(row.counterparty);
      if (creatorRow) names[row.counterparty] = creatorRow.displayName;
    }
    return (
      <CreatorCollaborations
        hub={hub}
        proposals={teamProposals}
        creatorSlug={draft.slug}
        names={names}
        deadlines={deadlines}
        dueThisWeek={deadlines.filter((row) => row.at.getTime() <= weekEnd.getTime()).length}
        tab={params.tab}
        query={params.q?.trim() ?? ""}
        savedMatches={hub.saved.map((row) => ({
          id: row.saveId,
          title: `${bySlug.get(row.partyASlug)?.displayName || row.partyASlug} × ${bySlug.get(row.partyBSlug)?.displayName || row.partyBSlug}`,
          detail: row.why,
          href: `/collaboration/propose?a=${encodeURIComponent(row.partyASlug)}&b=${encodeURIComponent(row.partyBSlug)}&from=${encodeURIComponent(draft.slug)}`,
        }))}
      />
    );
  }

  const [requests, openings, saves, applications] = await Promise.all([
    listPublishedBusinessRequests().catch(() => []),
    listPublishedCreatorOpportunities().catch(() => []),
    listSavedListings(account.id).catch(() => []),
    listMarketplaceApplications({ creatorSlug: draft.slug, limit: 100 }).catch(() => []),
  ]);
  const q = params.q?.trim().toLowerCase() ?? "";
  const platform = params.platform?.trim().toLowerCase() ?? "";
  const filteredRequests = requests.filter((item) => {
    if (params.budget && item.budget !== params.budget) return false;
    if (params.location && !item.location.toLowerCase().includes(params.location.toLowerCase())) return false;
    if (params.category) {
      const hay = `${item.category} ${item.tags.join(" ")}`.toLowerCase();
      if (!hay.includes(params.category.toLowerCase())) return false;
    }
    if (platform && !item.tags.some((tag) => tag.toLowerCase().includes(platform))) return false;
    if (q) {
      const hay = `${item.brand} ${item.summary} ${item.lookingFor}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
  const scored = filteredRequests
    .map((request) => ({ request, score: scoreBusinessRequestForCreator(request, creator) }))
    .sort((a, b) => (params.sort === "name" ? a.request.brand.localeCompare(b.request.brand) : b.score - a.score));
  const filteredOpenings = openings
    .filter((item) => item.creatorSlug !== draft.slug)
    .filter((item) => {
      const row = bySlug.get(item.creatorSlug);
      if (params.location && row && !`${row.locationCity} ${row.locationCountry}`.toLowerCase().includes(params.location.toLowerCase())) {
        return false;
      }
      if (params.category) {
        const hay = `${item.lookingFor} ${item.summary} ${row?.specialties.join(" ") ?? ""}`.toLowerCase();
        if (!hay.includes(params.category.toLowerCase())) return false;
      }
      if (q) {
        const hay = `${row?.displayName ?? ""} ${item.lookingFor} ${item.summary}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  const categories = [
    ...new Set([
      ...requests.map((item) => item.category.trim()).filter(Boolean),
      ...matchCards.map((card) => card.specialty.trim()).filter(Boolean),
    ]),
  ].slice(0, 12);
  const budgets = [...new Set(requests.map((item) => item.budget.trim()).filter(Boolean))].slice(0, 12);
  const tab = params.type === "campaigns" || params.type === "openings" ? params.type : params.tab;

  return (
    <CreatorOpportunities
      requests={scored.map((row) => ({ ...row.request, score: row.score }))}
      openings={filteredOpenings.map((item) => {
        const row = bySlug.get(item.creatorSlug);
        return {
          id: item.id,
          creatorSlug: item.creatorSlug,
          creatorName: row?.displayName || item.creatorSlug,
          image: row?.image || null,
          lookingFor: item.lookingFor,
          summary: item.summary,
          location: item.location || [row?.locationCity, row?.locationCountry].filter(Boolean).join(", "),
        };
      })}
      partners={hub.creatorMatches.slice(0, 6).map((match) => ({
        aSlug: match.a.slug,
        bSlug: match.b.slug,
        aName: match.a.displayName,
        bName: match.b.displayName,
        score: match.score,
        why: match.why,
      }))}
      savedMatches={hub.saved.map((row) => ({
        saveId: row.saveId,
        partyASlug: row.partyASlug,
        partyBSlug: row.partyBSlug,
        aName: bySlug.get(row.partyASlug)?.displayName || row.partyASlug,
        bName: bySlug.get(row.partyBSlug)?.displayName || row.partyBSlug,
        score: row.score,
        why: row.why,
      }))}
      savedKeys={saves.map((row) => `${row.kind}:${row.listingId}`)}
      applications={applications}
      categories={categories}
      budgets={budgets}
      filters={{
        q: params.q?.trim() ?? "",
        category: params.category?.trim() ?? "",
        platform: params.platform?.trim() ?? "",
        location: params.location?.trim() ?? "",
        budget: params.budget?.trim() ?? "",
        tab: tab ?? "recommended",
        sort: params.sort ?? "",
      }}
      creatorSlug={draft.slug}
      notice={
        params.error
          ? { kind: "error", text: params.error }
          : params.applied
            ? { kind: "applied" }
            : params.saved
              ? { kind: "saved" }
              : null
      }
    />
  );
}
