import Link from "next/link";
import { actionSaveInfluencerIdentity } from "@/app/admin/landing/actions";
import { requireAdminPage } from "@/app/admin/guard";
import { hasPermission } from "@/lib/admin-auth";
import { getInfluencerIdentity } from "@/lib/landing-pages";

export const dynamic = "force-dynamic";
export const metadata = { title: "Influencer identity · Admin" };

type Props = { searchParams: Promise<{ saved?: string; error?: string }> };

export default async function AdminInfluencerIdentityPage({ searchParams }: Props) {
  const session = await requireAdminPage("banners");
  const query = await searchParams;
  const canEdit = hasPermission(session, "banners.edit");
  const identity = await getInfluencerIdentity();

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="font-display text-2xl font-bold text-indigo">Influencer identity labels</h1>
      <p className="mt-2 text-sm text-muted">
        Platform role stays <strong>Influencer</strong>. These self-description options appear during claim /
        profile setup so an influencer can describe themselves as Content Creator, Blogger, etc. without changing
        the platform role.
      </p>
      {query.saved ? (
        <p className="mt-4 rounded-xl bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">Saved.</p>
      ) : null}
      {query.error ? (
        <p className="mt-4 rounded-xl bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-800">{query.error}</p>
      ) : null}

      <form action={actionSaveInfluencerIdentity} className="mt-6 rounded-2xl border border-[#E4EBFF] bg-white p-5">
        <label className="block text-xs font-bold text-indigo">
          Self-description options (one per line)
          <textarea
            name="selfDescriptions"
            rows={14}
            defaultValue={identity.selfDescriptions.join("\n")}
            disabled={!canEdit}
            className="mt-1 w-full rounded-xl border border-border px-3 py-2 text-sm font-normal"
          />
        </label>
        {canEdit ? (
          <button type="submit" className="btn-primary mt-4">
            Save identity labels
          </button>
        ) : null}
      </form>

      <p className="mt-4 text-sm text-muted">
        Related:{" "}
        <Link href="/admin/taxonomy" className="font-semibold text-violet">
          Taxonomy synonyms
        </Link>{" "}
        (search treats creator / content creator / influencer as related role queries).
      </p>
    </div>
  );
}
