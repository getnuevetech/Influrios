import Link from "next/link";
import { redirect } from "next/navigation";
import { SettlementReview } from "@/components/settlement-review";
import { EmptyPayments, MoneyAmount, PaymentStatus } from "@/components/payment-journey/status";
import { RecordDialog } from "@/components/payment-journey/record-dialog";
import { UnavailableNote } from "@/components/unavailable-note";
import { isBusinessRole } from "@/lib/account-audience";
import { getAccountSession } from "@/lib/accounts";
import { newIncidentReference } from "@/lib/business-status";
import { getWorkspace } from "@/lib/business";
import { prisma } from "@/lib/db";
import { indexCreatorsBySlug, listDirectoryCreators } from "@/lib/directory";
import { syncOpenGatewayDeposits } from "@/lib/funding-checkout";
import { milestoneDeliveryLabel, milestonePayoutLabel } from "@/lib/milestone-delivery";
import { listFundingsForBusiness, listFundingsForCreator } from "@/lib/marketplace-ledger";
import { storedCurrencyCode } from "@/lib/money";
import { readSignedDealMoney } from "@/lib/payment-engine";
import { paymentNextAction } from "@/lib/payment-list";
import { paymentStageNote, paymentStages } from "@/lib/payment-stages";
import { fundingInDateRange } from "@/lib/payment-standard-v4";
import {
  businessOverviewTotals,
  customerPaymentLabel,
  primaryPaymentAction,
  type PaymentStatusLabel,
} from "@/lib/payment-standard-v4";
import {
  memberCancellationReasons,
  readPartyAcceptances,
  readSettlementDisputeNote,
  readSettlementDisputed,
  readSettlementQuestions,
} from "@/lib/member-settlement";

type Search = {
  q?: string;
  status?: string;
  currency?: string;
  page?: string;
  deal?: string;
  tab?: string;
  case?: string;
  error?: string;
  approved?: string;
  returned?: string;
  from?: string;
  to?: string;
};

const FILTERS = ["all", "needs_funding", "funded", "payout_processing", "completed", "issues"] as const;

function href(input: Record<string, string | undefined>) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(input)) {
    if (value) params.set(key, value);
  }
  const query = params.toString();
  return query ? `/payments?${query}` : "/payments";
}

function labelFor(status: string, payout: string): PaymentStatusLabel {
  if (payout === "Paid") return "Payout confirmed";
  if (payout === "Returned" || payout === "Payout failed") return "Payout returned";
  if (payout === "Pending confirmation") return "Payout processing";
  if (status === "refunded") return "Refunded";
  if (status === "payment_risk") return "Needs attention";
  if (status === "held" || status === "completed") return "Funded";
  if (status === "awaiting_provider" || status === "draft" || status === "pending") return "Needs funding";
  return "Needs attention";
}

