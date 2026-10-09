import Link from "next/link";
import { requireAdminPage } from "@/app/admin/guard";
import { hasPermission } from "@/lib/admin-auth";
import { actionAddLedgerEvidence, actionDecideLedgerDispute } from "@/app/admin/trust/ledger-actions";
import { marketplaceConfig } from "@/lib/marketplace-ledger";
import { listMilestoneDisputes } from "@/lib/milestone-disputes";
import { purgeLegacyDemoJsonFiles } from "@/lib/legacy-teardown";
import { formatMoney } from "@/lib/money";

export const dynamic = "force-dynamic";
export const metadata = { title: "Admin · Trust & Disputes" };

type Props = {
  searchParams: Promise<{
    advanced?: string;
    evidence?: string;
    error?: string;
  }>;
};

const OPEN_LEDGER = new Set(["open", "under_review", "refund_requested", "escalated_provider", "escalated_legal"]);

export default async function AdminTrustPage({ searchParams }: Props) {
  const session = await requireAdminPage("trust");
  const canMediate = hasPermission(session, "trust.mediate");
  const params = await searchParams;
  const [ledgerDisputes, marketplace] = await Promise.all([
    listMilestoneDisputes().catch(() => []),
    marketplaceConfig().catch(() => null),
    purgeLegacyDemoJsonFiles().catch(() => null),
  ]);
  const partialRefunds = marketplace?.partialRefundsEnabled ?? true;
  const openCount = ledgerDisputes.filter((dispute) => OPEN_LEDGER.has(dispute.status)).length;
  const resolvedCount = ledgerDisputes.length - openCount;

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
          </p>
        </div>
        <div className="flex flex-wrap gap-3 text-center text-xs">
          <div className="rounded-xl bg-amber-100 px-4 py-2">
            <p className="font-display text-lg font-bold text-amber-800">{openCount}</p>
            <p className="text-muted">Open</p>
          </div>
          <div className="rounded-xl bg-emerald-100 px-4 py-2">
            <p className="font-display text-lg font-bold text-emerald-700">{resolvedCount}</p>
            <p className="text-muted">Resolved</p>
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
                  {dispute.milestone?.title ?? "Milestone"} · {dispute.reasonLabel}
                  {dispute.reasonCode ? ` (${dispute.reasonCode})` : ""} · {dispute.status.replaceAll("_", " ")}
                  {dispute.resolutionOutcome ? ` · outcome ${dispute.resolutionOutcome.replaceAll("_", " ")}` : ""}
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
            ["open", "under_review", "refund_requested", "escalated_provider", "escalated_legal"].includes(dispute.status) &&
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
            {canMediate && ["open", "under_review", "refund_requested", "escalated_provider", "escalated_legal"].includes(dispute.status) ? (
              <form action={actionDecideLedgerDispute} className="mt-3 flex flex-wrap items-end gap-2">
                <input type="hidden" name="disputeId" value={dispute.id} />
                <label className="text-xs font-semibold text-muted">
                  Decision
                  <select name="decision" className="mt-1 rounded-lg border border-border px-2 py-1.5 text-sm text-indigo">
                    <option value="review">Mark under review</option>
                    <option value="release">Creator release</option>
                    <option value="refund">Brand refund (full)</option>
                    {partialRefunds ? <option value="partial">Split amount (partial refund)</option> : null}
                    <option value="settle">Mutual settlement</option>
                    <option value="escalate_provider">Escalate to provider</option>
                    <option value="escalate_legal">Escalate to legal</option>
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
      {params.advanced || params.evidence ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          Saved
          {params.advanced ? ` · dispute ${params.advanced}` : ""}
          {params.evidence ? " · evidence saved" : ""}.
        </div>
      ) : null}

      <p className="text-xs text-muted">
        Public view:{" "}
        <Link href="/trust" className="font-semibold text-violet hover:underline">
          /trust
        </Link>
      </p>
    </div>
  );
}
