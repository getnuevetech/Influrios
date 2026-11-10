import { redirect } from "next/navigation";
import { BusinessCollaborations } from "@/components/account/business-collaborations";
import { actionAcceptBusinessTerms } from "@/app/collaboration/business/actions";
import { getAccountSession } from "@/lib/accounts";
import { getWorkspace } from "@/lib/business";
import { collabOsV1Enabled } from "@/lib/collab-os";
import { hasCurrentLegalRecord } from "@/lib/legal";
import { listMarketplaceApplications, listWorkspaceBusinessRequests } from "@/lib/marketplace-listings";
import { getDirectory } from "@/lib/directory";
import { prisma } from "@/lib/db";
import { formatFollowers, specialtyLabel } from "@/lib/seed-data";
import { loadBusinessHub } from "@/lib/collaboration-hub";
import { formatStoredMoney } from "@/lib/money";

export const dynamic = "force-dynamic";
export const metadata = { title: "Collaborations · Influrios" };

type Props = {
  searchParams: Promise<{
    tab?: string;
    view?: string;
    filter?: string;
    q?: string;
    request?: string;
    deal?: string;
    error?: string;
    saved?: string;
    intent?: string;
  }>;
};

export default async function BusinessCollaborationPage({ searchParams }: Props) {
  if (!(await collabOsV1Enabled().catch(() => true))) {
    redirect("/collaboration/propose?notice=collab_os_off");
  }
  const params = await searchParams;
  if (params.intent === "new") redirect("/collaboration/business/request/new");
  if (params.intent) redirect(`/collaboration/business/request/${encodeURIComponent(params.intent)}`);
  const account = await getAccountSession().catch(() => null);
  if (!account) redirect(`/login?next=${encodeURIComponent("/collaboration/business")}&gate=business`);
  const accepted = await hasCurrentLegalRecord({ documentKey: "business-terms", userId: account.id }).catch(() => false);
  if (!accepted) {
    return (
      <form action={actionAcceptBusinessTerms} className="mx-auto max-w-xl px-4 py-10">
        <h1 className="font-display text-3xl font-bold text-[#1B1464]">Collaborations</h1>
        <p className="mt-2 text-sm text-[#667085]">Agree to the Business terms before creating requests.</p>
        <label className="mt-4 flex items-center gap-2 text-sm">
          <input type="checkbox" name="acceptBusiness" /> I agree to the Business / Brand Terms
        </label>
        <button className="mt-4 rounded-full bg-[#6D4AFF] px-4 py-2 text-sm font-bold text-white">Continue</button>
      </form>
    );
  }
  const workspace = await getWorkspace(account.id).catch(() => null);
  if (!workspace) {
    return <p className="px-6 py-10 text-sm">The collaboration workspace is unavailable right now. Refresh to try again.</p>;
  }
  const [published, directory] = await Promise.all([
    listWorkspaceBusinessRequests(workspace.businessId).catch(() => []),
    getDirectory().catch(() => null),
  ]);
  const applications = await listMarketplaceApplications({
    businessRequestIds: published.map((row) => row.id),
    briefIds: workspace.briefs.map((brief) => brief.id),
    limit: 100,
  }).catch(() => []);
  const applicationIds = applications.map((row) => row.id);
  const contracts = applicationIds.length
    ? await prisma.contractDocument.findMany({
        where: { applicationId: { in: applicationIds }, status: { notIn: ["voided", "declined"] } },
        select: { applicationId: true },
      }).catch(() => [])
    : [];
  const contracted = new Set(contracts.map((row) => row.applicationId).filter((id): id is string => Boolean(id)));
  const bySlug = new Map((directory?.creators ?? []).map((creator) => [creator.slug, creator]));
  const tab = params.tab === "opportunities" || params.tab === "active" ? params.tab : "requests";
  const hub = await loadBusinessHub({ userId: account.id }).catch(() => null);
  const creators = (directory?.creators ?? []).slice(0, 40).map((creator) => ({
    slug: creator.slug,
    name: creator.displayName,
    handle: creator.socials[0]?.handle || creator.slug,
    followers: formatFollowers(creator.socials.reduce((sum, social) => sum + (social.followers || 0), 0)),
    specialties: creator.specialties.slice(0, 3).map((slug) => specialtyLabel(slug)).join(", "),
    country: creator.locationCountry,
    platforms: creator.socials.map((social) => social.platform.slice(0, 1) + social.platform.slice(1).toLowerCase()),
    image: creator.image,
    blurb: creator.bio.slice(0, 140),
  }));

  return (
    <>
    {hub ? (
      <p className="px-6 pt-6 text-sm text-muted">
        Funded {formatStoredMoney(hub.spend.fundedCents, hub.spend.currency)}
      </p>
    ) : null}
    <BusinessCollaborations
      tab={tab}
      view={params.view === "applications" ? "applications" : "recommended"}
      filter={params.filter ?? ""}
      query={params.q ?? ""}
      requestId={params.request ?? ""}
      dealId={params.deal ?? ""}
      error={params.error}
      saved={params.saved}
      briefs={workspace.briefs}
      publishedBriefIds={published.map((row) => row.briefId).filter((id): id is string => Boolean(id))}
      applications={applications.map((application) => {
        const creator = application.creatorSlug ? bySlug.get(application.creatorSlug) : undefined;
        const brief = workspace.briefs.find((item) => item.id === (application.briefId || application.requestBriefId));
        return {
          id: application.id,
          status: application.status,
          creatorSlug: application.creatorSlug,
          creatorName: creator?.displayName || application.creatorSlug || "Influencer",
          image: creator?.image || "",
          title: brief?.title || application.requestBrand || "Collaboration",
          briefId: application.briefId || application.requestBriefId,
          businessRequestId: application.businessRequestId,
          collaborationId: application.collaborationId,
          invitation: !application.fromSlug && Boolean(application.toSlug),
          hasContract: contracted.has(application.id),
          note: application.note ?? "",
        };
      })}
      creators={creators}
      requestsForInvite={workspace.briefs.filter((brief) => brief.status !== "closed").map((brief) => ({ id: brief.id, title: brief.title || "Untitled request" }))}
    />
    </>
  );
}
