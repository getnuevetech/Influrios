import Link from "next/link";
import {
  actionCreateDeal,
  actionFundDeal,
  actionReleaseMilestone,
  actionSubmitMilestone,
} from "@/app/payments/actions";
import {
  escrowStats,
  formatMoney,
  getProtectedPaymentsStore,
  type EscrowStatus,
  type MilestoneStatus,
} from "@/lib/protected-payments";
import { SEED_CREATORS } from "@/lib/seed-data";

export const dynamic = "force-dynamic";
export const metadata = { title: "Protected Payments" };

type Props = {
  searchParams: Promise<{
    created?: string;
    funded?: string;
    submitted?: string;
    released?: string;
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

export default async function PaymentsPage({ searchParams }: Props) {
  const params = await searchParams;
  const store = await getProtectedPaymentsStore();
  const stats = escrowStats(store);

  return (
    <div className="bg-[#F7FAFF]">
      <section className="hero-atmosphere text-white">
        <div className="mx-auto max-w-[90rem] px-4 py-12 sm:px-6">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-lavender/80">
            Phase 9 · Protected Payments
          </p>
          <h1 className="mt-2 font-display text-4xl font-bold">Escrow & milestones</h1>
          <p className="mt-3 max-w-2xl text-white/75">
            Fund a collaboration, track deliverables, and release payment as each milestone clears —
            demo rails first, live payouts later.
          </p>
        </div>
      </section>

      <div className="mx-auto max-w-[90rem] space-y-8 px-4 py-10 sm:px-6">
        <div className="flex flex-wrap gap-3 text-center text-xs">
          <div className="rounded-xl bg-lavender px-4 py-2">
            <p className="font-display text-lg font-bold text-violet">{stats.total}</p>
            <p className="text-muted">Deals</p>
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
            <p className="text-muted">Held in escrow</p>
          </div>
        </div>

        {params.error ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            {params.error}
          </div>
        ) : null}
        {params.created || params.funded || params.submitted || params.released ? (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            Saved
            {params.created ? ` · deal ${params.created} created` : ""}
            {params.funded ? " · funded" : ""}
            {params.submitted ? " · milestone submitted" : ""}
            {params.released ? " · milestone released" : ""}.
          </div>
        ) : null}

        <section className="card-surface p-6">
          <h2 className="font-display text-xl font-bold text-indigo">Start a protected deal</h2>
          <p className="mt-1 text-sm text-muted">
            Business funds the full amount into escrow. Creator submits each milestone; brand
            releases payment when work is accepted.
          </p>
          <form action={actionCreateDeal} className="mt-4 grid gap-3 sm:grid-cols-2">
            <label className="text-sm">
              <span className="font-semibold text-indigo">Business</span>
              <input
                name="businessName"
                defaultValue="Luminous Beauty"
                required
                className="mt-1 w-full rounded-xl border border-border bg-white px-3 py-2"
              />
            </label>
            <label className="text-sm">
              <span className="font-semibold text-indigo">Creator</span>
              <select
                name="creatorSlug"
                required
                className="mt-1 w-full rounded-xl border border-border bg-white px-3 py-2"
                defaultValue="sofia-martinez"
              >
                {SEED_CREATORS.slice(0, 12).map((c) => (
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
                defaultValue="Product launch collab"
                required
                className="mt-1 w-full rounded-xl border border-border bg-white px-3 py-2"
              />
            </label>
            <label className="text-sm sm:col-span-2">
              <span className="font-semibold text-indigo">Notes</span>
              <input
                name="notes"
                placeholder="Optional context"
                className="mt-1 w-full rounded-xl border border-border bg-white px-3 py-2"
              />
            </label>

            <div className="sm:col-span-2 space-y-3 rounded-xl border border-border bg-[#F7FAFF] p-4">
              <p className="text-xs font-bold uppercase tracking-wide text-violet">
                Three milestones (USD)
              </p>
              {[1, 2, 3].map((n) => (
                <div key={n} className="grid gap-2 sm:grid-cols-3">
                  <input
                    name="msTitle"
                    placeholder={`Milestone ${n} title`}
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
                    defaultValue={n === 3 ? 1000 : 1500}
                    placeholder="Amount $"
                    className="rounded-xl border border-border bg-white px-3 py-2 text-sm"
                  />
                  <input
                    name="msDue"
                    defaultValue={`Week ${n}`}
                    placeholder="Due"
                    className="rounded-xl border border-border bg-white px-3 py-2 text-sm"
                  />
                </div>
              ))}
            </div>

            <button type="submit" className="btn-primary sm:col-span-2 !py-2.5 text-sm">
              Create escrow deal →
            </button>
          </form>
        </section>

        <section className="space-y-4">
          <h2 className="font-display text-2xl font-bold text-indigo">Active escrow deals</h2>
          {store.deals.length === 0 ? (
            <p className="text-sm text-muted">No deals yet — create one above.</p>
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
                      <h3 className="mt-1 font-display text-xl font-bold text-indigo">
                        {deal.briefTitle}
                      </h3>
                      <p className="mt-1 font-mono text-[11px] text-muted">{deal.id}</p>
                    </div>
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-semibold capitalize ${DEAL_COLOR[deal.status]}`}
                    >
                      {deal.status.replace("_", " ")}
                    </span>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-4 text-sm text-muted">
                    <span>
                      Total{" "}
                      <strong className="text-indigo">{formatMoney(deal.totalCents)}</strong>
                    </span>
                    <span>
                      Funded{" "}
                      <strong className="text-indigo">{formatMoney(deal.fundedCents)}</strong>
                    </span>
                    <span>
                      Released{" "}
                      <strong className="text-emerald-700">{formatMoney(deal.releasedCents)}</strong>
                    </span>
                    <span>
                      Held <strong className="text-amber-800">{formatMoney(held)}</strong>
                    </span>
                  </div>

                  {deal.status === "draft" ? (
                    <form action={actionFundDeal} className="mt-4">
                      <input type="hidden" name="dealId" value={deal.id} />
                      <button type="submit" className="btn-primary !py-2 text-sm">
                        Fund escrow (demo) →
                      </button>
                    </form>
                  ) : null}

                  <ul className="mt-5 space-y-3">
                    {deal.milestones.map((ms) => (
                      <li
                        key={ms.id}
                        className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-white px-4 py-3"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-semibold text-indigo">{ms.title}</p>
                            <span
                              className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${MS_COLOR[ms.status]}`}
                            >
                              {ms.status}
                            </span>
                          </div>
                          <p className="mt-0.5 text-xs text-muted">
                            {formatMoney(ms.amountCents)} · {ms.dueLabel}
                            {ms.note ? ` · ${ms.note}` : ""}
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {deal.fundedCents >= deal.totalCents &&
                          (ms.status === "pending" || ms.status === "disputed") ? (
                            <form action={actionSubmitMilestone}>
                              <input type="hidden" name="dealId" value={deal.id} />
                              <input type="hidden" name="milestoneId" value={ms.id} />
                              <input type="hidden" name="note" value="Work submitted for review" />
                              <button
                                type="submit"
                                className="rounded-xl border border-border bg-white px-3 py-1.5 text-xs font-semibold text-indigo hover:bg-lavender"
                              >
                                Submit work
                              </button>
                            </form>
                          ) : null}
                          {ms.status === "submitted" || ms.status === "approved" ? (
                            <form action={actionReleaseMilestone}>
                              <input type="hidden" name="dealId" value={deal.id} />
                              <input type="hidden" name="milestoneId" value={ms.id} />
                              <button type="submit" className="btn-primary !px-3 !py-1.5 text-xs">
                                Release payment
                              </button>
                            </form>
                          ) : null}
                        </div>
                      </li>
                    ))}
                  </ul>
                </article>
              );
            })
          )}
        </section>

        <p className="text-center text-sm text-muted">
          Admin ops:{" "}
          <Link href="/admin/payments" className="font-semibold text-violet hover:underline">
            Payments console
          </Link>
          {" · "}
          <Link href="/trust" className="font-semibold text-violet hover:underline">
            Trust &amp; disputes
          </Link>
          {" · "}
          <Link href="/billing" className="font-semibold text-violet hover:underline">
            Plan billing
          </Link>
        </p>
      </div>
    </div>
  );
}
