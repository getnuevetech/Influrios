import Link from "next/link";
import { redirect } from "next/navigation";
import {
  actionAddEvidence,
  actionApproveMilestone,
  actionCancelPrefund,
  actionOpenFundingCheckout,
  actionOpenDispute,
  actionStopSeries,
  actionRequestChangeOrder,
  actionRequestRevision,
  actionSubmitMilestone,
} from "@/app/payments/actions";
import { isBusinessRole } from "@/lib/account-audience";
import { getAccountSession } from "@/lib/accounts";
import { getWorkspace } from "@/lib/business";
import { prisma } from "@/lib/db";
import { listDisputeReasons } from "@/lib/milestone-disputes";
import { readFxSnapshot, readShareSnapshot } from "@/lib/fx-share";
import { fundingTerm } from "@/lib/ledger";
import { syncOpenGatewayDeposits } from "@/lib/funding-checkout";
import { readSignedDealMoney } from "@/lib/payment-engine";
import { collectionCheckoutFields } from "@/lib/provider-collection";
import { scheduleLabel } from "@/lib/schedule";
import { listFundingsForBusiness, listFundingsForCreator, marketplaceConfig } from "@/lib/marketplace-ledger";
import { memberDealView } from "@/lib/member-deal-money";
import { formatMoney } from "@/lib/money";
import { indexCreatorsBySlug, listDirectoryCreators } from "@/lib/directory";
import { FUNDING_BADGE_CLASS, fundingBadge } from "@/lib/funding-badge";
import { FUNDING_MODE_LABELS, asFundingMode } from "@/lib/funding-modes";
import { RIGHTS_STATUS_LABELS, asRightsStatus } from "@/lib/content-rights";
import {
  buildPayoutFeeFxQuote,
  PAYOUT_METHOD_LABELS,
  PAYOUT_METHODS,
  type PayoutMethod,
} from "@/lib/payout-readiness";

export const dynamic = "force-dynamic";
export const metadata = { title: "Protected Payments" };

type Props = {
  searchParams: Promise<{
    created?: string;
    changed?: string;
    submitted?: string;
    approved?: string;
    revised?: string;
    evidence?: string;
    cancelled?: string;
    disputed?: string;
    checkout?: string;
    returned?: string;
    error?: string;
  }>;
};

const STATUS_COLOR: Record<string, string> = {
  awaiting_provider: "bg-blue-100 text-blue-800",
  held: "bg-violet-100 text-violet-800",
  completed: "bg-emerald-100 text-emerald-800",
  refunded: "bg-amber-100 text-amber-900",
  cancelled: "bg-rose-100 text-rose-800",
};

const MILESTONE_COLOR: Record<string, string> = {
  pending: "bg-slate-100 text-slate-600",
  submitted: "bg-amber-100 text-amber-800",
  approved: "bg-blue-100 text-blue-800",
  released: "bg-emerald-100 text-emerald-800",
  refunded: "bg-amber-100 text-amber-900",
};

