import Link from "next/link";
import { redirect } from "next/navigation";
import { actionSaveBusinessProfile } from "@/app/business/profile/actions";
import { getAccountSession } from "@/lib/accounts";
import { getWorkspace } from "@/lib/business";

export const dynamic = "force-dynamic";
export const metadata = { title: "Company profile" };

export default async function BusinessProfilePage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; error?: string }>;
}) {
  const params = await searchParams;
  const account = await getAccountSession();
  if (!account) redirect("/login?next=/business/profile");
  const workspace = await getWorkspace(account.id);

  return (
    <div className="mx-auto max-w-xl">
      <Link href="/business/home" className="text-sm font-semibold text-violet hover:underline">
        ← Dashboard
      </Link>
      <h1 className="mt-2 font-display text-3xl font-bold">Company profile</h1>
      <p className="mt-2 text-sm text-muted">
        This is the business workspace brands and creators see on collaboration requests.
      </p>
      {params.saved ? <p className="mt-4 text-sm font-semibold text-emerald-700">Company profile saved.</p> : null}
      {params.error ? <p className="mt-4 text-sm font-semibold text-amber-800">{params.error}</p> : null}
      <form action={actionSaveBusinessProfile} className="mt-6 space-y-4 rounded-3xl border border-[#E6ECF7] bg-white p-6">
        <label className="block text-sm font-semibold text-indigo">
          Company name
          <input
            name="name"
            required
            defaultValue={workspace.name}
            className="mt-1 w-full rounded-xl border border-border px-3 py-2 font-normal"
          />
        </label>
        <label className="block text-sm font-semibold text-indigo">
          Industry
          <input
            name="industry"
            defaultValue={workspace.industry}
            placeholder="e.g. Beauty, Travel, SaaS"
            className="mt-1 w-full rounded-xl border border-border px-3 py-2 font-normal"
          />
        </label>
        <button type="submit" className="btn-primary">
          Save company profile
        </button>
      </form>
    </div>
  );
}
