import Link from "next/link";
import {
  actionAdminCreateDeal,
  actionAdminFundDeal,
  actionAdminRefundDeal,
  actionAdminReleaseMilestone,
  actionAdminSubmitMilestone,
} from "@/app/admin/payments/actions";
import { requireAdminPage } from "@/app/admin/guard";
import { hasPermission } from "@/lib/admin-auth";
import { getManagedMatching } from "@/lib/managed-matching";
import { indexCreatorsBySlug, listDirectoryCreators } from "@/lib/directory";
import { legacyDemoPaymentsEnabled } from "@/lib/legacy-demo-payments";
import { formatMoney } from "@/lib/money";
import {
  escrowStats,
  getProtectedPaymentsStore,
  type EscrowStatus,
  type MilestoneStatus,
} from "@/lib/protected-payments";

export const dynamic = "force-dynamic";
export const metadata = { title: "Admin · Protected Payments" };

type Props = {
  searchParams: Promise<{
    created?: string;
    funded?: string;
    submitted?: string;
    released?: string;
    refunded?: string;
    error?: string;
  }>;
};

const DEAL_COLOR: Record<EscrowStatus, string> = {
  draft: "bg-slate-100 text-slate-700",
  funded: "bg-blue-100 text-blue-800",
  in_progress: "bg-violet-100 text-violet-800",
  completed: "bg-emerald-100 text-emerald-800",
  refunded: "bg-amber-100 text-amber-900",
  cancelled: "bg-rose-100 text-rose-800",
};

const MS_COLOR: Record<MilestoneStatus, string> = {
  pending: "bg-slate-100 text-slate-600",
  submitted: "bg-amber-100 text-amber-800",
  approved: "bg-blue-100 text-blue-800",
  released: "bg-emerald-100 text-emerald-800",
  disputed: "bg-rose-100 text-rose-800",
};

