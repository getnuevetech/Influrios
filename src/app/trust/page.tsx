import Link from "next/link";
import { actionOpenDispute } from "@/app/trust/actions";
import { listMilestoneDisputes } from "@/lib/milestone-disputes";
import { legacyDemoPaymentsEnabled } from "@/lib/legacy-demo-payments";
import { formatMoney } from "@/lib/money";
import { getProtectedPaymentsStore } from "@/lib/protected-payments";
import {
  enrichDispute,
  getTrustStore,
  trustStats,
  type DisputeStatus,
} from "@/lib/trust";

export const dynamic = "force-dynamic";
export const metadata = { title: "Trust & Disputes" };

type Props = {
  searchParams: Promise<{ opened?: string; error?: string }>;
};

const STATUS_COLOR: Record<DisputeStatus, string> = {
  open: "bg-amber-100 text-amber-900",
  under_review: "bg-violet-100 text-violet-800",
  resolved_release: "bg-emerald-100 text-emerald-800",
  resolved_refund: "bg-rose-100 text-rose-800",
  resolved_partial: "bg-blue-100 text-blue-800",
  withdrawn: "bg-slate-100 text-slate-600",
};

export default async function TrustPage({ searchParams }: Props) {
  const params = await searchParams;
  const legacyOn = await legacyDemoPaymentsEnabled();
  const trust = legacyOn ? await getTrustStore() : null;
  const payments = legacyOn ? await getProtectedPaymentsStore() : null;
  const stats = trust
    ? trustStats(trust)
    : { open: 0, resolved: 0, total: 0, contracts: 0 };
  const enriched = trust ? await Promise.all(trust.disputes.map((d) => enrichDispute(d))) : [];
  const ledgerDisputes = await listMilestoneDisputes().catch(() => []);

  const disputable = payments
    ? payments.deals.flatMap((deal) =>
        deal.milestones
          .filter((m) => m.status !== "released" && deal.fundedCents > 0)
          .map((m) => ({ deal, milestone: m })),
      )
    : [];

  return (
    <div className="bg-[#F7FAFF]">
      <section className="hero-atmosphere text-white">
        <div className="mx-auto max-w-[90rem] px-4 py-12 sm:px-6">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-lavender/80">
            Trust &amp; Disputes
          </p>
          <h1 className="mt-2 font-display text-4xl font-bold">Mediation &amp; briefs</h1>
          <p className="mt-3 max-w-2xl text-white/75">
            {legacyOn
              ? "Demo queue is on for ops testing. Product disputes use the marketplace ledger; a decision records what should happen next and does not move the money."
              : "Ledger disputes for provider-held milestones. Phase 9/10 JSON demos stay frozen off — open disputes from Protected Payments on the marketplace path."}
          </p>
        </div>
      </section>

      <div className="mx-auto max-w-[90rem] space-y-8 px-4 py-10 sm:px-6">
        <div className="flex flex-wrap gap-3 text-center text-xs">
          <div className="rounded-xl bg-amber-100 px-4 py-2">
            <p className="font-display text-lg font-bold text-amber-800">{stats.open}</p>
            <p className="text-muted">Open / review</p>
          </div>
          <div className="rounded-xl bg-emerald-100 px-4 py-2">
            <p className="font-display text-lg font-bold text-emerald-700">{stats.resolved}</p>
            <p className="text-muted">Resolved</p>
          </div>
          <div className="rounded-xl bg-lavender px-4 py-2">
            <p className="font-display text-lg font-bold text-violet">{stats.contracts}</p>
            <p className="text-muted">Contract briefs</p>
          </div>
        </div>

        {params.error ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            {params.error}
          </div>
        ) : null}
        {params.opened ? (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            Dispute {params.opened} opened — ops will mediate.
          </div>
        ) : null}

        <section className="card-surface p-6">
          <h2 className="font-display text-xl font-bold text-indigo">Provider-held disputes</h2>
          <p className="mt-1 text-sm text-muted">
            These cases block a release until they close. A refund still waits for the marketplace provider.
            Open one from{" "}
            <Link href="/payments" className="font-semibold text-violet hover:underline">
              Protected Payments
            </Link>
            .
          </p>
          {ledgerDisputes.length === 0 ? (
            <p className="mt-4 text-sm text-muted">No provider-held disputes yet.</p>
          ) : (
            <ul className="mt-4 space-y-2 text-sm">
              {ledgerDisputes.map((dispute) => (
                <li key={dispute.id} className="rounded-xl border border-border px-4 py-3">
                  <p className="font-semibold text-indigo">
                    {dispute.funding.title} · {dispute.milestone?.title ?? "Milestone"}
                  </p>
                  <p className="text-muted">
                    {dispute.reasonLabel} · {dispute.status.replaceAll("_", " ")}
                    {dispute.requestedRefundCents
                      ? ` · refund requested ${formatMoney(dispute.requestedRefundCents)}`
                      : ""}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>

        {legacyOn && trust ? (
          <>
        <section className="card-surface p-6">
          <h2 className="font-display text-xl font-bold text-indigo">Earlier demo queue</h2>
          <p className="mt-1 text-sm text-muted">
            This form still writes the demo store. It does not open a provider-held dispute.
          </p>
          {disputable.length === 0 ? (
            <p className="mt-4 text-sm text-muted">No funded, unreleased milestones available.</p>
          ) : (
            <form action={actionOpenDispute} className="mt-4 grid gap-3 sm:grid-cols-2">
              <label className="text-sm sm:col-span-2">
                <span className="font-semibold text-indigo">Milestone</span>
                <select
                  name="selection"
                  required
                  className="mt-1 w-full rounded-xl border border-border bg-white px-3 py-2"
                  defaultValue={`${disputable[0].deal.id}::${disputable[0].milestone.id}`}
                >
                  {disputable.map(({ deal, milestone }) => (
                    <option
                      key={`${deal.id}:${milestone.id}`}
                      value={`${deal.id}::${milestone.id}`}
                    >
                      {deal.briefTitle} · {milestone.title} (
                      {formatMoney(milestone.amountCents)}) — {milestone.status}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm">
                <span className="font-semibold text-indigo">Opened by</span>
                <select
                  name="openedBy"
                  className="mt-1 w-full rounded-xl border border-border bg-white px-3 py-2"
                  defaultValue="business"
                >
                  <option value="business">Business</option>
                  <option value="creator">Influencer</option>
                  <option value="ops">Ops</option>
                </select>
              </label>
              <label className="text-sm">
                <span className="font-semibold text-indigo">Reason</span>
                <input
                  name="reason"
                  required
                  defaultValue="Deliverable mismatch"
                  className="mt-1 w-full rounded-xl border border-border bg-white px-3 py-2"
                />
              </label>
              <label className="text-sm sm:col-span-2">
                <span className="font-semibold text-indigo">Details</span>
                <textarea
                  name="details"
                  rows={3}
                  placeholder="What went wrong and what outcome you want"
                  className="mt-1 w-full rounded-xl border border-border bg-white px-3 py-2"
                />
              </label>
              <button type="submit" className="btn-primary sm:col-span-2 !py-2.5 text-sm">
                Open dispute →
              </button>
            </form>
          )}
        </section>

        <section className="space-y-4">
          <h2 className="font-display text-2xl font-bold text-indigo">Dispute queue</h2>
          {enriched.length === 0 ? (
            <p className="text-sm text-muted">No disputes yet.</p>
          ) : (
            enriched.map(({ dispute, deal, milestoneTitle }) => (
              <article key={dispute.id} className="card-surface p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wide text-violet">
                      {deal?.businessName ?? "—"} → {deal?.creatorName ?? "—"}
                    </p>
                    <h3 className="mt-1 font-display text-lg font-bold text-indigo">
                      {milestoneTitle}
                    </h3>
                    <p className="mt-1 text-sm text-muted">
                      {dispute.reason} · opened by {dispute.openedBy}
                    </p>
                    {dispute.details ? (
                      <p className="mt-2 text-sm text-indigo">{dispute.details}</p>
                    ) : null}
                    <p className="mt-2 font-mono text-[11px] text-muted">
                      {dispute.id} · deal {dispute.dealId}
                    </p>
                  </div>
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-semibold capitalize ${STATUS_COLOR[dispute.status]}`}
                  >
                    {dispute.status.replace(/_/g, " ")}
                  </span>
                </div>
                {dispute.resolutionNote ? (
                  <p className="mt-3 text-xs text-muted">Resolution: {dispute.resolutionNote}</p>
                ) : null}
              </article>
            ))
          )}
        </section>

        <section className="space-y-4">
          <h2 className="font-display text-2xl font-bold text-indigo">Contract briefs</h2>
          <p className="text-sm text-muted">
            Templates for collab scope — not signed legal documents.
          </p>
          <div className="grid gap-4 md:grid-cols-2">
            {trust.contracts.map((c) => (
              <article key={c.id} className="card-surface p-5">
                <p className="text-xs font-bold uppercase tracking-wide text-violet">
                  {c.audience}
                </p>
                <h3 className="mt-1 font-display text-lg font-bold text-indigo">{c.title}</h3>
                <p className="mt-2 text-sm text-muted">{c.summary}</p>
                <ul className="mt-3 space-y-1.5 text-sm text-muted">
                  {c.clauses.map((clause) => (
                    <li key={clause}>• {clause}</li>
                  ))}
                </ul>
                {c.linkedDealId ? (
                  <p className="mt-3 text-xs font-semibold text-violet">
                    Linked deal: {c.linkedDealId}
                  </p>
                ) : null}
              </article>
            ))}
          </div>
        </section>
          </>
        ) : null}

        <p className="text-center text-sm text-muted">
          Admin mediation:{" "}
          <Link href="/admin/trust" className="font-semibold text-violet hover:underline">
            Trust console
          </Link>
          {" · "}
          <Link href="/payments" className="font-semibold text-violet hover:underline">
            Escrow
          </Link>
        </p>
      </div>
    </div>
  );
}
