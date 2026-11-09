import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { RequestEditor } from "@/components/account/request-editor";
import { getAccountSession } from "@/lib/accounts";
import { getWorkspace, parseLocationParts } from "@/lib/business";
import { campaignEditLocked } from "@/lib/campaign-contract";
import { listFxRates } from "@/lib/settlement";
import { getDirectory } from "@/lib/directory";
import { SPECIALTY_TAXONOMY, specialtyLabel } from "@/lib/seed-data";

export const dynamic = "force-dynamic";
export const metadata = { title: "Request · Collaborations" };

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; saved?: string; creator?: string }>;
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

  return (
    <div className="mx-auto grid max-w-6xl gap-4 px-4 py-6 lg:grid-cols-[16rem_1fr]">
      <div>
        <Link href="/collaboration/business?tab=requests" className="text-sm font-bold text-[#6D4AFF]">Back to requests</Link>
        <ul className="mt-4 hidden space-y-2 lg:block">
          {workspace.briefs.slice(0, 8).map((item) => (
            <li key={item.id}>
              <Link href={`/collaboration/business/request/${item.id}`} className="block rounded-xl px-3 py-2 text-sm font-semibold text-indigo hover:bg-white">
                {item.title || "Untitled"}
                <span className="mt-1 block text-[11px] font-normal text-[#667085]">{item.status}</span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
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
        initialSlugs={query.creator ? [query.creator] : []}
      />
    </div>
  );
}