export default async function AdminPaymentsPage({ searchParams }: Props) {
  const session = await requireAdminPage("payments");
  const canManage = hasPermission(session, "payments.manage");
  const params = await searchParams;
  const legacyOn = await legacyDemoPaymentsEnabled();
  if (!legacyOn) {
    return (
      <div className="mx-auto max-w-[90rem] space-y-6 px-4 py-10 sm:px-6">
        <Link href="/admin" className="text-sm font-semibold text-violet hover:underline">
          ← Admin
        </Link>
        <h1 className="mt-2 font-display text-3xl font-bold text-indigo">Protected Payments</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted">
          The Phase 9 JSON demo console is off. Prefunding and milestone release live on the{" "}
          <Link href="/admin/marketplace" className="font-semibold text-violet hover:underline">
            marketplace ledger
          </Link>
          . Turn on <span className="font-semibold text-indigo">legacy demo payments</span> in marketplace settings
          only when you need the old demo store.
        </p>
      </div>
    );
  }
  const store = await getProtectedPaymentsStore();
  const matching = await getManagedMatching();
  const stats = escrowStats(store);
  const directoryCreators = await listDirectoryCreators();
  const bySlug = indexCreatorsBySlug(directoryCreators);

  return (
    <div className="mx-auto max-w-[90rem] space-y-8 px-4 py-10 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Link href="/admin" className="text-sm font-semibold text-violet hover:underline">
            ← Admin
          </Link>
          <h1 className="mt-2 font-display text-3xl font-bold text-indigo">
            Protected Payments
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-muted">
            Phase 9 demo store. Live prefunding, milestone release, and the provider-held ledger are on the{" "}
            <Link href="/admin/marketplace" className="font-semibold text-violet hover:underline">
              marketplace ledger
            </Link>
            .
          </p>
        </div>
        <div className="flex flex-wrap gap-3 text-center text-xs">
          <div className="rounded-xl bg-lavender px-4 py-2">
            <p className="font-display text-lg font-bold text-violet">{stats.active}</p>
            <p className="text-muted">Active</p>
          </div>
          <div className="rounded-xl bg-[#D9E8FF] px-4 py-2">
            <p className="font-display text-lg font-bold text-blue">{formatMoney(stats.funded)}</p>
            <p className="text-muted">Funded</p>
          </div>
          <div className="rounded-xl bg-emerald-100 px-4 py-2">
            <p className="font-display text-lg font-bold text-emerald-700">
              {formatMoney(stats.released)}
            </p>
            <p className="text-muted">Released</p>
          </div>
          <div className="rounded-xl bg-amber-100 px-4 py-2">
            <p className="font-display text-lg font-bold text-amber-800">{formatMoney(stats.held)}</p>
            <p className="text-muted">Held</p>
          </div>
        </div>
      </div>

      {params.error ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {params.error}
        </div>
      ) : null}
      {params.created ||
      params.funded ||
      params.submitted ||
      params.released ||
      params.refunded ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          Saved
          {params.created ? " · deal created" : ""}
          {params.funded ? " · funded" : ""}
          {params.submitted ? " · milestone submitted" : ""}
          {params.released ? " · milestone released" : ""}
          {params.refunded ? " · refunded" : ""}.
        </div>
      ) : null}

      {canManage ? (
        <section className="card-surface p-6">
          <h2 className="font-display text-xl font-bold text-indigo">Create escrow deal</h2>
          <p className="mt-1 text-sm text-muted">
            Optionally link to a managed intro. Public flow also lives at{" "}
            <Link href="/payments" className="font-semibold text-violet hover:underline">
              /payments
            </Link>
            .
          </p>
          <form action={actionAdminCreateDeal} className="mt-4 grid gap-3 sm:grid-cols-2">
            <label className="text-sm">
              <span className="font-semibold text-indigo">Business</span>
              <input
                name="businessName"
                defaultValue="Luminous Beauty"
                required
                className="mt-1 w-full rounded-xl border border-border px-3 py-2"
              />
            </label>
            <label className="text-sm">
              <span className="font-semibold text-indigo">Creator</span>
              <select
                name="creatorSlug"
                required
                defaultValue="sofia-martinez"
                className="mt-1 w-full rounded-xl border border-border px-3 py-2"
              >
                {directoryCreators.slice(0, 12).map((c) => (
                  <option key={c.slug} value={c.slug}>
                    {c.displayName}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm sm:col-span-2">
              <span className="font-semibold text-indigo">Brief / campaign</span>
              <input
                name="briefTitle"
                defaultValue="Clean Skincare Launch — escrow"
                required
                className="mt-1 w-full rounded-xl border border-border px-3 py-2"
              />
            </label>
            <label className="text-sm sm:col-span-2">
              <span className="font-semibold text-indigo">Link intro (optional)</span>
              <select name="introId" className="mt-1 w-full rounded-xl border border-border px-3 py-2">
                <option value="">— none —</option>
                {matching.intros.map((intro) => (
                  <option key={intro.id} value={intro.id}>
                    {intro.id} · {intro.businessName} →{" "}
                    {bySlug.get(intro.creatorSlug)?.displayName ?? intro.creatorSlug} ·{" "}
                    {intro.briefTitle}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm sm:col-span-2">
              <span className="font-semibold text-indigo">Notes</span>
              <input
                name="notes"
                placeholder="Ops notes"
                className="mt-1 w-full rounded-xl border border-border px-3 py-2"
              />
            </label>
            <div className="sm:col-span-2 space-y-3 rounded-xl border border-border bg-[#F7FAFF] p-4">
              <p className="text-xs font-bold uppercase tracking-wide text-violet">
                Milestones (USD)
              </p>
              {[1, 2, 3].map((n) => (
                <div key={n} className="grid gap-2 sm:grid-cols-3">
                  <input
                    name="msTitle"
                    defaultValue={
                      n === 1
                        ? "Kickoff + brief sign-off"
                        : n === 2
                          ? "Draft content delivered"
                          : "Posts live + report"
                    }
                    className="rounded-xl border border-border bg-white px-3 py-2 text-sm"
                  />
                  <input
                    name="msAmount"
                    type="number"
                    min={1}
                    step={50}
                    defaultValue={1500}
                    className="rounded-xl border border-border bg-white px-3 py-2 text-sm"
                  />
                  <input
                    name="msDue"
                    defaultValue={`Week ${n}`}
                    className="rounded-xl border border-border bg-white px-3 py-2 text-sm"
                  />
                </div>
              ))}
            </div>
            <button type="submit" className="btn-primary sm:col-span-2 !py-2.5 text-sm">
              Create deal →
            </button>
          </form>
        </section>
      ) : (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          View-only — ask a Super Admin for <code>payments.manage</code> to mutate deals.
        </div>
      )}

      <section className="space-y-4">
        <h2 className="font-display text-xl font-bold text-indigo">Escrow pipeline</h2>
        {store.deals.length === 0 ? (
          <p className="text-sm text-muted">No deals yet.</p>
        ) : (
          store.deals.map((deal) => {
            const held = deal.fundedCents - deal.releasedCents;
            return (
              <article key={deal.id} className="card-surface p-6">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wide text-violet">
                      {deal.businessName} → {deal.creatorName}
                    </p>
                    <h3 className="mt-1 font-display text-lg font-bold text-indigo">
                      {deal.briefTitle}
                    </h3>
                    <p className="mt-1 font-mono text-[11px] text-muted">
                      {deal.id}
                      {deal.introId ? ` · intro ${deal.introId}` : ""}
                    </p>
                    {deal.notes ? (
                      <p className="mt-1 text-xs text-muted">{deal.notes}</p>
                    ) : null}
                  </div>
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-semibold capitalize ${DEAL_COLOR[deal.status]}`}
                  >
                    {deal.status.replace("_", " ")}
                  </span>
                </div>

                <div className="mt-3 flex flex-wrap gap-4 text-sm text-muted">
                  <span>
                    Total <strong className="text-indigo">{formatMoney(deal.totalCents)}</strong>
                  </span>
                  <span>
                    Funded <strong className="text-indigo">{formatMoney(deal.fundedCents)}</strong>
                  </span>
                  <span>
                    Released{" "}
                    <strong className="text-emerald-700">{formatMoney(deal.releasedCents)}</strong>
                  </span>
                  <span>
                    Held <strong className="text-amber-800">{formatMoney(held)}</strong>
                  </span>
                </div>

                {canManage ? (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {deal.status === "draft" ? (
                      <form action={actionAdminFundDeal}>
                        <input type="hidden" name="dealId" value={deal.id} />
                        <button type="submit" className="btn-primary !py-1.5 text-xs">
                          Fund escrow
                        </button>
                      </form>
                    ) : null}
                    {held > 0 && deal.status !== "refunded" && deal.status !== "cancelled" ? (
                      <form action={actionAdminRefundDeal} className="flex flex-wrap items-center gap-2">
                        <input type="hidden" name="dealId" value={deal.id} />
                        <input
                          name="note"
                          placeholder="Refund reason"
                          className="rounded-xl border border-border px-3 py-1.5 text-xs"
                        />
                        <button
                          type="submit"
                          className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-800 hover:bg-rose-100"
                        >
                          Refund remainder
                        </button>
                      </form>
                    ) : null}
                  </div>
                ) : null}

                <ul className="mt-4 divide-y divide-border">
                  {deal.milestones.map((ms) => (
                    <li
                      key={ms.id}
                      className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
                    >
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-semibold text-indigo">{ms.title}</p>
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${MS_COLOR[ms.status]}`}
                          >
                            {ms.status}
                          </span>
                        </div>
                        <p className="text-xs text-muted">
                          {formatMoney(ms.amountCents)} · {ms.dueLabel}
                          {ms.note ? ` · ${ms.note}` : ""}
                        </p>
                      </div>
                      {canManage ? (
                        <div className="flex flex-wrap gap-2">
                          {deal.fundedCents >= deal.totalCents && ms.status === "pending" ? (
                            <form action={actionAdminSubmitMilestone}>
                              <input type="hidden" name="dealId" value={deal.id} />
                              <input type="hidden" name="milestoneId" value={ms.id} />
                              <button
                                type="submit"
                                className="rounded-xl border border-border px-3 py-1.5 text-xs font-semibold text-indigo hover:bg-lavender"
                              >
                                Mark submitted
                              </button>
                            </form>
                          ) : null}
                          {ms.status === "submitted" || ms.status === "approved" ? (
                            <form action={actionAdminReleaseMilestone}>
                              <input type="hidden" name="dealId" value={deal.id} />
                              <input type="hidden" name="milestoneId" value={ms.id} />
                              <button type="submit" className="btn-primary !px-3 !py-1.5 text-xs">
                                Release
                              </button>
                            </form>
                          ) : null}
                        </div>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </article>
            );
          })
        )}
      </section>

      <p className="text-xs text-muted">{store.notes}</p>
    </div>
  );
}
