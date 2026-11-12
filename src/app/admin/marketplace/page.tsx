import Link from "next/link";
import { requireAdminPage } from "@/app/admin/guard";
import { hasPermission } from "@/lib/admin-auth";
import { actionAcceptFundingSettlement, actionApproveReleasePush, actionCancelUnfundedPrefund, actionExecuteHeldCancellation, actionPushProviderRelease, actionSaveReleaseAutomation, actionScheduleMilestoneRelease } from "@/app/admin/marketplace/actions";
import { prisma } from "@/lib/db";
import { getLaunchGate } from "@/lib/launch-gate";
import { readShareSnapshot } from "@/lib/fx-share";
import { CANCELLATION_REASON_LABELS, type CancellationReason } from "@/lib/cancellation-matrix";
import { listPaymentRiskFundings } from "@/lib/collaboration-cancellation";
import { readSettlementProposal } from "@/lib/cancellation-settlement";
import { scheduleLabel } from "@/lib/schedule";
import { formatMoney, formatStoredMoney } from "@/lib/money";
import { ledgerMonthlyReport, ledgerTotals, listFundings } from "@/lib/marketplace-ledger";
import { productSwitch } from "@/lib/product-switches";
import { FEE_TYPE_LABELS, type FeeType } from "@/lib/collaboration-fees";
import { feeTypeFromFundingSnapshot, type FeeTypeAmount } from "@/lib/ledger";
import { AdminCollapse } from "@/components/admin-collapse";
import { listFundingSweepResults } from "@/lib/jobs";
import { releaseQueueStep } from "@/lib/collab-ops-jobs";

export const dynamic = "force-dynamic";
export const metadata = { title: "Admin · Marketplace ledger" };

type Props = {
  searchParams: Promise<{ saved?: string; error?: string; code?: string; wiseRate?: string; wiseCurrency?: string; q?: string; status?: string; page?: string }>;
};

const CANCEL_REASONS = Object.keys(CANCELLATION_REASON_LABELS) as CancellationReason[];

const RELEASE_LOG_LABEL: Record<string, string> = {
  milestone_release_scheduled: "Scheduled",
  milestone_release_approved: "Approved",
  milestone_release_requested: "Sent to provider",
  milestone_release_skipped: "Skipped",
  "launch_gate.release_automation": "Switches saved",
  provider_instruction_release: "Instruction recorded",
  milestone_release_external: "Waiting for external handling",
};

function releaseWhen(value: Date) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/Chicago",
    timeZoneName: "short",
  }).format(value);
}

function releaseLogDetail(after: unknown) {
  if (!after || typeof after !== "object") return "";
  const row = after as { reference?: unknown; error?: unknown };
  if (typeof row.error === "string" && row.error.trim()) return row.error.trim();
  if (typeof row.reference === "string" && row.reference.trim()) return row.reference.trim();
  return "";
}

function formatFeesByType(feesByType: FeeTypeAmount[], currency: string, totalCents: number) {
  if (feesByType.length === 0) return formatStoredMoney(totalCents, currency);
  if (feesByType.length === 1) {
    const only = feesByType[0];
    const label = FEE_TYPE_LABELS[only.feeType as FeeType] ?? only.feeType;
    return `${label} ${formatStoredMoney(only.amountCents, currency)}`;
  }
  const parts = feesByType.map((row) => {
    const label = FEE_TYPE_LABELS[row.feeType as FeeType] ?? row.feeType;
    return `${label} ${formatStoredMoney(row.amountCents, currency)}`;
  });
  return `${formatStoredMoney(totalCents, currency)} (${parts.join("; ")})`;
}