export async function PaymentsScreen({ searchParams }: { searchParams: Promise<Search> }) {
  const params = await searchParams;
  const account = await getAccountSession().catch(() => null);
  if (!account) redirect("/login?next=/payments&gate=payments");
  const businessViewer = isBusinessRole(account.role);
  const creator = businessViewer
    ? null
    : await prisma.creator.findUnique({ where: { userId: account.id }, select: { slug: true } }).catch(() => null);
  const workspace = businessViewer ? await getWorkspace(account.id).catch(() => null) : null;
  let fundings: Awaited<ReturnType<typeof listFundingsForBusiness>> = [];
  let unavailable: { incident: string } | null = null;
  try {
    fundings =
      businessViewer && workspace?.businessId && workspace.businessId !== "public"
        ? await listFundingsForBusiness(workspace.businessId)
        : creator?.slug
          ? await listFundingsForCreator(creator.slug)
          : [];
  } catch (error) {
    unavailable = { incident: newIncidentReference() };
    console.error("payments list", unavailable.incident, error);
    fundings = [];
  }
  if (unavailable) {
    return (
      <div data-screen="B03" className="space-y-4">
        <h1 className="font-display text-3xl font-bold text-indigo">Collaboration payments</h1>
        <UnavailableNote label="Payment data" incident={unavailable.incident} href="/payments" />
      </div>
    );
  }
  if (businessViewer) {
    const waiting = fundings.filter((row) => row.status === "awaiting_provider");
    const changed = await Promise.all(waiting.map((row) => syncOpenGatewayDeposits(row.id).catch(() => false)));
    if (changed.some(Boolean) && workspace?.businessId && workspace.businessId !== "public") {
      fundings = await listFundingsForBusiness(workspace.businessId).catch(() => fundings);
    }
  }
  const directory = await listDirectoryCreators().catch(() => []);
  const bySlug = indexCreatorsBySlug(directory);
  const nameOf = (slug: string) => bySlug.get(slug)?.displayName ?? slug;
  const currencies = [...new Set(fundings.map((deal) => storedCurrencyCode(deal.currency) ?? "USD"))];
  const currency = currencies.includes(params.currency ?? "") ? params.currency! : currencies[0] ?? "USD";
  const status = FILTERS.includes(params.status as (typeof FILTERS)[number]) ? params.status! : "all";
  const q = (params.q ?? "").trim().toLowerCase();
  const scoped = fundings.filter((deal) => (storedCurrencyCode(deal.currency) ?? "USD") === currency);
  const searched = scoped.filter((deal) => {
    if (!q) return true;
    return `${deal.title} ${deal.businessName} ${nameOf(deal.creatorSlug)}`.toLowerCase().includes(q);
  });
  const bucketOf = (deal: (typeof fundings)[number]) => {
    const payout = deal.milestones.some((row) => milestonePayoutLabel(row.status) === "Pending confirmation");
    const issue = deal.milestones.some((row) => ["Returned", "Payout failed"].includes(milestonePayoutLabel(row.status))) || deal.status === "payment_risk" || (deal.disputes?.length ?? 0) > 0;
    if (issue) return "issues";
    if (payout) return "payout_processing";
    if (deal.status === "completed") return "completed";
    if (deal.status === "held") return "funded";
    if (deal.status === "awaiting_provider" || deal.status === "draft" || deal.status === "pending") return "needs_funding";
    return "all";
  };
  const dated = searched.filter((deal) => fundingInDateRange(deal.updatedAt, params.from ?? "", params.to ?? ""));
  const filtered = dated.filter((deal) => status === "all" || bucketOf(deal) === status);
  const page = Math.max(1, Number(params.page) || 1);
  const pageCount = Math.max(1, Math.ceil(filtered.length / 8));
  const currentPage = Math.min(page, pageCount);
  const rows = filtered.slice((currentPage - 1) * 8, currentPage * 8);
  const needsFunding = searched.filter((deal) => bucketOf(deal) === "needs_funding").length;
  const remaining = searched.filter((deal) => deal.status === "held").reduce((sum, deal) => sum + deal.ledger.heldCents, 0);
  const confirmed = searched.reduce((sum, deal) => sum + deal.ledger.releasedCents, 0);
  const refunds = searched.filter((deal) => (deal.disputes?.length ?? 0) > 0 || deal.status === "refunded").length;
  const selected = fundings.find((deal) => deal.id === params.deal) ?? null;
  const listState = {
    q: params.q,
    status: status === "all" ? undefined : status,
    currency,
    from: params.from,
    to: params.to,
  };
  const close = href({ ...listState, page: currentPage > 1 ? String(currentPage) : undefined });
  const tab = ["overview", "breakdown", "milestones", "transactions", "documents"].includes(params.tab ?? "") ? params.tab! : "overview";

  return (
    <div data-screen="B03" className="space-y-5 bg-background">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold text-indigo">Collaboration payments</h1>
          <p className="mt-1 max-w-2xl text-base text-muted">Funding and influencer payouts for signed agreements. Opening this page does not move money.</p>
        </div>
        <form>
          <label className="text-xs font-semibold text-muted">
            Currency
            <span className="mt-1 flex gap-2">
              <select name="currency" defaultValue={currency} className="h-11 rounded-xl border border-border bg-white px-3 text-sm text-indigo">
                {currencies.map((code) => (
                  <option key={code}>{code}</option>
                ))}
              </select>
              <button className="h-11 rounded-full border border-border px-3 text-sm font-semibold" type="submit">Apply</button>
            </span>
          </label>
        </form>
      </div>
      <p className="text-xs font-semibold text-muted">Totals for {currency}. Other currencies stay in the selector.</p>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ["Needs funding", String(needsFunding)],
          ["Funds remaining", undefined],
          ["Influencer payouts confirmed", undefined],
          ["Refunds processing", String(refunds)],
        ].map(([label, value]) => (
          <div key={label} className="rounded-2xl border border-border bg-white p-4">
            <p className="text-xs font-semibold text-muted">{label}</p>
            <p className="mt-2 font-display text-2xl font-bold text-indigo">
              {label === "Funds remaining" ? <MoneyAmount cents={remaining} currency={currency} /> : null}
              {label === "Influencer payouts confirmed" ? <MoneyAmount cents={confirmed} currency={currency} /> : null}
              {value ?? null}
            </p>
          </div>
        ))}
      </div>
      {params.error ? <p className="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-800">{params.error}</p> : null}
      {params.returned ? <p className="rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-950">Checkout returned. Funding stays unconfirmed until the provider confirms it.</p> : null}
      <form className="flex flex-wrap gap-2" action="/payments">
        <input type="hidden" name="currency" value={currency} />
        {status !== "all" ? <input type="hidden" name="status" value={status} /> : null}
        <input name="q" defaultValue={params.q ?? ""} placeholder="Search collaborations, influencers, or references" className="h-11 min-w-0 flex-1 rounded-xl border border-border px-3 text-sm" />
        <label className="text-xs font-semibold text-muted">
          From
          <input name="from" type="date" defaultValue={params.from ?? ""} className="ml-2 h-11 rounded-xl border border-border px-3 text-sm" />
        </label>
        <label className="text-xs font-semibold text-muted">
          To
          <input name="to" type="date" defaultValue={params.to ?? ""} className="ml-2 h-11 rounded-xl border border-border px-3 text-sm" />
        </label>
        <button className="h-11 rounded-full bg-violet px-4 text-sm font-semibold text-white" type="submit">Search</button>
      </form>
      <div className="flex flex-wrap gap-2">
        {FILTERS.map((item) => (
          <Link key={item} href={href({ currency, status: item === "all" ? undefined : item, q: params.q, from: params.from, to: params.to })} className={`inline-flex h-11 items-center rounded-full px-3 text-sm font-semibold ${status === item ? "bg-violet text-white" : "bg-white text-indigo"}`}>
            {item.replaceAll("_", " ")}
          </Link>
        ))}
      </div>
      {rows.length === 0 ? <EmptyPayments filtered={Boolean(q) || status !== "all" || Boolean(params.from) || Boolean(params.to)} /> : (
        <div className="overflow-x-auto rounded-2xl border border-border bg-white">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="text-xs text-muted">
              <tr>
                <th className="px-4 py-3">Collaboration</th>
                <th className="px-4 py-3">Influencer</th>
                <th className="px-4 py-3">Funded total</th>
                <th className="px-4 py-3">Remaining</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Next action</th>
                <th className="px-4 py-3"> </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((deal) => {
                const payout = deal.milestones.map((row) => milestonePayoutLabel(row.status));
                const statusLabel = labelFor(deal.status, payout.find((item) => item !== "Not initiated") ?? "Not initiated");
                const next = paymentNextAction({
                  status: deal.status,
                  role: businessViewer ? "business" : "influencer",
                  payoutPending: payout.includes("Pending confirmation"),
                  payoutReturned: payout.includes("Returned") || payout.includes("Payout failed"),
                });
                const code = storedCurrencyCode(deal.currency) ?? currency;
                return (
                  <tr key={deal.id} className="border-t border-[#f0f3fa]">
                    <td className="px-4 py-3 font-semibold text-indigo">{deal.title}</td>
                    <td className="px-4 py-3">{nameOf(deal.creatorSlug)}</td>
                    <td className="px-4 py-3"><MoneyAmount cents={deal.status === "held" || deal.status === "completed" ? deal.ledger.heldCents + deal.ledger.releasedCents : 0} currency={code} /></td>
                    <td className="px-4 py-3"><MoneyAmount cents={deal.ledger.heldCents} currency={code} /></td>
                    <td className="px-4 py-3"><PaymentStatus label={statusLabel} /></td>
                    <td className="px-4 py-3">{next}</td>
                    <td className="px-4 py-3">
                      <Link href={href({ ...listState, deal: deal.id, tab: "overview" })} className="font-semibold text-violet">View payment</Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {pageCount > 1 ? (
        <nav className="flex items-center gap-3 text-sm" aria-label="Pages">
          {currentPage > 1 ? <Link href={href({ ...listState, page: String(currentPage - 1) })} className="font-semibold text-violet">Previous</Link> : <span className="text-muted">Previous</span>}
          <span>Page {currentPage} of {pageCount}</span>
          {currentPage < pageCount ? <Link href={href({ ...listState, page: String(currentPage + 1) })} className="font-semibold text-violet">Next</Link> : <span className="text-muted">Next</span>}
        </nav>
      ) : null}
      {selected ? (
        <PaymentDetail
          deal={selected}
          influencer={nameOf(selected.creatorSlug)}
          businessViewer={businessViewer}
          closeHref={close}
          tab={tab}
          caseOpen={params.case === "refund"}
          listHref={href({ q: params.q, status: status === "all" ? undefined : status, currency, deal: selected.id })}
        />
      ) : null}
    </div>
  );
}

async function PaymentDetail({
  deal,
  influencer,
  businessViewer,
  closeHref,
  tab,
  caseOpen,
  listHref,
}: {
  deal: Awaited<ReturnType<typeof listFundingsForBusiness>>[number];
  influencer: string;
  businessViewer: boolean;
  closeHref: string;
  tab: string;
  caseOpen: boolean;
  listHref: string;
}) {
  const code = storedCurrencyCode(deal.currency) ?? "USD";
  const signed = readSignedDealMoney((deal.feeSnapshotJson as { financialPlan?: unknown } | null)?.financialPlan);
  const payouts = deal.milestones.map((row) => milestonePayoutLabel(row.status));
  const statusLabel = labelFor(deal.status, payouts.find((item) => item !== "Not initiated") ?? "Not initiated");
  const stages = paymentStages({
    fundingStatus: deal.status,
    milestoneStatuses: deal.milestones.map((row) => row.status),
    entryKinds: deal.entries.map((entry) => entry.kind),
  });
  const stageNote = paymentStageNote(stages);
  const action = primaryPaymentAction({
    signed: true,
    funded: deal.status === "held" || deal.status === "completed",
    submissionReady: deal.milestones.some((row) => row.status === "submitted"),
    payoutProcessing: payouts.includes("Pending confirmation"),
    payoutProblem: payouts.includes("Returned") || payouts.includes("Payout failed"),
    cancellationOpen: (deal.disputes?.length ?? 0) > 0,
    completed: deal.status === "completed",
  });
  const cards = businessOverviewTotals({
    discloseCounterpartyFees: false,
    collectedCents: deal.ledger.heldCents + deal.ledger.releasedCents,
    remainingCents: deal.ledger.heldCents,
    businessFeeCents: signed?.businessPlatformFeeCents ?? 0,
    taxCents: (signed?.businessTaxCents ?? 0) + (businessViewer ? 0 : signed?.influencerTaxCents ?? 0),
    influencerPaidCents: deal.ledger.releasedCents,
    feesReleasedCents: 0,
  });
  const settlement = caseOpen
    ? await prisma.fundingSettlement.findFirst({
        where: { fundingId: deal.id, status: { in: ["proposed", "accepted", "executed"] } },
        orderBy: { versionNumber: "desc" },
      }).catch(() => null)
    : null;
  const settlementJson = settlement?.proposalJson;
  const tabs = ["overview", "breakdown", "milestones", "transactions", "documents"] as const;
  const actionHref =
    action.label === "Fund collaboration"
      ? `/payments/checkout/${deal.id}`
      : action.label === "View cancellation case"
        ? `${listHref}&case=refund`
        : action.label === "Review submission" || action.label === "Open collaboration"
          ? `/collaboration/work/${deal.id}`
          : `${listHref}&tab=transactions`;

  return (
    <RecordDialog title={deal.title} closeHref={closeHref}>
      <div data-screen={caseOpen ? "R01" : "B04"} data-mobile="M01" className="space-y-4 pb-24 md:pb-0">
        <p className="text-sm text-muted">{deal.businessName} · {influencer}</p>
        <PaymentStatus label={statusLabel} />
        {stageNote ? <p className="rounded-2xl bg-[#F4F0FF] px-4 py-3 text-sm text-indigo">{stageNote}</p> : null}
        {caseOpen ? (
          <div className="space-y-3">
            <h3 className="font-display text-xl font-bold text-indigo">Cancellation case</h3>
            <p className="text-sm text-muted">Requesting or accepting a case does not refund money. Refunded appears after the provider confirms it.</p>
            <SettlementReview
              dealId={deal.id}
              currency={code}
              fundingStatus={deal.status}
              party={businessViewer ? "business" : "influencer"}
              reasons={memberCancellationReasons(businessViewer ? "business" : "influencer")}
              collectedCents={deal.ledger.heldCents + deal.ledger.releasedCents}
              releasedCents={deal.ledger.releasedCents}
              proposal={settlementJson && typeof settlementJson === "object" ? (settlementJson as { influencerNetCents: number; platformRetainedCents: number; retainedInfluencerFeeCents: number; businessRefundCents: number }) : null}
              versionNumber={settlement?.versionNumber ?? null}
              settlementStatus={settlement?.status ?? null}
              acceptedByBusiness={Boolean(readPartyAcceptances(settlementJson).business)}
              acceptedByInfluencer={Boolean(readPartyAcceptances(settlementJson).influencer)}
              disputed={readSettlementDisputed(settlementJson)}
              disputeNote={readSettlementDisputeNote(settlementJson)}
              questions={readSettlementQuestions(settlementJson)}
            />
          </div>
        ) : (
          <>
            <div className="flex flex-wrap gap-2">
              {tabs.map((item) => (
                <Link key={item} href={`${listHref}&tab=${item}`} className={`inline-flex h-11 items-center rounded-full px-3 text-sm font-semibold capitalize ${tab === item ? "bg-lavender text-indigo" : "text-muted"}`} scroll={false}>
                  {item}
                </Link>
              ))}
            </div>
            {tab === "overview" ? (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {cards.map((card) => (
                  <div key={card.label} className="rounded-2xl border border-border p-4">
                    <p className="text-xs text-muted">{card.label}</p>
                    <p className="mt-1 font-display text-xl font-bold"><MoneyAmount cents={card.amountCents} currency={code} /></p>
                  </div>
                ))}
              </div>
            ) : null}
            {tab === "breakdown" ? (
              <div className="space-y-2 text-sm">
                <p>Gross compensation <MoneyAmount cents={signed ? signed.businessPaysCents - signed.businessPlatformFeeCents - (signed.activationFeeCents ?? 0) : deal.grossCents} currency={code} /></p>
                <p>Business collaboration fee <MoneyAmount cents={signed?.businessPlatformFeeCents ?? 0} currency={code} /></p>
                {signed?.activationFeeCents ? <p>Activation <MoneyAmount cents={signed.activationFeeCents} currency={code} /></p> : <p>Activation is not enabled on this agreement.</p>}
                <p>The influencer fee is deducted from influencer compensation. It is not a second business charge.</p>
                {customerPaymentLabel({ collection: deal.status === "held" ? "succeeded" : "created", funds: deal.status === "held" ? "allocated_available" : "unconfirmed", payout: "none", refund: "none" }) ? null : null}
              </div>
            ) : null}
            {tab === "milestones" ? (
              <ol className="space-y-3">
                {deal.milestones.map((milestone, index) => (
                  <li key={milestone.id} className="rounded-2xl border border-border p-4">
                    <p className="font-semibold text-indigo">{index + 1}. {milestone.title}</p>
                    <p className="text-sm text-muted">{milestoneDeliveryLabel(milestone.status)} · {milestonePayoutLabel(milestone.status) === "Paid" ? "Payout confirmed" : milestonePayoutLabel(milestone.status)}</p>
                    <p className="text-sm"><MoneyAmount cents={milestone.amountCents} currency={code} /></p>
                  </li>
                ))}
              </ol>
            ) : null}
            {tab === "transactions" ? <PaymentStageList stages={stages} /> : null}
            {tab === "documents" ? (
              <Link href="/collaboration/contracts" className="font-semibold text-violet">Signed agreements</Link>
            ) : null}
            <div className="sticky bottom-0 border-t border-border bg-white py-3 md:static">
              <Link href={actionHref} className="inline-flex h-11 items-center rounded-full bg-violet px-4 text-sm font-semibold text-white">{action.label}</Link>
            </div>
          </>
        )}
      </div>
    </RecordDialog>
  );
}

function PaymentStageList({ stages }: { stages: ReturnType<typeof paymentStages> }) {
  const note = paymentStageNote(stages);
  return (
    <div className="space-y-3">
      {note ? <p className="rounded-2xl bg-[#F4F0FF] px-4 py-3 text-sm text-indigo">{note}</p> : null}
      <table className="w-full text-left text-sm">
        <thead className="text-xs text-muted">
          <tr>
            <th className="py-2">Transaction</th>
            <th className="py-2">Status</th>
          </tr>
        </thead>
        <tbody>
          {stages.map((stage) => (
            <tr key={stage.id} className="border-t border-border">
              <td className="py-3">
                <p className="font-semibold text-indigo">{stage.label}</p>
                <p className="text-xs text-muted">{stage.detail}</p>
              </td>
              <td className="py-3">{stage.status}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="text-xs text-muted">Paid appears only after the provider confirms the bank payout. A return does not refund the business.</p>
    </div>
  );
}
