import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { RequestEditor } from "@/components/account/request-editor";
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

  return (
    <div className="fixed inset-0 z-40 flex items-start justify-center overflow-y-auto bg-[#1B1464]/40 px-4 py-8">
      <div className="w-full max-w-3xl" role="dialog" aria-modal="true" aria-labelledby="request-composer-title">
        <div className="mb-3 flex justify-end">
          <Link href="/collaboration/business?tab=requests" className="rounded-full bg-white px-4 py-2 text-sm font-bold text-[#1B1464]">
            Close
          </Link>
        </div>
        {query.saved === "invites" ? (
          <p className="mb-3 rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-emerald-800">
            {query.sent ? `${query.sent} invitation${query.sent === "1" ? "" : "s"} recorded.` : "Invitations recorded."} Each recipient has a private invitation. Nothing was charged.
          </p>
        ) : null}
        {query.saved === "published" ? (
          <p className="mb-3 rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-emerald-800">
            The listing is public. Invitations were not sent.
          </p>
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
          <p className="mb-3 rounded-2xl bg-white px-4 py-3 text-sm text-[#667085]">
            No applications yet.{" "}
            <Link href={`/collaboration/requests/${listing.id}`} className="font-bold text-[#6D4AFF]">
              Share the public listing
            </Link>
          </p>
        ) : null}
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
          specialties={taxonomy.map((item) => ({ slug: item.slug, name: item.name }))}
          specialty={brief?.specialty ?? ""}
          platforms={["Instagram", "TikTok", "YouTube"]}
          platform={brief?.platform ?? ""}
          creators={creators}
          initialSlugs={initialSlugs}
          initialStep={composerStep(query.step)}
          initialVisibility={visibility}
        />
      </div>
    </div>
  );
}
