import Link from "next/link";
import {
  actionAdvanceDispute,
  actionAttachContract,
  actionCreateContract,
} from "@/app/admin/trust/actions";
import { requireAdminPage } from "@/app/admin/guard";
import { hasPermission } from "@/lib/admin-auth";
import { getProtectedPaymentsStore } from "@/lib/protected-payments";
import {
  enrichDispute,
  getTrustStore,
  trustStats,
  type DisputeStatus,
} from "@/lib/trust";

export const dynamic = "force-dynamic";
export const metadata = { title: "Admin · Trust & Disputes" };

type Props = {
  searchParams: Promise<{
    advanced?: string;
    contract?: string;
    attached?: string;
    error?: string;
  }>;
};

const STATUS_COLOR: Record<DisputeStatus, string> = {
  open: "bg-amber-100 text-amber-900",
  under_review: "bg-violet-100 text-violet-800",
  resolved_release: "bg-emerald-100 text-emerald-800",
  resolved_refund: "bg-rose-100 text-rose-800",
  resolved_partial: "bg-blue-100 text-blue-800",
  withdrawn: "bg-slate-100 text-slate-600",
};

export default async function AdminTrustPage({ searchParams }: Props) {
  const session = await requireAdminPage("trust");
  const canMediate = hasPermission(session, "trust.mediate");
  const params = await searchParams;
  const trust = await getTrustStore();
  const payments = await getProtectedPaymentsStore();
  const stats = trustStats(trust);
  const enriched = await Promise.all(trust.disputes.map((d) => enrichDispute(d)));

  return (
    <div className="mx-auto max-w-[90rem] space-y-8 px-4 py-10 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Link href="/admin" className="text-sm font-semibold text-violet hover:underline">
            ← Admin
          </Link>
          <h1 className="mt-2 font-display text-3xl font-bold text-indigo">
            Trust &amp; Disputes
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-muted">
            Phase 10 ops — mediate escrow disputes (release / refund / partial) and manage collab
            contract briefs. Demo only; not legal advice.
          </p>
        </div>
        <div className="flex flex-wrap gap-3 text-center text-xs">
          <div className="rounded-xl bg-amber-100 px-4 py-2">
            <p className="font-display text-lg font-bold text-amber-800">{stats.open}</p>
            <p className="text-muted">Open</p>
          </div>
          <div className="rounded-xl bg-emerald-100 px-4 py-2">
            <p className="font-display text-lg font-bold text-emerald-700">{stats.resolved}</p>
            <p className="text-muted">Resolved</p>
          </div>
          <div className="rounded-xl bg-lavender px-4 py-2">
            <p className="font-display text-lg font-bold text-violet">{stats.contracts}</p>
            <p className="text-muted">Briefs</p>
          </div>
        </div>
      </div>

      {params.error ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {params.error}
        </div>
      ) : null}
      {params.advanced || params.contract || params.attached ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          Saved
          {params.advanced ? ` · dispute ${params.advanced} updated` : ""}
          {params.contract ? " · contract created" : ""}
          {params.attached ? " · contract attached" : ""}.
        </div>
      ) : null}

      <section className="space-y-4">
        <h2 className="font-display text-xl font-bold text-indigo">Mediation queue</h2>
        {enriched.length === 0 ? (
          <p className="text-sm text-muted">No disputes.</p>
        ) : (
          enriched.map(({ dispute, deal, milestoneTitle }) => (
            <article key={dispute.id} className="card-surface p-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-violet">
                    {deal?.businessName ?? "—"} → {deal?.creatorName ?? "—"}
                  </p>
                  <h3 className="mt-1 font-display text-lg font-bold text-indigo">
                    {milestoneTitle}
                  </h3>
                  <p className="mt-1 text-sm text-muted">
                    {dispute.reason} · {dispute.openedBy} · {dispute.id}
                  </p>
                  {dispute.details ? (
                    <p className="mt-2 text-sm text-indigo">{dispute.details}</p>
                  ) : null}
                </div>
                <span
                  className={`rounded-full px-3 py-1 text-xs font-semibold capitalize ${STATUS_COLOR[dispute.status]}`}
                >
                  {dispute.status.replace(/_/g, " ")}
                </span>
              </div>

              {canMediate &&
              (dispute.status === "open" || dispute.status === "under_review") ? (
                <div className="mt-4 flex flex-wrap gap-2">
                  {(
                    [
                      ["under_review", "Mark under review"],
                      ["resolved_release", "Resolve → release"],
                      ["resolved_refund", "Resolve → refund deal"],
                      ["resolved_partial", "Resolve → partial / resume"],
                      ["withdrawn", "Withdraw"],
                    ] as const
                  ).map(([status, label]) => (
                    <form key={status} action={actionAdvanceDispute}>
                      <input type="hidden" name="id" value={dispute.id} />
                      <input type="hidden" name="status" value={status} />
                      <input
                        type="hidden"
                        name="note"
                        value={
                          status === "resolved_release"
                            ? "Mediator approved release"
                            : status === "resolved_refund"
                              ? "Mediator refunded held funds"
                              : status === "resolved_partial"
                                ? "Partial resolution — resume milestone"
                                : ""
                        }
                      />
                      <button
                        type="submit"
                        className={
                          status.startsWith("resolved_release")
                            ? "btn-primary !py-1.5 text-xs"
                            : status.startsWith("resolved_refund")
                              ? "rounded-xl border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-800"
                              : "rounded-xl border border-border px-3 py-1.5 text-xs font-semibold text-indigo hover:bg-lavender"
                        }
                      >
                        {label}
                      </button>
                    </form>
                  ))}
                </div>
              ) : null}
              {dispute.resolutionNote ? (
                <p className="mt-3 text-xs text-muted">Note: {dispute.resolutionNote}</p>
              ) : null}
            </article>
          ))
        )}
      </section>

      {canMediate ? (
        <section className="card-surface p-6">
          <h2 className="font-display text-xl font-bold text-indigo">Create contract brief</h2>
          <form action={actionCreateContract} className="mt-4 grid gap-3 sm:grid-cols-2">
            <label className="text-sm sm:col-span-2">
              <span className="font-semibold text-indigo">Title</span>
              <input
                name="title"
                required
                defaultValue="Custom collab brief"
                className="mt-1 w-full rounded-xl border border-border px-3 py-2"
              />
            </label>
            <label className="text-sm">
              <span className="font-semibold text-indigo">Audience</span>
              <select
                name="audience"
                className="mt-1 w-full rounded-xl border border-border px-3 py-2"
                defaultValue="both"
              >
                <option value="both">Both</option>
                <option value="creator">Creator</option>
                <option value="business">Business</option>
              </select>
            </label>
            <label className="text-sm">
              <span className="font-semibold text-indigo">Link deal (optional)</span>
              <select name="linkedDealId" className="mt-1 w-full rounded-xl border border-border px-3 py-2">
                <option value="">— none —</option>
                {payments.deals.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.briefTitle} ({d.id})
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm sm:col-span-2">
              <span className="font-semibold text-indigo">Summary</span>
              <input
                name="summary"
                required
                defaultValue="Scope and release rules for this collaboration."
                className="mt-1 w-full rounded-xl border border-border px-3 py-2"
              />
            </label>
            <label className="text-sm sm:col-span-2">
              <span className="font-semibold text-indigo">Clauses (one per line)</span>
              <textarea
                name="clauses"
                required
                rows={4}
                defaultValue={
                  "Deliverables match escrow milestones.\nBrand usage rights: 90 days organic + paid.\nDisputes go through Influrios mediation."
                }
                className="mt-1 w-full rounded-xl border border-border px-3 py-2"
              />
            </label>
            <button type="submit" className="btn-primary sm:col-span-2 !py-2.5 text-sm">
              Create brief →
            </button>
          </form>
        </section>
      ) : null}

      <section className="space-y-4">
        <h2 className="font-display text-xl font-bold text-indigo">Contract briefs</h2>
        {trust.contracts.map((c) => (
          <article key={c.id} className="card-surface p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-violet">
                  {c.audience} · {c.id}
                </p>
                <h3 className="mt-1 font-display text-lg font-bold text-indigo">{c.title}</h3>
                <p className="mt-1 text-sm text-muted">{c.summary}</p>
                <ul className="mt-2 space-y-1 text-sm text-muted">
                  {c.clauses.map((clause) => (
                    <li key={clause}>• {clause}</li>
                  ))}
                </ul>
                {c.linkedDealId ? (
                  <p className="mt-2 text-xs font-semibold text-violet">
                    Linked: {c.linkedDealId}
                  </p>
                ) : null}
              </div>
              {canMediate && !c.linkedDealId && payments.deals[0] ? (
                <form action={actionAttachContract} className="flex flex-wrap items-center gap-2">
                  <input type="hidden" name="contractId" value={c.id} />
                  <select
                    name="dealId"
                    className="rounded-xl border border-border px-2 py-1.5 text-xs"
                    defaultValue={payments.deals[0].id}
                  >
                    {payments.deals.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.briefTitle}
                      </option>
                    ))}
                  </select>
                  <button
                    type="submit"
                    className="rounded-xl border border-border px-3 py-1.5 text-xs font-semibold text-indigo hover:bg-lavender"
                  >
                    Attach to deal
                  </button>
                </form>
              ) : null}
            </div>
          </article>
        ))}
      </section>

      <p className="text-xs text-muted">
        {trust.notes} · Public view:{" "}
        <Link href="/trust" className="font-semibold text-violet hover:underline">
          /trust
        </Link>
      </p>
    </div>
  );
}
