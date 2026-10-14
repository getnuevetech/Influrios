import Link from "next/link";
import { redirect } from "next/navigation";
import { actionSaveBusinessProfile } from "@/app/business/profile/actions";
import { PlaceFields } from "@/components/place-fields";
import { getAccountSession } from "@/lib/accounts";
import { getWorkspace, parseLocationParts } from "@/lib/business";
import { prisma } from "@/lib/db";

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
  const [workspace, profile] = await Promise.all([
    getWorkspace(account.id),
    prisma.businessProfile.findUnique({ where: { userId: account.id } }).catch(() => null),
  ]);
  const location = parseLocationParts(profile?.geography ?? "");

  return (
    <div className="mx-auto max-w-xl">
      <Link href="/business/home" className="text-sm font-semibold text-violet hover:underline">
        ← Dashboard
      </Link>
      <h1 className="mt-2 font-display text-3xl font-bold">Company profile</h1>
      <p className="mt-2 text-sm text-muted">
        The workspace is listed under the <span className="font-semibold text-indigo">business name</span>. The contact
        person below is reference-only and is not used to sign in.
      </p>
      {params.saved ? <p className="mt-4 text-sm font-semibold text-emerald-700">Company profile saved.</p> : null}
      {params.error ? <p className="mt-4 text-sm font-semibold text-amber-800">{params.error}</p> : null}
      <form action={actionSaveBusinessProfile} className="mt-6 space-y-4 rounded-3xl border border-[#E6ECF7] bg-white p-6">
        <label className="block text-sm font-semibold text-indigo">
          Company / business name
          <input
            name="name"
            required
            defaultValue={workspace.name}
            className="mt-1 w-full rounded-xl border border-border px-3 py-2 font-normal"
          />
        </label>
        <div className="rounded-2xl bg-[#F7F8FC] p-4 text-sm">
          <p className="font-semibold text-indigo">Business account email</p>
          <p className="mt-1 text-muted">{account.email}</p>
          <p className="mt-2 text-xs text-muted">Used to sign in. Change it from Settings if needed.</p>
        </div>
        <label className="block text-sm font-semibold text-indigo">
          Industry
          <input
            name="industry"
            defaultValue={workspace.industry}
            placeholder="e.g. Beauty, Travel, SaaS"
            className="mt-1 w-full rounded-xl border border-border px-3 py-2 font-normal"
          />
        </label>
        <div>
          <p className="text-sm font-semibold text-indigo">Headquarters location</p>
          <p className="mt-1 text-xs text-muted">Pick from suggestions — do not free-type a country name.</p>
          <div className="mt-2">
            <PlaceFields
              cityName="city"
              stateName="state"
              countryName="country"
              defaultCity={location.city}
              defaultState={location.state}
              defaultCountry={location.country}
            />
          </div>
        </div>
        <div className="space-y-3 border-t border-[#E6ECF7] pt-4">
          <div>
            <p className="text-sm font-semibold text-indigo">Contact person</p>
            <p className="mt-1 text-xs text-muted">
              Saved on this company profile for reference only. Not used for account access.
            </p>
          </div>
          <label className="block text-sm font-semibold text-indigo">
            Full name
            <input
              name="contactName"
              defaultValue={profile?.contactName ?? ""}
              placeholder="Who should we talk to?"
              className="mt-1 w-full rounded-xl border border-border px-3 py-2 font-normal"
            />
          </label>
          <label className="block text-sm font-semibold text-indigo">
            Mobile
            <input
              name="contactPhone"
              type="tel"
              defaultValue={profile?.contactPhone ?? ""}
              placeholder="+1 555 000 0000"
              className="mt-1 w-full rounded-xl border border-border px-3 py-2 font-normal"
            />
          </label>
          <label className="block text-sm font-semibold text-indigo">
            Email address
            <input
              name="contactEmail"
              type="email"
              defaultValue={profile?.contactEmail ?? ""}
              placeholder="contact@example.com"
              className="mt-1 w-full rounded-xl border border-border px-3 py-2 font-normal"
            />
          </label>
        </div>
        <button type="submit" className="btn-primary">
          Save company profile
        </button>
      </form>
    </div>
  );
}
