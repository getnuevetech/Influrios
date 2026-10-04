import Link from "next/link";
import {
  actionToggleCorridor,
  actionUpdateCorridor,
} from "@/app/admin/corridors/actions";
import { requireAdminPage } from "@/app/admin/guard";
import { hasPermission } from "@/lib/admin-auth";
import { listCorridorsForAdmin, payoutMethodOptions } from "@/lib/collab-control-plane";

export const dynamic = "force-dynamic";
export const metadata = { title: "Country corridors · Admin" };

type Props = { searchParams: Promise<{ saved?: string; error?: string }> };

export default async function AdminCorridorsPage({ searchParams }: Props) {
  const session = await requireAdminPage("marketplace");
  const canManage = hasPermission(session, "marketplace.manage");
  const params = await searchParams;
  const corridors = await listCorridorsForAdmin().catch(() => []);
  const methods = payoutMethodOptions();

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <Link href="/admin" className="text-sm font-semibold text-violet hover:underline">
          ← Admin
        </Link>
        <h1 className="mt-2 font-display text-2xl font-bold text-indigo">Country activation corridors</h1>
        <p className="mt-2 max-w-3xl text-sm text-muted">
          Suspend or update a corridor without a deploy. Inactive corridors block ROUTE_READY for influencers in that
          country. Fee rule edits stay on Collaboration fees; gateway credentials stay on Payment gateways.
        </p>
        <p className="mt-2 text-xs text-muted">
          Also see{" "}
          <Link href="/admin/collaboration-ops" className="font-semibold text-violet hover:underline">
            Collaboration operations
          </Link>
          .
        </p>
      </div>

      {params.saved ? (
        <p className="text-sm font-semibold text-emerald-700">Saved ({params.saved}).</p>
      ) : null}
      {params.error ? <p className="text-sm font-semibold text-amber-800">{params.error}</p> : null}

      <div className="space-y-4">
        {corridors.length === 0 ? (
          <p className="text-sm text-muted">No corridors seeded yet.</p>
        ) : (
          corridors.map((row) => {
            const selected = Array.isArray(row.payoutMethodsJson)
              ? (row.payoutMethodsJson as string[])
              : [];
            return (
              <article key={row.countryCode} className="rounded-2xl border border-[#E4EBFF] bg-white p-4 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="font-display text-lg font-bold text-indigo">{row.countryCode}</h2>
                    <p className="text-xs text-muted">
                      {row.currency} · {row.collectionProviderCode ?? "no collection provider"} · KYC{" "}
                      {row.kycModel}
                    </p>
                    <p
                      className={`mt-1 text-xs font-semibold ${row.active ? "text-emerald-700" : "text-amber-800"}`}
                    >
                      {row.active ? "Active" : "Suspended"}
                    </p>
                  </div>
                  {canManage ? (
                    <form action={actionToggleCorridor}>
                      <input type="hidden" name="countryCode" value={row.countryCode} />
                      <input type="hidden" name="active" value={row.active ? "0" : "1"} />
                      <button type="submit" className="btn-secondary !px-3 !py-1.5 text-xs">
                        {row.active ? "Suspend corridor" : "Activate corridor"}
                      </button>
                    </form>
                  ) : null}
                </div>

                {canManage ? (
                  <form action={actionUpdateCorridor} className="mt-4 grid gap-3 sm:grid-cols-2">
                    <input type="hidden" name="countryCode" value={row.countryCode} />
                    <label className="text-xs font-semibold text-muted">
                      Currency
                      <input
                        name="currency"
                        defaultValue={row.currency}
                        className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm text-indigo"
                      />
                    </label>
                    <label className="text-xs font-semibold text-muted">
                      Collection provider code
                      <input
                        name="collectionProviderCode"
                        defaultValue={row.collectionProviderCode ?? ""}
                        className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm text-indigo"
                      />
                    </label>
                    <label className="text-xs font-semibold text-muted">
                      KYC model
                      <input
                        name="kycModel"
                        defaultValue={row.kycModel}
                        className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm text-indigo"
                      />
                    </label>
                    <label className="text-xs font-semibold text-muted">
                      Notes
                      <input
                        name="notes"
                        defaultValue={row.notes}
                        className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm text-indigo"
                      />
                    </label>
                    <label className="flex items-center gap-2 text-xs font-semibold text-indigo">
                      <input type="checkbox" name="holdingEnabled" value="1" defaultChecked={row.holdingEnabled} />
                      Holding enabled
                    </label>
                    <label className="flex items-center gap-2 text-xs font-semibold text-indigo">
                      <input type="checkbox" name="fxEnabled" value="1" defaultChecked={row.fxEnabled} />
                      FX enabled
                    </label>
                    <fieldset className="sm:col-span-2">
                      <legend className="text-xs font-semibold text-muted">Payout methods</legend>
                      <div className="mt-2 flex flex-wrap gap-3">
                        {methods.map((method) => (
                          <label key={method.method} className="flex items-center gap-2 text-xs text-indigo">
                            <input
                              type="checkbox"
                              name="payoutMethod"
                              value={method.method}
                              defaultChecked={selected.includes(method.method)}
                            />
                            {method.label}
                          </label>
                        ))}
                      </div>
                    </fieldset>
                    <div className="sm:col-span-2">
                      <button type="submit" className="btn-primary !px-4 !py-2 text-xs">
                        Save corridor
                      </button>
                    </div>
                  </form>
                ) : (
                  <p className="mt-3 text-xs text-muted">{row.notes || "No notes."}</p>
                )}
              </article>
            );
          })
        )}
      </div>
    </div>
  );
}
