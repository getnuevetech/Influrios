import Link from "next/link";
import { requireAdminPage } from "@/app/admin/guard";
import { actionRemoveExamplePortrait, actionUploadExamplePortrait } from "@/app/admin/actions";
import { hasPermission } from "@/lib/admin-auth";
import { listExampleCardPortraits } from "@/lib/example-portraits";

export const metadata = { title: "Admin · Example card portraits" };

type Props = { searchParams: Promise<{ uploaded?: string; removed?: string; error?: string }> };

export default async function ExamplePortraitsPage({ searchParams }: Props) {
  const session = await requireAdminPage("banners");
  const canEdit = hasPermission(session, "banners.edit");
  const params = await searchParams;
  const portraits = await listExampleCardPortraits();

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-10 sm:px-6">
      <div>
        <Link href="/admin" className="text-sm font-semibold text-violet hover:underline">
          ← Admin
        </Link>
        <h1 className="mt-2 font-display text-3xl font-bold text-indigo">Example card portraits</h1>
        <p className="mt-2 text-sm text-muted">
          Upload cartoon portraits for the signup Influencer Card. Include at least one male and one female image.
          Each fresh visit to the signup page picks one image from this set.
        </p>
      </div>
      {params.uploaded ? <p className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800">Portrait uploaded.</p> : null}
      {params.removed ? <p className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800">Portrait removed.</p> : null}
      {params.error ? <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900">{params.error}</p> : null}
      <ul className="grid gap-3 sm:grid-cols-2">
        {portraits.map((portrait) => (
          <li key={`${portrait.gender}-${portrait.src}`} className="rounded-2xl border border-[#E7ECF5] bg-white p-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={portrait.src} alt="" className="h-40 w-full rounded-xl object-cover" />
            <p className="mt-2 text-sm font-semibold capitalize text-indigo">{portrait.gender}</p>
            {canEdit && !portrait.src.startsWith("/brand/avatars/") ? (
              <form action={actionRemoveExamplePortrait} className="mt-2">
                <input type="hidden" name="src" value={portrait.src} />
                <button type="submit" className="text-xs font-semibold text-rose-700">
                  Remove
                </button>
              </form>
            ) : null}
          </li>
        ))}
      </ul>
      {canEdit ? (
        <form action={actionUploadExamplePortrait} className="space-y-3 rounded-2xl border border-[#E7ECF5] bg-white p-4">
          <label className="block text-sm font-semibold text-indigo">
            Who is pictured
            <select name="gender" className="mt-1 w-full rounded-xl border border-border px-3 py-2 font-normal">
              <option value="female">Female</option>
              <option value="male">Male</option>
            </select>
          </label>
          <label className="block text-sm font-semibold text-indigo">
            Image
            <input name="file" type="file" accept="image/*" required className="mt-1 block w-full text-sm" />
          </label>
          <button type="submit" className="btn-primary !py-2 text-sm">
            Upload portrait
          </button>
        </form>
      ) : (
        <p className="text-sm text-muted">View only. Your access level cannot upload portraits.</p>
      )}
    </div>
  );
}
