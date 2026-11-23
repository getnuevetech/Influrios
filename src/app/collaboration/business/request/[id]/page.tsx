import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { RequestEditor } from "@/components/account/request-editor";
import { CopyTextButton } from "@/components/copy-text-button";
import { appOrigin } from "@/lib/creator-og";
import { getPublishedBusinessRequest } from "@/lib/marketplace-listings";
import { getAccountSession } from "@/lib/accounts";
import { getWorkspace, parseLocationParts } from "@/lib/business";
import { campaignEditLocked } from "@/lib/campaign-contract";
import { listFxRates } from "@/lib/settlement";
import { getDirectory } from "@/lib/directory";
import { SPECIALTY_TAXONOMY, specialtyLabel } from "@/lib/seed-data";
import { prisma } from "@/lib/db";
import { composerStep, draftRecipientSlugs, requestVisibility } from "@/lib/request-composer";

export const dynamic = "force-dynamic";
export const metadata = { title: "Request · Collaborations" };

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; saved?: string; creator?: string; step?: string; sent?: string }>;
};

export default async function RequestEditorPage({ params, searchParams }: Props) {
  const { id } = await params;
  const query = await searchParams;
  const account = await getAccountSession().catch(() => null);
  if (!account) redirect(`/login?next=${encodeURIComponent(`/collaboration/business/request/${id}`)}`);
  const workspace = await getWorkspace(account.id).catch(() => null);
  if (!workspace) notFound();
  const brief = id === "new" ? null : workspace.briefs.find((item) => item.id === id) ?? null;
  if (id !== "new" && !brief) notFound();
  const directory = await getDirectory().catch(() => null);
  const taxonomy = directory?.taxonomy?.length ? directory.taxonomy : SPECIALTY_TAXONOMY.map((item) => ({ slug: item.slug, name: item.name }));
  const fx = await listFxRates().catch(() => []);
  const currency = brief?.budgetCurrency || "USD";
  const currencies = [...new Set([currency, "USD", ...fx.filter((row) => row.active).map((row) => row.currency)])];
  const location = parseLocationParts(brief?.location ?? "");
  const markets = await prisma.country
    .findMany({ where: { enabled: true }, select: { code: true, name: true }, orderBy: { name: "asc" } })
    .catch(() => []);
  const creators = (directory?.creators ?? []).slice(0, 80).map((creator) => ({
    slug: creator.slug,
    name: creator.displayName,
    handle: creator.socials[0]?.handle || creator.slug,
    country: creator.locationCountry,
    specialties: creator.specialties.map((slug) => specialtyLabel(slug)).join(", "),
  }));
  const initialSlugs = draftRecipientSlugs([query.creator, brief?.draftRecipients].filter(Boolean).join(","));
  const visibility = requestVisibility(brief?.distribution, initialSlugs.length > 0);
  const deliveries = brief
    ? await prisma.marketplaceApplication.findMany({
        where: { briefId: brief.id, kind: "business_request" },
        select: { id: true, toSlug: true, fromSlug: true, status: true },
        orderBy: { createdAt: "asc" },
      }).catch(() => [])
    : [];
  const invites = deliveries.filter((row) => row.toSlug);
  const applications = deliveries.filter((row) => row.fromSlug && !row.toSlug);
  const listing = brief
    ? await prisma.marketplaceBusinessRequest.findFirst({
        where: { briefId: brief.id, workspaceId: workspace.businessId, status: "published" },
        select: { id: true },
      }).catch(() => null)
    : null;
  const listingPreview = listing && applications.length === 0 ? await getPublishedBusinessRequest(listing.id).catch(() => null) : null;

  // After sending or publishing, show the outcome — never reopen the editor at step 1 (AUD-WIZ-01).
  const sentOrPublished = query.saved === "invites" || query.saved === "published";

  return (
    <div className="fixed inset-0 z-40 flex items-start justify-center overflow-y-auto bg-[#1B1464]/40 px-4 py-8">
      <div className="w-full max-w-3xl" role="dialog" aria-modal="true" aria-labelledby="request-composer-title">
        <div className="mb-3 flex justify-end">
          <Link href="/collaboration/business?tab=requests" className="rounded-full bg-white px-4 py-2 text-sm font-bold text-[#1B1464]">
            Close
          </Link>
        </div>
        {sentOrPublished ? (
          <section role="status" className="mb-3 rounded-[28px] bg-white p-6 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-emerald-700">
              {query.saved === "invites" ? "Invitations sent" : "Request published"}
            </p>
            <h2 className="mt-1 font-display text-2xl font-bold text-[#1B1464]">{brief?.title || "Your request"}</h2>
            <p className="mt-2 text-sm text-[#344054]">
              {query.saved === "invites"
                ? `${query.sent ? `${query.sent} private invitation${query.sent === "1" ? "" : "s"}` : "Private invitations"} sent. Each influencer sees only their own invitation. Nothing was signed or charged.`
                : query.sent
                  ? `Your request is public, so eligible influencers can apply. The ${query.sent === "1" ? "influencer" : `${query.sent} influencers`} you chose also got a direct invitation.`
                  : "Your request is public. Eligible influencers can find it in Opportunities and apply."}
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Link href="/collaboration/business?tab=requests" className="rounded-full bg-[#6D4AFF] px-4 py-2 text-sm font-bold text-white">
                Back to requests
              </Link>
              {brief ? (
                <Link href={`/collaboration/business/request/${encodeURIComponent(brief.id)}?step=0`} className="rounded-full border border-[#E4E9F5] px-4 py-2 text-sm font-bold text-[#1B1464]">
                  Edit request
                </Link>
              ) : null}
            </div>
          </section>
        ) : null}
        {invites.length > 0 ? (
          <ul className="mb-3 divide-y divide-[#EEF2F7] rounded-2xl bg-white px-4 text-sm">
            {invites.map((row) => (
              <li key={row.id} className="flex justify-between gap-3 py-2">
                <span className="font-semibold text-[#1B1464]">{row.toSlug}</span>
                <span className="text-[#667085]">{row.status.replaceAll("_", " ")}</span>
              </li>
            ))}
          </ul>
        ) : null}
        {visibility === "public" && listing && applications.length === 0 ? (
          <div className="mb-3 space-y-3 rounded-2xl bg-white px-4 py-3 text-sm text-[#667085]">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p>No applications yet. Share the listing link with influencers.</p>
              <CopyTextButton value={`${appOrigin()}/collaboration/requests/${listing.id}`} label="Copy listing link" />
            </div>
            {listingPreview ? (
              <details className="rounded-xl border border-[#E6ECF7] px-3 py-2">
                <summary className="cursor-pointer font-semibold text-[#1B1464]">Preview what influencers see</summary>
                <div className="mt-2 space-y-2">
                  <p className="font-display text-lg font-bold text-[#1B1464]">{listingPreview.brand}</p>
                  <p>{[listingPreview.category, listingPreview.location, listingPreview.budget].filter(Boolean).join(" · ")}</p>
                  <p className="whitespace-pre-wrap text-[#4E5872]">{listingPreview.summary || "No summary provided."}</p>
                  {listingPreview.lookingFor ? (
                    <p className="whitespace-pre-wrap text-[#4E5872]">
                      <span className="font-semibold text-[#1B1464]">Looking for: </span>
                      {listingPreview.lookingFor}
                    </p>
                  ) : null}
                </div>
              </details>
            ) : null}
          </div>
        ) : null}
        {sentOrPublished ? null : (
        <RequestEditor
          briefId={brief?.id ?? ""}
          locked={brief ? campaignEditLocked(brief) : false}
          error={query.error}
          saved={query.saved}
          title={brief?.title ?? ""}
          goal={brief?.goal ?? ""}
          deliverables={brief?.deliverables || brief?.summary || ""}
          budget={brief?.budget ?? ""}
          currency={currency}
          currencies={currencies}
          deadline={brief?.responseDeadline ?? ""}
          locationCountry={location.country || location.city}
          markets={markets}
          specialties={taxonomy.map((item) => ({ slug: item.slug, name: item.name }))}
          specialty={brief?.specialty ?? ""}
          platforms={["Instagram", "TikTok", "YouTube"]}
          platform={brief?.platform ?? ""}
          creators={creators}
          initialSlugs={initialSlugs}
          initialStep={composerStep(query.step)}
          initialVisibility={visibility}
        />
        )}
      </div>
    </div>
  );
}