export default async function PaymentsPage({ searchParams }: Props) {
  const params = await searchParams;
  const account = await getAccountSession().catch(() => null);
  if (!account) redirect("/login?next=/payments&gate=payments");
  const businessViewer = isBusinessRole(account.role);
  const creator = businessViewer
    ? null
    : await prisma.creator.findUnique({ where: { userId: account.id }, select: { slug: true } }).catch(() => null);
  const workspace = businessViewer ? await getWorkspace(account.id).catch(() => null) : null;

  const [config, loadedFundings, reasons] = await Promise.all([
    marketplaceConfig().catch(() => null),
    businessViewer && workspace?.businessId && workspace.businessId !== "public"
      ? listFundingsForBusiness(workspace.businessId).catch(() => [])
      : creator?.slug
        ? listFundingsForCreator(creator.slug).catch(() => [])
        : Promise.resolve([]),
    listDisputeReasons().catch(() => []),
  ]);
  let fundings = loadedFundings;
  if (businessViewer) {
    const waiting = fundings.filter((row) => row.status === "awaiting_provider");
    const changed = await Promise.all(waiting.map((row) => syncOpenGatewayDeposits(row.id).catch(() => false)));
    if (changed.some(Boolean) && workspace?.businessId && workspace.businessId !== "public") {
      fundings = await listFundingsForBusiness(workspace.businessId).catch(() => fundings);
    }
  }
  const jurisdictions = config?.jurisdictions ?? [];
  const homeJurisdiction = jurisdictions.find((row) => row.code === "US") ?? jurisdictions[0];
  const term = fundingTerm(Boolean(homeJurisdiction?.escrowTermAllowed));
  const usdFundings = fundings.filter((row) => row.currency === "USD");
  const mixedCurrency = fundings.some((row) => row.currency !== "USD");
  const held = usdFundings.reduce((sum, row) => sum + row.ledger.heldCents, 0);
  const released = usdFundings.reduce((sum, row) => sum + row.ledger.releasedCents, 0);
  const confirmed = fundings.filter((row) => row.status === "held" || row.status === "completed").length;
  const directoryCreators = await listDirectoryCreators().catch(() => []);
  const bySlug = indexCreatorsBySlug(directoryCreators);

  return (
    <div className="bg-[#F7FAFF]">
      <section className="hero-atmosphere text-white">
        <div className="mx-auto max-w-[90rem] px-4 py-12 sm:px-6">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-lavender/80">Protected payments</p>
          <h1 className="mt-2 font-display text-4xl font-bold">{term} & milestones</h1>
          <p className="mt-3 max-w-2xl text-white/75">
            Track deliverables and release each milestone only after the marketplace provider confirms the money is
            held. New funding starts from a signed collaboration contract.
          </p>
        </div>
      </section>

      <div className="mx-auto max-w-[90rem] space-y-8 px-4 py-10 sm:px-6">
        <div className="flex flex-wrap gap-3 text-center text-xs">
          <div className="rounded-xl bg-lavender px-4 py-2">
            <p className="font-display text-lg font-bold text-violet">{fundings.length}</p>
            <p className="text-muted">Deals</p>
          </div>
          <div className="rounded-xl bg-[#D9E8FF] px-4 py-2">
            <p className="font-display text-lg font-bold text-blue">{confirmed}</p>
            <p className="text-muted">Provider confirmed</p>
          </div>
          <div className="rounded-xl bg-emerald-100 px-4 py-2">
            <p className="font-display text-lg font-bold text-emerald-700">{formatMoney(released)}</p>
            <p className="text-muted">Released</p>
          </div>
          <div className="rounded-xl bg-amber-100 px-4 py-2">
            <p className="font-display text-lg font-bold text-amber-800">{formatMoney(held)}</p>
            <p className="text-muted">{mixedCurrency ? "Held by provider (USD)" : "Held by provider"}</p>
          </div>
        </div>

        {params.checkout ? (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            Provider reference {params.checkout}. The funding stays unconfirmed until the payment webhook.
          </div>
        ) : null}
        {params.returned ? (
          <div className="rounded-2xl border border-[#E4EBFF] bg-white px-4 py-3 text-sm text-indigo">
            Checkout returned. The funding stays unconfirmed until the payment webhook.
          </div>
        ) : null}
        {params.error ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">{params.error}</div>
        ) : null}
        {params.created || params.changed || params.submitted || params.approved || params.revised || params.evidence || params.cancelled || params.disputed ? (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            {params.created ? `Prefund ${params.created} is waiting for the provider.` : ""}
            {params.changed ? " Change order recorded. The earlier fee snapshot stays on that record. Nothing was held." : ""}
            {params.submitted ? " Milestone submitted for review." : ""}
            {params.approved ? " Milestone approved. Release still waits for the provider." : ""}
            {params.revised ? " Revision requested. The milestone is back with the creator. Nothing was released." : ""}
            {params.evidence ? " Evidence saved. Nothing was released or refunded." : ""}
            {params.cancelled ? " Unconfirmed prefund cancelled. Nothing was held." : ""}
            {params.disputed ? " Dispute opened. Release waits until it is resolved." : ""}
          </div>
        ) : null}

        <section className="card-surface p-6">
          <h2 className="font-display text-xl font-bold text-indigo">Start funding</h2>
          <p className="mt-1 text-sm text-muted">
            Prefunds open only after every party has signed. Use <strong>Start funding</strong> on a signed contract —
            this page tracks held money and milestones for deals you already own.
            {config?.provider.ready
              ? " The marketplace provider is ready to confirm a held prefund."
              : " The marketplace provider is not ready until an admin saves its webhook secret."}
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <Link href="/collaboration/contracts" className="btn-primary !py-2.5 text-sm">
              Open contracts →
            </Link>
            {businessViewer ? (
              <Link href="/collaboration/business" className="btn-secondary !py-2.5 text-sm">
                Business hub
              </Link>
            ) : (
              <Link href="/creator" className="btn-secondary !py-2.5 text-sm">
                Creator home
              </Link>
            )}
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="font-display text-2xl font-bold text-indigo">Active deals</h2>
          {fundings.length === 0 ? (
            <p className="text-sm text-muted">
              No deals on this account yet. Fund from a signed collaboration contract.
            </p>
          ) : null}
          {fundings.map((deal) => {
            const creator = bySlug.get(deal.creatorSlug);
            const jurisdiction = jurisdictions.find((row) => row.code === deal.jurisdictionCode);
            const fx = readFxSnapshot(deal.fxSnapshotJson);
            const shares = readShareSnapshot(deal.shareSnapshotJson);
            const mode = asFundingMode(deal.fundingMode);
            const schedulePartiallyFunded =
              deal.scheduleKind === "staged" &&
              Boolean(deal.scheduleId) &&
              fundings.some(
                (other) =>
                  other.scheduleId === deal.scheduleId &&
                  other.id !== deal.id &&
                  other.status === "awaiting_provider",
              );
            const signedDeal = readSignedDealMoney(
              (deal.feeSnapshotJson as { financialPlan?: unknown } | null)?.financialPlan,
            );
            const money = memberDealView({
              role: businessViewer ? "business" : "influencer",
              grossCents: deal.grossCents,
              feeCents: deal.feeCents,
              plan: deal.feeSnapshotJson,
            });
            const badge = fundingBadge({
              status: deal.status,
              heldCents: deal.ledger.heldCents,
              releasedCents: deal.ledger.releasedCents,
              fundedCents: deal.grossCents,
              protectedPaymentsEnabled: jurisdiction?.protectedPaymentsEnabled,
              fundingMode: deal.fundingMode,
              schedulePartiallyFunded,
            });
            return (
              <article key={deal.id} className="card-surface p-6">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wide text-violet">
                      {deal.businessName} → {creator?.displayName ?? deal.creatorSlug}
                    </p>
                    <h3 className="mt-1 font-display text-xl font-bold text-indigo">{deal.title}</h3>
                    <Link href={`/collaboration/work/${deal.id}`} className="mt-1 inline-block text-xs font-semibold text-violet hover:underline">
                      Deliverables and review →
                    </Link>
                    <p className="mt-1 font-mono text-[11px] text-muted">
                      {deal.id} · {fundingTerm(Boolean(jurisdiction?.escrowTermAllowed))} ·{" "}
                      {FUNDING_MODE_LABELS[mode]}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${FUNDING_BADGE_CLASS[badge]}`}>
                      {badge}
                    </span>
                    <span className={`rounded-full px-3 py-1 text-[10px] font-semibold capitalize ${STATUS_COLOR[deal.status] ?? "bg-slate-100 text-slate-700"}`}>
                      {deal.status.replaceAll("_", " ")}
                    </span>
                  </div>
                </div>
                {businessViewer && deal.scheduleKind === "recurring" && deal.scheduleId && !deal.seriesStopped ? (
                  <form action={actionStopSeries} className="mt-4">
                    <input type="hidden" name="scheduleId" value={deal.scheduleId} />
                    <button type="submit" className="btn-secondary !py-1.5 text-xs">
                      Stop future tranches
                    </button>
                  </form>
                ) : null}
                <div className="mt-4 flex flex-wrap gap-4 text-sm text-muted">
                  {money.lines.map((line) => (
                    <span key={line.label}>
                      {line.label} <strong className="text-indigo">{formatMoney(line.amountCents, deal.currency)}</strong>
                    </span>
                  ))}
                  {fx?.source === "wise" ? (
                    <span>
                      From <strong className="text-indigo">{formatMoney(fx.usdCents)}</strong> at the Wise user rate
                      {fx.rate != null ? ` (${fx.rate})` : ""}
                    </span>
                  ) : null}
                  {fx?.source === "admin" ? (
                    <span>
                      From <strong className="text-indigo">{formatMoney(fx.usdCents)}</strong> at the saved rate
                    </span>
                  ) : null}
                  <span>
                    Released <strong className="text-emerald-700">{formatMoney(deal.ledger.releasedCents, deal.currency)}</strong>
                  </span>
                  <span>
                    Held by provider <strong className="text-amber-800">{formatMoney(deal.ledger.heldCents, deal.currency)}</strong>
                  </span>
                  <span>
                    Provider <strong className="text-indigo">{deal.providerCode}</strong>
                  </span>
                  {deal.collectionProviderCode ? (
                    <span>
                      Collection route <strong className="text-indigo">{deal.collectionProviderCode}</strong>
                    </span>
                  ) : null}
                  {deal.payoutMethod ? (
                    <span>
                      Payout method{" "}
                      <strong className="text-indigo">
                        {(PAYOUT_METHODS as readonly string[]).includes(deal.payoutMethod)
                          ? PAYOUT_METHOD_LABELS[deal.payoutMethod as PayoutMethod]
                          : deal.payoutMethod}
                      </strong>
                    </span>
                  ) : null}
                  {deal.scheduleKind === "recurring" && deal.scheduleId ? (
                    <span>
                      {scheduleLabel({
                        scheduleKind: deal.scheduleKind,
                        trancheIndex: deal.trancheIndex,
                        trancheCount: deal.trancheCount,
                        intervalDays: deal.intervalDays,
                      })}
                      {deal.seriesStopped ? " · stopped" : ""}
                    </span>
                  ) : null}
                  {shares ? (
                    <span>
                      Revenue share{" "}
                      <strong className="text-indigo">
                        {shares.map((party) => `${party.label} ${party.shareBps / 100}%`).join(", ")}
                      </strong>
                    </span>
                  ) : null}
                  {deal.attributionLabel ? (
                    <span>
                      Attribution <strong className="text-indigo">{deal.attributionLabel}</strong>
                    </span>
                  ) : null}
                  {deal.repeatOf ? (
                    <span>
                      Repeat of <strong className="text-indigo">{deal.repeatOf.title}</strong>
                    </span>
                  ) : null}
                  {scheduleLabel(deal) ? (
                    <span>
                      <strong className="text-indigo">{scheduleLabel(deal)}</strong>
                    </span>
                  ) : null}
                </div>
                {businessViewer && deal.status === "awaiting_provider" ? (
                  <div className="mt-4 space-y-3">
                    {(() => {
                      const checkout = collectionCheckoutFields(deal.collectionProviderCode || deal.providerCode);
                      return (
                        <>
                          {checkout.canOpen ? (
                            <form action={actionOpenFundingCheckout} className="flex flex-wrap items-end gap-2">
                              <input type="hidden" name="dealId" value={deal.id} />
                              {checkout.email ? (
                                <label className="text-xs font-semibold text-muted">
                                  Payer email
                                  <input name="email" type="email" required className="mt-1 w-48 rounded-lg border border-border px-2 py-1 text-sm text-indigo" />
                                </label>
                              ) : null}
                              {checkout.phone ? (
                                <label className="text-xs font-semibold text-muted">
                                  M-Pesa phone
                                  <input name="phone" required className="mt-1 w-40 rounded-lg border border-border px-2 py-1 text-sm text-indigo" />
                                </label>
                              ) : null}
                              <button type="submit" className="btn-primary !py-2 text-sm">
                                Open provider checkout
                              </button>
                            </form>
                          ) : null}
                          {(deal.collectionProviderCode || deal.providerCode).trim().toLowerCase() === "stripe" ? (
                            <Link href={`/payments/checkout/${deal.id}`} className="btn-primary inline-flex !py-2 text-sm">
                              Deposit funds
                            </Link>
                          ) : null}
                          {checkout.note ? <p className="text-xs text-muted">{checkout.note}</p> : null}
                        </>
                      );
                    })()}
                    {signedDeal ? (
                      <p className="text-xs text-muted">Signed amounts stay locked.</p>
                    ) : (
                    <details className="rounded-xl border border-border bg-white px-3 py-2">
                      <summary className="cursor-pointer text-xs font-semibold text-indigo">
                        Change order
                        {deal.changeOrderCount > 0 ? ` · ${deal.changeOrderCount} of ${deal.changeOrderLimit}` : ""}
                      </summary>
                      <div className="mt-3 space-y-3">
                        <p className="text-xs text-muted">
                          Change orders {deal.changeOrderCount} of {deal.changeOrderLimit}.
                          {config?.changeOrdersEnabled === false ? " Change orders are turned off." : ""}
                          {" "}A change order can amend this prefund only before the provider confirms the hold.
                        </p>
                        {deal.changeOrders.map((order) => (
                          <p key={order.id} className="text-xs text-indigo">
                            Change order {formatMoney(order.previousUsdCents)} → {formatMoney(order.nextUsdCents)}. {order.note}
                          </p>
                        ))}
                        {config?.changeOrdersEnabled !== false && deal.changeOrderCount < deal.changeOrderLimit ? (
                          <form action={actionRequestChangeOrder} className="flex flex-wrap items-end gap-2">
                            <input type="hidden" name="dealId" value={deal.id} />
                            <label className="text-xs font-semibold text-muted">
                              New gross USD
                              <input
                                name="grossUsd"
                                type="number"
                                min={1}
                                step={1}
                                required
                                className="mt-1 w-32 rounded-lg border border-border px-2 py-1 text-sm text-indigo"
                              />
                            </label>
                            <label className="text-xs font-semibold text-muted">
                              What changed
                              <input
                                name="note"
                                required
                                minLength={8}
                                placeholder="What the amendment covers"
                                className="mt-1 w-64 rounded-lg border border-border px-2 py-1 text-sm text-indigo"
                              />
                            </label>
                            <button type="submit" className="rounded-xl border border-border bg-white px-3 py-1.5 text-xs font-semibold text-indigo">
                              Record change order
                            </button>
                          </form>
                        ) : null}
                      </div>
                    </details>
                    )}
                    <form action={actionCancelPrefund}>
                      <input type="hidden" name="dealId" value={deal.id} />
                      <button type="submit" className="rounded-xl border border-border bg-white px-3 py-1.5 text-xs font-semibold text-indigo">
                        Cancel prefund
                      </button>
                    </form>
                  </div>
                ) : null}
                {mode === "FULL" && deal.milestones.length > 1 ? (
                  <p className="mt-4 text-xs text-muted">
                    One collection for the full amount. These rows are delivery milestones, not staged funding.
                  </p>
                ) : null}
                <ul className="mt-5 space-y-3">
                  {deal.milestones.map((milestone) => (
                    <li
                      key={milestone.id}
                      className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-white px-4 py-3"
                    >
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-semibold text-indigo">{milestone.title}</p>
                          <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${MILESTONE_COLOR[milestone.status] ?? ""}`}>
                            {milestone.status}
                          </span>
                          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-700">
                            {RIGHTS_STATUS_LABELS[asRightsStatus(milestone.rightsStatus)]}
                          </span>
                        </div>
                        <p className="mt-0.5 text-xs text-muted">
                          {formatMoney(milestone.amountCents, deal.currency)}
                          {milestone.refundedCents > 0
                            ? ` · refunded ${formatMoney(milestone.refundedCents, deal.currency)} · ${formatMoney(milestone.amountCents - milestone.refundedCents, deal.currency)} left`
                            : ""}
                          {milestone.revisionLimit > 0
                            ? ` · revisions ${milestone.revisionCount} of ${milestone.revisionLimit}`
                            : " · no revisions"}
                          {milestone.autoApproveAt && milestone.status === "submitted"
                            ? ` · review by ${new Date(milestone.autoApproveAt).toISOString().slice(0, 16).replace("T", " ")} UTC`
                            : milestone.reviewWindowHours
                              ? ` · ${milestone.reviewWindowHours}h review window`
                              : ""}
                          {milestone.status === "approved" && asRightsStatus(milestone.rightsStatus) === "pending"
                            ? " · usage rights activate on payment release"
                            : ""}
                        </p>
                        {milestone.revisionNote && milestone.status === "pending" ? (
                          <p className="mt-1 text-xs text-indigo">Revision: {milestone.revisionNote}</p>
                        ) : null}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {!businessViewer && deal.status === "held" && milestone.status === "pending" ? (
                          <form action={actionSubmitMilestone} className="space-y-2">
                            <input type="hidden" name="dealId" value={deal.id} />
                            <input type="hidden" name="milestoneId" value={milestone.id} />
                            <input name="linkUrl" placeholder="https:// link to the work" className="w-full rounded-lg border border-border px-2 py-1 text-xs" />
                            <input name="note" placeholder="What you are submitting" className="w-full rounded-lg border border-border px-2 py-1 text-xs" />
                            <button type="submit" className="rounded-xl border border-border bg-white px-3 py-1.5 text-xs font-semibold text-indigo hover:bg-lavender">
                              Submit work
                            </button>
                          </form>
                        ) : null}
                        {businessViewer && milestone.status === "submitted" ? (
                          <form action={actionApproveMilestone} className="space-y-2">
                            <input type="hidden" name="dealId" value={deal.id} />
                            <input type="hidden" name="milestoneId" value={milestone.id} />
                            {(() => {
                              if (money.signed) return null;
                              const feeCents = Math.round(
                                (deal.feeCents * (milestone.amountCents || 0)) / Math.max(deal.grossCents, 1),
                              );
                              const quote = buildPayoutFeeFxQuote({
                                creatorGrossCents: milestone.amountCents,
                                platformFeeCents: Math.min(feeCents, milestone.amountCents),
                                fundingCurrency: deal.currency,
                                payoutCurrency: deal.currency,
                              });
                              return quote.ok ? (
                                <p className="text-[11px] text-muted">
                                  Exact fee/FX before confirm: net{" "}
                                  {formatMoney(quote.quote.creatorNetCents, deal.currency)} after{" "}
                                  {formatMoney(quote.quote.platformFeeCents, deal.currency)} fee
                                  {quote.quote.fxApplied ? ` · FX → ${quote.quote.payoutCurrency}` : ""}.
                                </p>
                              ) : null;
                            })()}
                            <button type="submit" className="btn-primary !px-3 !py-1.5 text-xs">
                              Approve work
                            </button>
                          </form>
                        ) : null}
                        {businessViewer &&
                        deal.status === "held" &&
                        milestone.status === "submitted" &&
                        milestone.revisionCount < milestone.revisionLimit ? (
                          <form action={actionRequestRevision} className="flex flex-wrap items-center gap-2">
                            <input type="hidden" name="dealId" value={deal.id} />
                            <input type="hidden" name="milestoneId" value={milestone.id} />
                            <input
                              name="note"
                              required
                              minLength={8}
                              placeholder="What should change"
                              className="rounded-lg border border-border px-2 py-1 text-xs"
                            />
                            <button type="submit" className="rounded-xl border border-border bg-white px-3 py-1.5 text-xs font-semibold text-indigo">
                              Request revision
                            </button>
                          </form>
                        ) : null}
                        {milestone.status === "approved" ? (
                          <p className="text-xs text-muted">Release waits for the provider.</p>
                        ) : null}
                        {deal.status === "held" && milestone.status !== "released" && milestone.status !== "refunded" ? (
                          deal.disputes?.find((dispute) => dispute.milestoneId === milestone.id || dispute.milestoneId == null) ? (
                            <div className="space-y-2">
                              {deal.disputes
                                .filter((dispute) => dispute.milestoneId === milestone.id || dispute.milestoneId == null)
                                .map((dispute) => (
                                  <div key={dispute.id} className="space-y-2">
                                    <p className="text-xs text-muted">
                                      Dispute open. Release waits until it is resolved.
                                      {dispute.evidenceLimit > 0
                                        ? ` Evidence ${dispute.notes.length} of ${dispute.evidenceLimit}.`
                                        : " No further evidence."}
                                    </p>
                                    {dispute.notes.map((note) => (
                                      <p key={note.id} className="text-xs text-indigo">
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
                                    {dispute.notes.length < dispute.evidenceLimit ? (
                                      <form action={actionAddEvidence} className="flex flex-wrap items-center gap-2">
                                        <input type="hidden" name="dealId" value={deal.id} />
                                        <input type="hidden" name="disputeId" value={dispute.id} />
                                        <input name="body" required minLength={8} placeholder="Evidence" className="rounded-lg border border-border px-2 py-1 text-xs" />
                                        <input name="url" placeholder="https link" className="rounded-lg border border-border px-2 py-1 text-xs" />
                                        <button type="submit" className="rounded-xl border border-border bg-white px-3 py-1.5 text-xs font-semibold text-indigo">
                                          Add evidence
                                        </button>
                                      </form>
                                    ) : null}
                                  </div>
                                ))}
                            </div>
                          ) : (
                          <form action={actionOpenDispute} className="flex flex-wrap items-center gap-2">
                            <input type="hidden" name="dealId" value={deal.id} />
                            <input type="hidden" name="milestoneId" value={milestone.id} />
                            <select name="reasonId" className="rounded-lg border border-border px-2 py-1 text-xs" required>
                              {reasons.filter((reason) => reason.active).map((reason) => (
                                <option key={reason.id} value={reason.id}>
                                  {reason.label}
                                </option>
                              ))}
                            </select>
                            <input name="details" required minLength={8} placeholder="What happened" className="rounded-lg border border-border px-2 py-1 text-xs" />
                            <button type="submit" className="rounded-xl border border-border bg-white px-3 py-1.5 text-xs font-semibold text-indigo">
                              Open dispute
                            </button>
                          </form>
                          )
                        ) : null}
                      </div>
                    </li>
                  ))}
                </ul>
              </article>
            );
          })}
        </section>

        <p className="text-center text-sm text-muted">
          Admin ops:{" "}
          <Link href="/admin/marketplace" className="font-semibold text-violet hover:underline">
            Marketplace ledger
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
