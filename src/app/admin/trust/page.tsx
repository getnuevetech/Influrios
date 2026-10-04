import Link from "next/link";
import {
  actionAdvanceDispute,
  actionAttachContract,
  actionCreateContract,
} from "@/app/admin/trust/actions";
import { requireAdminPage } from "@/app/admin/guard";
import { hasPermission } from "@/lib/admin-auth";
import { actionAddLedgerEvidence, actionDecideLedgerDispute } from "@/app/admin/trust/ledger-actions";
import { marketplaceConfig } from "@/lib/marketplace-ledger";
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
export const metadata = { title: "Admin · Trust & Disputes" };

type Props = {
  searchParams: Promise<{
    advanced?: string;
    contract?: string;
    attached?: string;
    evidence?: string;
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
  const legacyOn = await legacyDemoPaymentsEnabled();
  const trust = legacyOn ? await getTrustStore() : null;
  const payments = legacyOn ? await getProtectedPaymentsStore() : null;
  const [ledgerDisputes, marketplace] = await Promise.all([
    listMilestoneDisputes().catch(() => []),
    marketplaceConfig().catch(() => null),
  ]);
  const partialRefunds = marketplace?.partialRefundsEnabled ?? true;
  const stats = trust
    ? trustStats(trust)
    : { open: 0, resolved: 0, total: 0, contracts: 0 };
  const enriched = trust ? await Promise.all(trust.disputes.map((d) => enrichDispute(d))) : [];

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
            Ledger disputes block a provider release until ops record a decision. That decision does not move money.
            {legacyOn
              ? "The Phase 9/10 demo mediation queue stays available while legacy demo payments is on."
              : "The Phase 9/10 demo queue is off. Turn on legacy demo payments in marketplace settings to restore it."}
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

      <section className="card-surface space-y-4 p-5">
        <h2 className="font-display text-lg font-bold text-indigo">Ledger disputes</h2>
        <p className="text-xs text-muted">
          {partialRefunds
            ? "A partial refund request waits for a signed provider refund of that amount. The rest of the milestone can be released after approval."
            : "Partial refunds are off. A request already recorded still waits for the provider."}
        </p>
        {ledgerDisputes.length === 0 ? <p className="text-sm text-muted">No ledger disputes yet.</p> : null}
        {ledgerDisputes.map((dispute) => (
          <article key={dispute.id} className="rounded-xl border border-border p-4 text-sm">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="font-semibold text-indigo">
                  {dispute.funding.businessName} → {dispute.funding.creatorSlug}
                </p>
                <p className="text-muted">
                  {dispute.milestone?.title ?? "Milestone"} · {dispute.reasonLabel} · {dispute.status.replaceAll("_", " ")}
                </p>
                <p className="mt-1 text-indigo">{dispute.details}</p>
                <p className="mt-1 text-xs text-muted">
                  {dispute.evidenceLimit > 0
                    ? `Evidence ${dispute.notes.length} of ${dispute.evidenceLimit}. A note does not move money.`
                    : "No further evidence on this dispute."}
                </p>
                {dispute.notes.map((note) => (
                  <p key={note.id} className="mt-1 text-xs text-indigo">
                    {note.author}: {note.body}
                    {note.url ? (
                      <>
                        {" "}
                        <a href={note.url} className="font-semibold text-violet hover:underline" rel="noreferrer" target="_blank">
                          Link
                        </a>
                      </>
                    ) : null}
                  </p>
                ))}
                {dispute.requestedRefundCents ? (
                  <p className="mt-1 text-xs text-muted">Refund requested {formatMoney(dispute.requestedRefundCents, dispute.funding.currency)}. Waiting for the provider.</p>
                ) : null}
                {dispute.milestone && dispute.milestone.refundedCents > 0 ? (
                  <p className="mt-1 text-xs text-muted">
                    Provider refunded {formatMoney(dispute.milestone.refundedCents, dispute.funding.currency)}.{" "}
                    {formatMoney(dispute.milestone.amountCents - dispute.milestone.refundedCents, dispute.funding.currency)} left on this milestone.
                  </p>
                ) : null}
              </div>
            </div>
            {canMediate &&
            ["open", "under_review", "refund_requested"].includes(dispute.status) &&
            dispute.notes.length < dispute.evidenceLimit ? (
              <form action={actionAddLedgerEvidence} className="mt-3 flex flex-wrap items-end gap-2">
                <input type="hidden" name="disputeId" value={dispute.id} />
                <label className="text-xs font-semibold text-muted">
                  Evidence
                  <input name="body" required minLength={8} className="mt-1 rounded-lg border border-border px-2 py-1.5 text-sm" />
                </label>
                <label className="text-xs font-semibold text-muted">
                  https link
                  <input name="url" placeholder="https://" className="mt-1 rounded-lg border border-border px-2 py-1.5 text-sm" />
                </label>
                <button type="submit" className="rounded-xl border border-border bg-white px-3 py-1.5 text-xs font-semibold text-indigo">
                  Add evidence
                </button>
              </form>
            ) : null}
            {canMediate && ["open", "under_review", "refund_requested"].includes(dispute.status) ? (
              <form action={actionDecideLedgerDispute} className="mt-3 flex flex-wrap items-end gap-2">
                <input type="hidden" name="disputeId" value={dispute.id} />
                <label className="text-xs font-semibold text-muted">
                  Decision
                  <select name="decision" className="mt-1 rounded-lg border border-border px-2 py-1.5 text-sm text-indigo">
                    <option value="review">Mark under review</option>
                    <option value="release">Allow release</option>
                    <option value="refund">Request full refund</option>
                    {partialRefunds ? <option value="partial">Request partial refund</option> : null}
                    <option value="withdraw">Withdraw</option>
                  </select>
                </label>
                {partialRefunds ? (
                  <label className="text-xs font-semibold text-muted">
                    Partial / override USD
                    <input name="requestedUsd" type="number" min={0} step={1} className="mt-1 w-28 rounded-lg border border-border px-2 py-1.5 text-sm" />
                  </label>
                ) : (
                  <label className="text-xs font-semibold text-muted">
                    Override USD (dual-approval check)
                    <input name="requestedUsd" type="number" min={0} step={1} className="mt-1 w-36 rounded-lg border border-border px-2 py-1.5 text-sm" />
                  </label>
                )}
                <label className="text-xs font-semibold text-muted">
                  Second approver email
                  <input
                    name="secondApprover"
                    type="email"
                    placeholder="Required above dual-approval threshold"
                    className="mt-1 w-52 rounded-lg border border-border px-2 py-1.5 text-sm"
                  />
                </label>
                <label className="text-xs font-semibold text-muted">
                  Note
                  <input name="note" className="mt-1 rounded-lg border border-border px-2 py-1.5 text-sm" />
                </label>
                <button type="submit" className="btn-primary !py-1.5 text-xs">
                  Record decision
                </button>
              </form>
            ) : null}
          </article>
        ))}
      </section>

      {params.error ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {params.error}
        </div>
      ) : null}
      {params.advanced || params.contract || params.attached || params.evidence ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          Saved
          {params.advanced ? ` · dispute ${params.advanced} updated` : ""}
          {params.contract ? " · contract created" : ""}
          {params.attached ? " · contract attached" : ""}
          {params.evidence ? " · evidence saved" : ""}.
        </div>
      ) : null}

      {legacyOn && trust && payments ? (
        <>
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
                <option value="creator">Influencer</option>
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
        </>
      ) : null}

      {legacyOn && trust ? (
        <p className="text-xs text-muted">
          {trust.notes} · Public view:{" "}
          <Link href="/trust" className="font-semibold text-violet hover:underline">
            /trust
          </Link>
        </p>
      ) : (
        <p className="text-xs text-muted">
          Public view:{" "}
          <Link href="/trust" className="font-semibold text-violet hover:underline">
            /trust
          </Link>
        </p>
      )}
    </div>
  );
}