export default async function AdminMarketplacePage({ searchParams }: Props) {
  const session = await requireAdminPage("marketplace");
  const canManage = hasPermission(session, "marketplace.manage");
  const canHighRiskCancel = hasPermission(session, "collab_finance.high_risk");
  const params = await searchParams;
  const launchGate = await getLaunchGate().catch(() => null);
  const approvalOn = launchGate?.automaticReleaseApprovalEnabled === true;
  const providerOn = launchGate?.automaticProviderReleaseEnabled === true;
  const [fundings, heldFundings, riskFundings, totals, reportsOn, paymentRisk, payoutQueue, releaseLog, proposedSettlements] = await Promise.all([
    listFundings({ q: params.q, status: params.status, page: Number(params.page) || 1 }),
    listFundings({ status: "held", pageSize: 50 }),
    listFundings({ status: "payment_risk", pageSize: 50 }),
    ledgerTotals(),
    productSwitch("financial_reports"),
    listPaymentRiskFundings(),
    prisma.fundingMilestone.findMany({
      where: {
        status: { in: ["approved", "release_scheduled", "release_requested", "payout_failed", "returned"] },
        funding: { status: "held" },
      },
      include: { funding: { select: { id: true, businessName: true, creatorSlug: true, currency: true, title: true, providerCode: true } } },
      orderBy: { updatedAt: "asc" },
      take: 50,
    }),
    prisma.auditLog.findMany({
      where: {
        action: {
          in: [
            "milestone_release_scheduled",
            "milestone_release_approved",
            "milestone_release_requested",
            "milestone_release_skipped",
            "launch_gate.release_automation",
            "provider_instruction_release",
          ],
        },
      },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
    prisma.fundingSettlement.findMany({
      where: { status: "proposed" },
      orderBy: { createdAt: "desc" },
      take: 20,
      include: { funding: { select: { id: true, businessName: true, creatorSlug: true, title: true, currency: true } } },
    }),
  ]);
  const externalReleases = payoutQueue.length
    ? await prisma.providerCommand.findMany({
        where: { operation: "release", status: "external", milestoneId: { in: payoutQueue.map((row) => row.id) } },
        select: { milestoneId: true },
      })
    : [];
  const externalMilestoneIds = new Set(externalReleases.map((row) => row.milestoneId));
  const monthly = reportsOn ? await ledgerMonthlyReport() : [];
  const sweeps = await listFundingSweepResults().catch(() => []);
  const fundingRows = fundings.rows;
  const actionable = [...heldFundings.rows, ...riskFundings.rows];
  const cancellable = actionable.filter((f) => f.status === "held" || f.status === "payment_risk");
  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin" className="text-sm font-semibold text-violet hover:underline">
          ← Admin
        </Link>
        <h1 className="mt-2 font-display text-3xl font-bold text-indigo">Marketplace ledger</h1>
        <p className="mt-2">
          <Link href="/admin/marketplace/settings" className="text-sm font-semibold text-violet hover:underline">
            Provider, jurisdictions, rates, and templates →
          </Link>
        </p>
        <div className="mt-4 rounded-2xl border border-[#E4EBFF] bg-white p-4">
          <h2 className="font-display text-lg font-bold text-indigo">Sweep results</h2>
          <p className="mt-1 text-xs text-muted">
            Opening this page does not approve milestones or create a recurring prefund. Those run from the queued jobs below.
          </p>
          <ul className="mt-2 space-y-1 text-xs text-muted">
            {sweeps.map((job) => (
              <li key={job.id}>
                {job.updatedAt.toISOString()} · {job.kind} · {job.status}
                {job.lastError ? ` · ${job.lastError}` : ""}
              </li>
            ))}
            {sweeps.length === 0 ? <li>No auto-approval or recurring sweep has been queued yet.</li> : null}
          </ul>
        </div>
        <p className="mt-1 max-w-2xl text-sm text-muted">
          A prefund stays unfunded until a signed provider webhook confirms it. A provider code named demo
          cannot confirm a hold. Cancelling before confirmation posts no ledger entry. Dispute decisions do not
          move the money the provider is holding.
          Attribution is copied onto the prefund and is not rewritten when the source list changes. Staged or recurring
          prefunds stay unfunded until each tranche has its own confirmation. Gross is entered in USD. A new prefund
          uses the currency saved on that country corridor when one is saved, and otherwise the jurisdiction currency.
          A blank currency is not saved as USD. Revenue-share lines are written when the provider releases a
          milestone. They are not cash.
        </p>
      </div>

      {params.saved ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          Saved {params.saved}.
        </div>
      ) : null}
      {params.error ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {params.error}
        </div>
      ) : null}

      <AdminCollapse
        title="Payout release"
        subtitle={`${payoutQueue.length} milestone${payoutQueue.length === 1 ? "" : "s"} waiting · approval ${approvalOn ? "automatic" : "manual"} · provider send ${providerOn ? "automatic" : "manual"}`}
        defaultOpen
      >
        <h2 className="sr-only">Payout release</h2>
        <p className="mt-1 text-xs text-muted">
          Every approved milestone stays in this list until the provider confirms <code className="text-[11px]">payout.released</code>.
          With a switch off, each row has its own button. With a switch on, the row stays visible and the release sweep does that step.
          Saving the switches runs the sweep once. A Stripe send records the instruction here; it does not call Stripe.
        </p>
        {canManage ? (
          <form action={actionSaveReleaseAutomation} className="mt-3 grid gap-2 text-sm">
            <label className="flex gap-2">
              <input type="checkbox" name="automaticReleaseApprovalEnabled" defaultChecked={approvalOn} />
              Automatic release approval
            </label>
            <label className="flex gap-2">
              <input type="checkbox" name="automaticProviderReleaseEnabled" defaultChecked={providerOn} />
              Automatic provider release
            </label>
            <button type="submit" className="w-fit rounded-full bg-indigo px-4 py-2 text-xs font-bold text-white">
              Save release switches
            </button>
          </form>
        ) : (
          <p className="mt-3 text-sm text-muted">Marketplace managers can change these switches.</p>
        )}
        {payoutQueue.length === 0 ? (
          <p className="mt-4 text-sm text-muted">No approved milestone is waiting for a payout.</p>
        ) : (
          <ul className="mt-4 space-y-2">
            {payoutQueue.map((milestone) => {
              const external = externalMilestoneIds.has(milestone.id);
              const step = external
                ? { action: "wait_provider" as const, label: "Recorded for external handling. This route does not send the payout." }
                : releaseQueueStep({
                    status: milestone.status,
                    releaseApprovedAt: milestone.releaseApprovedAt,
                    automaticReleaseApproval: approvalOn,
                    automaticProviderRelease: providerOn,
                  });
              return (
                <li key={milestone.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[#E4EBFF] px-3 py-2 text-sm">
                  <div className="min-w-0">
                    <p className="font-semibold text-indigo">
                      {milestone.funding.title} · {milestone.title}
                    </p>
                    <p className="text-xs text-muted">
                      {milestone.funding.businessName} → {milestone.funding.creatorSlug} · {formatMoney(milestone.amountCents, milestone.funding.currency)} · {milestone.funding.providerCode || "provider unset"} · {milestone.status.replaceAll("_", " ")}
                    </p>
                    {step.action === "wait_provider" || step.action === "wait_sweep" ? (
                      <p className="mt-1 text-xs text-muted">{step.label}</p>
                    ) : null}
                  </div>
                  {canManage && step.action === "schedule" ? (
                    <form action={actionScheduleMilestoneRelease}>
                      <input type="hidden" name="fundingId" value={milestone.fundingId} />
                      <input type="hidden" name="milestoneId" value={milestone.id} />
                      <button type="submit" className="btn-secondary !py-1.5 text-xs">{step.label}</button>
                    </form>
                  ) : null}
                  {canManage && step.action === "approve" ? (
                    <form action={actionApproveReleasePush}>
                      <input type="hidden" name="milestoneId" value={milestone.id} />
                      <button type="submit" className="btn-secondary !py-1.5 text-xs">{step.label}</button>
                    </form>
                  ) : null}
                  {canManage && step.action === "send" ? (
                    <form action={actionPushProviderRelease}>
                      <input type="hidden" name="milestoneId" value={milestone.id} />
                      <button type="submit" className="btn-primary !py-1.5 text-xs">{step.label}</button>
                    </form>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
        <h3 className="mt-5 font-display text-base font-bold text-indigo">Release log</h3>
        {releaseLog.length === 0 ? (
          <p className="mt-2 text-sm text-muted">No release has been scheduled, approved, or sent yet.</p>
        ) : (
          <ul className="mt-2 space-y-1 text-xs text-muted">
            {releaseLog.map((entry) => {
              const detail = releaseLogDetail(entry.after);
              return (
                <li key={entry.id}>
                  {releaseWhen(entry.createdAt)} · {RELEASE_LOG_LABEL[entry.action] ?? entry.action} · {entry.actor}
                  {detail ? ` · ${detail}` : ""}
                </li>
              );
            })}
          </ul>
        )}
      </AdminCollapse>

      <AdminCollapse title="Chargebacks & held cancellations" subtitle="High-risk ops">
        <h2 className="sr-only">Chargebacks & held cancellations</h2>
        <p className="mt-1 text-xs text-muted">
          Chargebacks move a held prefund into payment-risk with no automatic refund. Other cancel reasons and
          dispute refund decisions queue a durable provider instruction (
          <code className="text-[11px]">mkt_refund_*</code> / <code className="text-[11px]">mkt_cancel_*</code>
          ); ledger balances still change only on signed{" "}
          <code className="text-[11px]">payout.refunded</code>. Releases stay blocked while status is payment-risk.
        </p>
        {paymentRisk.length > 0 ? (
          <ul className="mt-3 space-y-2 text-sm text-indigo">
            {paymentRisk.map((funding) => (
              <li key={funding.id} className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2">
                <span className="font-semibold">Payment risk</span> · {funding.businessName} → {funding.creatorSlug} ·{" "}
                {funding.title} · held {formatMoney(funding.ledger.heldCents, funding.currency)}
                {funding.evidence ? (
                  <p className="mt-1 text-xs text-rose-900">
                    Evidence:{" "}
                    {[
                      funding.evidence.providerCaseId ? `case ${funding.evidence.providerCaseId}` : null,
                      funding.evidence.providerReference
                        ? `ref ${funding.evidence.providerReference}`
                        : null,
                      funding.evidence.reasonCode ? `code ${funding.evidence.reasonCode}` : null,
                      funding.evidence.amountCents != null
                        ? `${formatStoredMoney(funding.evidence.amountCents, funding.evidence.currency)}`
                        : null,
                    ]
                      .filter(Boolean)
                      .join(" · ") || "pack recorded"}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-sm text-muted">No payment-risk fundings right now.</p>
        )}
        {canHighRiskCancel && proposedSettlements.length > 0 ? (
          <form action={actionAcceptFundingSettlement} className="mt-4 grid gap-3 sm:grid-cols-2">
            <p className="text-xs text-muted sm:col-span-2">
              Accepting a proposal freezes it. The refund is sent only when that accepted version is executed.
            </p>
            <label className="text-xs font-semibold text-muted sm:col-span-2">
              Proposed settlement
              <select name="fundingId" required className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm text-indigo">
                {proposedSettlements.map((row) => {
                  const proposal = readSettlementProposal(row.proposalJson);
                  return (
                    <option key={row.id} value={row.fundingId}>
                      v{row.versionNumber} · {row.funding.businessName} → {row.funding.creatorSlug} · {row.funding.title}
                      {proposal ? ` · refund ${formatMoney(proposal.businessRefundCents, row.funding.currency)}` : ""}
                    </option>
                  );
                })}
              </select>
            </label>
            <label className="text-xs font-semibold text-muted">
              Step-up password
              <input name="stepUpPassword" type="password" required className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm text-indigo" />
            </label>
            <button className="w-fit self-end rounded-full bg-indigo px-4 py-2 text-xs font-bold text-white">Accept settlement</button>
          </form>
        ) : null}
        {canHighRiskCancel && cancellable.length > 0 ? (
          <form action={actionExecuteHeldCancellation} className="mt-4 grid gap-3 sm:grid-cols-2">
            <label className="text-xs font-semibold text-muted sm:col-span-2">
              Funding
              <select name="fundingId" required className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm text-indigo">
                <option value="">Select held or payment-risk prefund</option>
                {cancellable.map((funding) => (
                  <option key={funding.id} value={funding.id}>
                    {funding.status} · {funding.businessName} → {funding.creatorSlug} · {funding.title} ·{" "}
                    {formatMoney(funding.grossCents, funding.currency)}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs font-semibold text-muted">
              Reason
              <select name="reason" required className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm text-indigo">
                {CANCEL_REASONS.map((reason) => (
                  <option key={reason} value={reason}>
                    {CANCELLATION_REASON_LABELS[reason]}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs font-semibold text-muted">
              Current milestone id (optional)
              <input
                name="currentMilestoneId"
                placeholder="cuid"
                className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm text-indigo"
              />
            </label>
            <label className="text-xs font-semibold text-muted">
              Accepted partial USD (optional)
              <input
                name="acceptedPartialUsd"
                type="number"
                min={0}
                step={0.01}
                className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm text-indigo"
              />
            </label>
            <label className="text-xs font-semibold text-muted">
              Note
              <input name="note" className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm text-indigo" />
            </label>
            <label className="text-xs font-semibold text-muted">
              Provider case id (chargeback evidence)
              <input
                name="providerCaseId"
                className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm text-indigo"
              />
            </label>
            <label className="text-xs font-semibold text-muted">
              Provider reference
              <input
                name="providerReference"
                className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm text-indigo"
              />
            </label>
            <label className="text-xs font-semibold text-muted">
              Evidence amount USD
              <input
                name="evidenceAmountUsd"
                type="number"
                min={0}
                step={0.01}
                className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm text-indigo"
              />
            </label>
            <label className="text-xs font-semibold text-muted">
              Evidence reason code
              <input
                name="evidenceReasonCode"
                className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm text-indigo"
              />
            </label>
            <label className="text-xs font-semibold text-muted">
              Evidence received at (ISO)
              <input
                name="evidenceReceivedAt"
                placeholder="2026-10-04T12:00:00.000Z"
                className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm text-indigo"
              />
            </label>
            <label className="text-xs font-semibold text-muted sm:col-span-2">
              Evidence attachment URLs (comma or newline)
              <textarea
                name="evidenceAttachmentUrls"
                rows={2}
                className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm text-indigo"
              />
            </label>
            <label className="text-xs font-semibold text-muted sm:col-span-2">
              Confirm password (high-risk)
              <input
                name="stepUpPassword"
                type="password"
                autoComplete="current-password"
                required
                placeholder="Re-enter your admin password"
                className="mt-1 w-full max-w-md rounded-lg border border-border px-3 py-2 text-sm text-indigo"
              />
            </label>
            <div className="sm:col-span-2">
              <button type="submit" className="btn-secondary !py-2 text-sm">
                Queue cancellation / mark payment-risk
              </button>
            </div>
          </form>
        ) : canHighRiskCancel ? (
          <p className="mt-3 text-sm text-muted">No held fundings available to cancel.</p>
        ) : canManage ? (
          <p className="mt-3 text-sm text-muted">
            Held cancel / payment-risk needs Collab finance · High-risk plus password step-up.
          </p>
        ) : null}
      </AdminCollapse>

      <section className="card-surface p-5">
        <h2 className="font-display text-lg font-bold text-indigo">Ledger totals</h2>
        <p className="mt-1 text-xs text-muted">
          These figures are what the provider is holding, released, or refunded. Fees are quoted separately by fee type
          (Product §5). Revenue shares are not cash.
        </p>
        {totals.length === 0 ? <p className="mt-3 text-sm text-muted">No prefunds yet.</p> : null}
        <ul className="mt-3 space-y-2 text-sm text-indigo">
          {totals.map((row) => (
            <li key={row.currency}>
              {row.currency ? `${row.currency} · ` : ""}held {formatStoredMoney(row.heldCents, row.currency)} · released {formatStoredMoney(row.releasedCents, row.currency)} · refunded{" "}
              {formatStoredMoney(row.refundedCents, row.currency)} · fees{" "}
              {formatFeesByType(row.feesByType, row.currency, row.feeCents)}
              {row.unbalanced > 0 ? ` · ${row.unbalanced} unbalanced` : ""}
            </li>
          ))}
        </ul>
      </section>

      {reportsOn ? (
        <section className="card-surface p-5">
          <h2 className="font-display text-lg font-bold text-indigo">Monthly ledger report</h2>
          <p className="mt-1 text-xs text-muted">
            Amounts recorded in each month. Fees show as separate columns by fee type. Revenue shares are left out.
          </p>
          {monthly.length === 0 ? <p className="mt-3 text-sm text-muted">No ledger rows yet.</p> : null}
          <ul className="mt-3 space-y-2 text-sm text-indigo">
            {monthly.map((row) => (
              <li key={`${row.currency}-${row.month}`}>
                {row.month} · {row.currency ? `${row.currency} · ` : ""}holds {formatStoredMoney(row.heldCents, row.currency)} · releases{" "}
                {formatStoredMoney(row.releasedCents, row.currency)} · refunds {formatStoredMoney(row.refundedCents, row.currency)} · fees{" "}
                {formatFeesByType(row.feesByType, row.currency, row.feeCents)}
              </li>
            ))}
          </ul>
        </section>
      ) : (
        <section className="card-surface p-5">
          <h2 className="font-display text-lg font-bold text-indigo">Monthly ledger report</h2>
          <p className="mt-1 text-sm text-muted">The monthly report is turned off.</p>
        </section>
      )}

      <section className="space-y-3">
        <h2 className="font-display text-lg font-bold text-indigo">Funding records</h2>
        <form className="flex flex-wrap gap-2" action="/admin/marketplace">
          <input name="q" defaultValue={params.q ?? ""} placeholder="Business, creator, title, or id" className="rounded-xl border border-border px-3 py-2 text-sm" />
          <select name="status" defaultValue={params.status ?? ""} className="rounded-xl border border-border px-3 py-2 text-sm">
            <option value="">All statuses</option>
            {["awaiting_provider", "held", "completed", "refunded", "payment_risk", "cancelled"].map((value) => (
              <option key={value} value={value}>{value.replaceAll("_", " ")}</option>
            ))}
          </select>
          <button type="submit" className="btn-secondary !py-2 text-sm">Search</button>
        </form>
        <p className="text-xs text-muted">
          {fundings.total} prefund{fundings.total === 1 ? "" : "s"} · page {fundings.page} of {Math.max(1, Math.ceil(fundings.total / fundings.pageSize))}
          {fundings.page > 1 ? (
            <> · <Link className="font-semibold text-violet" href={`/admin/marketplace?q=${encodeURIComponent(params.q ?? "")}&status=${encodeURIComponent(params.status ?? "")}&page=${fundings.page - 1}`}>Previous</Link></>
          ) : null}
          {fundings.page * fundings.pageSize < fundings.total ? (
            <> · <Link className="font-semibold text-violet" href={`/admin/marketplace?q=${encodeURIComponent(params.q ?? "")}&status=${encodeURIComponent(params.status ?? "")}&page=${fundings.page + 1}`}>Next</Link></>
          ) : null}
        </p>
        {fundingRows.length === 0 ? <p className="text-sm text-muted">No prefunds match.</p> : null}
        {fundingRows.map((funding) => {
          const shares = readShareSnapshot(funding.shareSnapshotJson);
          const feeType = feeTypeFromFundingSnapshot(funding.feeSnapshotJson);
          const feeTypeLabel = FEE_TYPE_LABELS[feeType as FeeType] ?? feeType;
          return (
          <AdminCollapse
            key={funding.id}
            title={`${funding.businessName} → ${funding.creatorSlug}`}
            subtitle={`${funding.status.replaceAll("_", " ")} · ${funding.title}`}
          >
          <article className="text-sm">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <Link
                  href={`/admin/marketplace/${funding.id}`}
                  className="inline-block text-xs font-semibold text-violet hover:underline"
                >
                  Open transaction →
                </Link>
                <Link
                  href={`/admin/deals/${funding.id}`}
                  className="ml-3 inline-block text-xs font-semibold text-violet hover:underline"
                >
                  Open deal →
                </Link>
              </div>
            </div>
            <p className="mt-2 text-muted">
              Gross {formatMoney(funding.grossCents, funding.currency)} · {funding.currency} · provider {funding.providerCode} · fee snapshot{" "}
              {formatMoney(funding.feeCents, funding.currency)} ({feeTypeLabel}) · held by provider{" "}
              {formatMoney(funding.ledger.heldCents, funding.currency)} · released{" "}
              {formatMoney(funding.ledger.releasedCents, funding.currency)}
              {funding.attributionLabel ? ` · ${funding.attributionLabel}` : ""}
              {funding.repeatOf ? ` · repeat of ${funding.repeatOf.title}` : ""}
              {scheduleLabel(funding) ? ` · ${scheduleLabel(funding)}` : ""}
              {funding.changeOrderCount > 0 ? ` · change orders ${funding.changeOrderCount} of ${funding.changeOrderLimit}` : ""}
              {shares ? ` · share ${shares.map((party) => `${party.label} ${party.shareBps / 100}%`).join(", ")}` : ""}
            </p>
            {funding.changeOrders.map((order) => (
              <p key={order.id} className="mt-1 text-xs text-indigo">
                Change order {formatMoney(order.previousUsdCents)} → {formatMoney(order.nextUsdCents)}. {order.note}
              </p>
            ))}
            {funding.status === "awaiting_provider" ? (
              <div className="mt-2">
                <p className="text-[11px] text-muted">
                  This prefund stays unfunded until the provider webhook confirms it. A cancellation expires an unpaid checkout and waits if the charge result is unknown.
                </p>
                {canManage ? (
                  <form action={actionCancelUnfundedPrefund} className="mt-2">
                    <input type="hidden" name="fundingId" value={funding.id} />
                    <button className="rounded-full border border-indigo px-3 py-1 text-xs font-bold text-indigo">
                      Cancel unfunded prefund
                    </button>
                  </form>
                ) : null}
              </div>
            ) : null}
            <ul className="mt-2 space-y-1 text-indigo">
              {funding.milestones.map((milestone) => (
                <li key={milestone.id}>
                  {milestone.title} · {formatMoney(milestone.amountCents, funding.currency)} · {milestone.status}
                  {milestone.refundedCents > 0
                    ? ` · refunded ${formatMoney(milestone.refundedCents, funding.currency)} · ${formatMoney(milestone.amountCents - milestone.refundedCents, funding.currency)} left`
                    : ""}
                  {milestone.revisionLimit > 0 ? ` · revisions ${milestone.revisionCount} of ${milestone.revisionLimit}` : " · no revisions"}
                </li>
              ))}
            </ul>
          </article>
          </AdminCollapse>
          );
        })}
      </section>
    </div>
  );
}
