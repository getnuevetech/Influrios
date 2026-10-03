import Link from "next/link";
import { actionSaveSocialNetwork, actionSaveSocialPolicy } from "@/app/admin/social/actions";
import { requireAdminPage } from "@/app/admin/guard";
import { hasPermission } from "@/lib/admin-auth";
import { callbackPath, getSocialPolicy, listSocialNetworks } from "@/lib/social-connect";

export const dynamic = "force-dynamic";
export const metadata = { title: "Social networks · Admin" };

const inputClass = "mt-1 w-full rounded-xl border border-border px-3 py-2 font-normal";

type Props = { searchParams: Promise<{ saved?: string; error?: string }> };

export default async function AdminSocialPage({ searchParams }: Props) {
  const session = await requireAdminPage("social");
  const canEdit = hasPermission(session, "social.edit");
  const params = await searchParams;
  let policy: Awaited<ReturnType<typeof getSocialPolicy>> | null = null;
  let networks: Awaited<ReturnType<typeof listSocialNetworks>> = [];
  let dbError = false;
  try {
    [policy, networks] = await Promise.all([getSocialPolicy(), listSocialNetworks()]);
  } catch (error) {
    console.error("admin social", error);
    dbError = true;
  }

  return (
    <div className="mx-auto max-w-5xl">
      <Link href="/admin" className="text-sm font-semibold text-violet hover:underline">
        ← Admin
      </Link>
      <h1 className="mt-2 font-display text-2xl font-bold text-indigo">Social networks</h1>
      <p className="mt-2 max-w-3xl text-sm text-muted">
        Each network stays off until a client id and secret are saved and the provider is enabled. A creator must accept
        the current terms and policy before Influrios starts that network’s login. Follower and like counts are written
        only when the network returns both. Public pages keep their current layout; a confirmed sync updates the figure
        already shown for that account.
      </p>
      <p className="mt-2 text-sm text-muted">
        Redirect URI for every network app: <span className="font-semibold text-indigo">{callbackPath()}</span>
      </p>
      {params.saved ? <p className="mt-4 text-sm font-semibold text-emerald-700">Saved.</p> : null}
      {params.error ? <p className="mt-4 text-sm font-semibold text-amber-800">{params.error}</p> : null}
      {dbError ? <p className="mt-4 text-sm text-amber-800">The database is unavailable.</p> : null}

      {policy ? (
        <form action={actionSaveSocialPolicy} className="mt-6 grid gap-3 rounded-2xl border border-[#E4EBFF] bg-white p-4">
          <h2 className="font-display text-lg font-bold text-indigo">Influencer agreement</h2>
          <p className="text-sm text-muted">
            Change the version whenever the terms or policy text changes. Existing connections must be accepted again
            before the next sync.
          </p>
          <label className="block text-sm font-semibold text-indigo">
            Version
            <input name="version" defaultValue={policy.version} disabled={!canEdit} className={inputClass} />
          </label>
          <label className="block text-sm font-semibold text-indigo">
            Terms
            <textarea name="termsText" rows={4} defaultValue={policy.termsText} disabled={!canEdit} className={inputClass} />
          </label>
          <label className="block text-sm font-semibold text-indigo">
            Policy
            <textarea name="policyText" rows={4} defaultValue={policy.policyText} disabled={!canEdit} className={inputClass} />
          </label>
          {canEdit ? <button type="submit" className="btn-primary w-fit">Save terms</button> : null}
        </form>
      ) : null}

      <section className="mt-8 space-y-4">
        <h2 className="font-display text-lg font-bold text-indigo">Networks</h2>
        {networks.map((network) => (
          <form key={network.code} action={actionSaveSocialNetwork} className="grid gap-3 rounded-2xl border border-[#E4EBFF] bg-white p-4 sm:grid-cols-2">
            <input type="hidden" name="code" value={network.code} />
            <div className="sm:col-span-2">
              <p className="font-semibold text-indigo">{network.name}</p>
              <p className="text-xs text-muted">{network.ready ? "Ready for creator consent and login" : "Not ready — no live sync"} · secret {network.secret}</p>
            </div>
            <label className="block text-sm font-semibold text-indigo sm:col-span-2">
              Client id
              <input name="clientId" defaultValue={network.clientId} disabled={!canEdit} className={inputClass} />
            </label>
            <label className="block text-sm font-semibold text-indigo sm:col-span-2">
              Client secret ({network.secret})
              <input name="secret" type="password" placeholder="Leave blank to keep the saved secret" disabled={!canEdit} className={inputClass} />
            </label>
            <label className="block text-sm font-semibold text-indigo sm:col-span-2">
              Authorize URL
              <input name="authorizeUrl" defaultValue={network.authorizeUrl} disabled={!canEdit} className={inputClass} />
            </label>
            <label className="block text-sm font-semibold text-indigo">
              Token URL
              <input name="tokenUrl" defaultValue={network.tokenUrl} disabled={!canEdit} className={inputClass} />
            </label>
            <label className="block text-sm font-semibold text-indigo">
              Profile URL
              <input name="profileUrl" defaultValue={network.profileUrl} disabled={!canEdit} className={inputClass} />
            </label>
            <label className="block text-sm font-semibold text-indigo sm:col-span-2">
              Scopes
              <input name="scopes" defaultValue={network.scopes} disabled={!canEdit} className={inputClass} />
            </label>
            <label className="flex items-center gap-2 text-sm font-semibold text-indigo">
              <input type="checkbox" name="enabled" value="1" defaultChecked={network.enabled} disabled={!canEdit} />
              Enabled
            </label>
            {canEdit ? <button type="submit" className="btn-primary w-fit">Save {network.name}</button> : null}
          </form>
        ))}
      </section>
    </div>
  );
}
