import Link from "next/link";
import { redirect } from "next/navigation";
import {
  actionCancelPrefund,
  actionOpenFundingCheckout,
  actionRequestChangeOrder,
  actionStopSeries,
  actionSubmitMilestone,
} from "@/app/payments/actions";
import { PaymentDetailsDialog } from "@/components/collaboration-payments-dialog";
import { ContractRowMenu } from "@/components/contract-agreement-dialog";
import { IconSearch } from "@/components/icons";
import { isBusinessRole } from "@/lib/account-audience";
import { getAccountSession } from "@/lib/accounts";
import { getWorkspace } from "@/lib/business";
import { prisma } from "@/lib/db";
import { milestoneDeliveryLabel, milestonePayoutLabel } from "@/lib/milestone-delivery";
import { syncOpenGatewayDeposits } from "@/lib/funding-checkout";
import { readSignedDealMoney } from "@/lib/payment-engine";
import { collectionCheckoutFields } from "@/lib/provider-collection";
import { listFundingsForBusiness, listFundingsForCreator, marketplaceConfig } from "@/lib/marketplace-ledger";
import { influencerLedgerShare, ledgerEntryVisibleTo, memberDealView } from "@/lib/member-deal-money";
import { storedCurrencyCode } from "@/lib/money";
import { indexCreatorsBySlug, listDirectoryCreators } from "@/lib/directory";

export const dynamic = "force-dynamic";
export const metadata = { title: "Collaboration Payments" };

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
    q?: string;
    status?: string;
    currency?: string;
    page?: string;
    deal?: string;
  }>;
};

type Deal = Awaited<ReturnType<typeof listFundingsForBusiness>>[number];

const PAGE_SIZE = 8;

function ledgerLabel(role: "business" | "influencer", kind: string) {
  if (role === "business" && kind === "hold") return "Funds received";
  if (role === "business" && kind === "collection") return "Funds received";
  if (role === "business" && kind === "release") return "Payout sent";
  if (role === "influencer" && kind === "influencer_payable") return "Held for you";
  if (role === "influencer" && kind === "release") return "Payout confirmed";
  if (kind === "fee" || kind === "fee_pending" || kind === "fee_earned" || kind === "fee_settled") return "Your platform fee";
  if (kind === "refund") return "Refund";
  if (kind === "return") return "Returned";
  return "";
}

function moneyLabel(cents: number, currency: string) {
  const code = storedCurrencyCode(currency) ?? "USD";
  const formatted = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(cents / 100);
  return `${code} ${formatted}`;
}

function initials(name: string) {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? "")
      .join("") || "?"
  );
}

function statusPill(status: string) {
  if (status === "held") return { text: "Funded", className: "bg-emerald-50 text-emerald-700" };
  if (status === "completed") return { text: "Completed", className: "bg-emerald-50 text-emerald-700" };
  if (status === "awaiting_provider" || status === "draft" || status === "pending") {
    return { text: "Awaiting funding", className: "bg-amber-50 text-amber-700" };
  }
  if (status === "payment_risk") return { text: "Payment risk", className: "bg-rose-50 text-rose-700" };
  if (status === "refunded") return { text: "Refunded", className: "bg-amber-50 text-amber-800" };
  if (status === "cancelled") return { text: "Cancelled", className: "bg-slate-100 text-slate-600" };
  return { text: status.replaceAll("_", " "), className: "bg-slate-100 text-slate-600" };
}

function bucket(status: string) {
  if (status === "completed") return "completed";
  if (status === "held") return "funded";
  if (status === "awaiting_provider" || status === "draft" || status === "pending") return "awaiting";
  return "other";
}

function deliveryClass(label: string) {
  if (label === "Approved") return "bg-emerald-50 text-emerald-700";
  if (label === "In review") return "bg-amber-50 text-amber-800";
  if (label === "Open") return "bg-sky-50 text-sky-700";
  return "bg-slate-100 text-slate-600";
}

function payoutClass(label: string) {
  if (label === "Paid") return "bg-emerald-50 text-emerald-700";
  if (label === "Pending confirmation") return "bg-amber-50 text-amber-800";
  return "bg-slate-100 text-slate-600";
}

function ledgerEntries(deal: Deal, role: "business" | "influencer") {
  return deal.entries.flatMap((entry) => {
    const row = entry as Deal["entries"][number] & {
      id?: string;
      createdAt?: Date | string;
      provider?: string;
      eventId?: string;
      party?: string;
      milestoneId?: string | null;
    };
    if (!ledgerEntryVisibleTo({ role, kind: row.kind, party: row.party })) return [];
    if (!ledgerLabel(role, row.kind)) return [];
    return [row];
  });
}

function listHref(input: { q?: string; status?: string; currency?: string; page?: number; deal?: string }) {
  const params = new URLSearchParams();
  if (input.q) params.set("q", input.q);
  if (input.status && input.status !== "all") params.set("status", input.status);
  if (input.currency && input.currency !== "all") params.set("currency", input.currency);
  if (input.page && input.page > 1) params.set("page", String(input.page));
  if (input.deal) params.set("deal", input.deal);
  const query = params.toString();
  return query ? `/payments?${query}` : "/payments";
}

function when(value: Date | string | undefined) {
  if (!value) return "—";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "America/Chicago",
  }).format(date);
}

export default async function PaymentsPage({ searchParams }: Props) {
  const params = await searchParams;
  const account = await getAccountSession().catch(() => null);
  if (!account) redirect("/login?next=/payments&gate=payments");
  const businessViewer = isBusinessRole(account.role);
  const creator = businessViewer
    ? null
    : await prisma.creator.findUnique({ where: { userId: account.id }, select: { slug: true } }).catch(() => null);
  const workspace = businessViewer ? await getWorkspace(account.id).catch(() => null) : null;

  const [config, loadedFundings] = await Promise.all([
    marketplaceConfig().catch(() => null),
    businessViewer && workspace?.businessId && workspace.businessId !== "public"
      ? listFundingsForBusiness(workspace.businessId).catch(() => [])
      : creator?.slug
        ? listFundingsForCreator(creator.slug).catch(() => [])
        : Promise.resolve([]),
  ]);
  let fundings = loadedFundings;
  if (businessViewer) {
    const waiting = fundings.filter((row) => row.status === "awaiting_provider");
    const changed = await Promise.all(waiting.map((row) => syncOpenGatewayDeposits(row.id).catch(() => false)));
    if (changed.some(Boolean) && workspace?.businessId && workspace.businessId !== "public") {
      fundings = await listFundingsForBusiness(workspace.businessId).catch(() => fundings);
    }
  }
  const directoryCreators = await listDirectoryCreators().catch(() => []);
  const bySlug = indexCreatorsBySlug(directoryCreators);
  const contractRows = fundings.length
    ? await prisma.contractDocument
        .findMany({
          where: { fundingId: { in: fundings.map((deal) => deal.id) } },
          select: { id: true, fundingId: true },
        })
        .catch(() => [])
    : [];
  const contractByFunding = new Map(contractRows.flatMap((row) => (row.fundingId ? [[row.fundingId, row.id] as const] : [])));

  const creatorName = (deal: Deal) => bySlug.get(deal.creatorSlug)?.displayName ?? deal.creatorSlug;
  const partyMoney = (row: Deal) =>
    businessViewer
      ? { heldCents: row.ledger.heldCents, releasedCents: row.ledger.releasedCents }
      : influencerLedgerShare({
          grossCents: row.grossCents,
          feeCents: row.feeCents,
          plan: row.feeSnapshotJson,
          ledger: row.ledger,
        });

  const q = (params.q ?? "").trim().toLowerCase();
  const status = ["awaiting", "funded", "completed"].includes(params.status ?? "") ? params.status! : "all";
  const currencies = [...new Set(fundings.map((deal) => storedCurrencyCode(deal.currency) ?? deal.currency))].sort();
  const currency = currencies.includes(params.currency ?? "") ? params.currency! : "all";
  const summaryCurrency = currency !== "all" ? currency : currencies.length === 1 ? currencies[0] : "USD";
  const summaryRows = fundings.filter((deal) => (storedCurrencyCode(deal.currency) ?? deal.currency) === summaryCurrency);
  const held = summaryRows.reduce((sum, row) => sum + partyMoney(row).heldCents, 0);
  const released = summaryRows.reduce((sum, row) => sum + partyMoney(row).releasedCents, 0);
  const fundedCount = fundings.filter((row) => row.status === "held" || row.status === "completed").length;

  const searched = fundings.filter((deal) => {
    if (currency !== "all" && (storedCurrencyCode(deal.currency) ?? deal.currency) !== currency) return false;
    if (!q) return true;
    const haystack = `${deal.title} ${deal.businessName} ${creatorName(deal)} ${deal.creatorSlug}`.toLowerCase();
    return haystack.includes(q);
  });
  const counts = {
    all: searched.length,
    awaiting: searched.filter((deal) => bucket(deal.status) === "awaiting").length,
    funded: searched.filter((deal) => bucket(deal.status) === "funded").length,
    completed: searched.filter((deal) => bucket(deal.status) === "completed").length,
  };
  const filtered = searched.filter((deal) => status === "all" || bucket(deal.status) === status);
  const page = Math.max(1, Number(params.page) || 1);
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const rows = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const selected = fundings.find((deal) => deal.id === params.deal) ?? null;
  const closeHref = listHref({ q: params.q, status, currency, page: currentPage });

  const tabs = [
    ["all", "All deals", counts.all],
    ["awaiting", "Awaiting funding", counts.awaiting],
    ["funded", "Funded", counts.funded],
    ["completed", "Completed", counts.completed],
  ] as const;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold text-[#1B1464]">Collaboration Payments</h1>
          <p className="mt-1 text-sm text-[#667085]">
            Track funding, held funds and payouts for your collaborations. Start funding from a signed collaboration
            contract.
          </p>
        </div>
        <Link
          href="/collaboration/contracts"
          className="inline-flex items-center gap-2 rounded-full border border-[#E4E7EC] bg-white px-4 py-2 text-sm font-semibold text-[#344054]"
        >
          View contracts
        </Link>
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
          {params.approved ? " Milestone approved. The payout is scheduled. Release still waits for the provider." : ""}
          {params.revised ? " Revision requested. The milestone is back with the creator. Nothing was released." : ""}
          {params.evidence ? " Evidence saved. Nothing was released or refunded." : ""}
          {params.cancelled ? " Unconfirmed prefund cancelled. Nothing was held." : ""}
          {params.disputed ? " Dispute opened. Release waits until it is resolved." : ""}
        </div>
      ) : null}

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Deals" value={String(fundings.length)} />
        <Stat label="Funded deals" value={String(fundedCount)} />
        <Stat
          label={businessViewer ? `Held by provider · ${summaryCurrency}` : `Held for you · ${summaryCurrency}`}
          value={moneyLabel(held, summaryCurrency)}
        />
        <Stat label={`Paid out · ${summaryCurrency}`} value={moneyLabel(released, summaryCurrency)} />
      </section>

      <div className="flex flex-wrap gap-2">
        {tabs.map(([id, label, count]) => (
          <Link
            key={id}
            href={listHref({ q: params.q, status: id, currency, page: 1 })}
            scroll={false}
            className={`rounded-full px-3 py-1.5 text-sm font-semibold ${
              status === id ? "bg-[#6D4AFF] text-white" : "bg-white text-[#667085]"
            }`}
          >
            {label} <span className={status === id ? "text-white/80" : "text-[#98A2B3]"}>{count}</span>
          </Link>
        ))}
      </div>

      <section className="rounded-3xl border border-[#E6ECF7] bg-white p-4">
        <form action="/payments" className="flex flex-wrap items-center gap-3">
          <label className="relative min-w-[16rem] flex-1">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#98A2B3]">
              <IconSearch size={16} />
            </span>
            <input
              name="q"
              defaultValue={params.q ?? ""}
              placeholder="Search deals..."
              className="w-full rounded-full border border-[#E6ECF7] bg-[#F7F9FD] py-2.5 pl-10 pr-4 text-sm outline-none focus:border-[#6D4AFF]"
            />
          </label>
          <label className="text-xs font-semibold text-[#667085]">
            Status
            <select
              name="status"
              defaultValue={status}
              className="ml-2 rounded-full border border-[#E6ECF7] bg-white px-3 py-2 text-sm text-[#344054]"
            >
              <option value="all">All</option>
              <option value="awaiting">Awaiting funding</option>
              <option value="funded">Funded</option>
              <option value="completed">Completed</option>
            </select>
          </label>
          <label className="text-xs font-semibold text-[#667085]">
            Currency
            <select
              name="currency"
              defaultValue={currency}
              className="ml-2 rounded-full border border-[#E6ECF7] bg-white px-3 py-2 text-sm text-[#344054]"
            >
              <option value="all">All</option>
              {currencies.map((code) => (
                <option key={code} value={code}>
                  {code}
                </option>
              ))}
            </select>
          </label>
          <button type="submit" className="rounded-full bg-[#F4F0FF] px-4 py-2 text-sm font-semibold text-[#6D4AFF]">
            Apply
          </button>
        </form>

        <ul className="mt-4 space-y-3 md:hidden">
          {rows.map((deal) => {
            const pill = statusPill(deal.status);
            const share = partyMoney(deal);
            const name = creatorName(deal);
            const openHref = listHref({ q: params.q, status, currency, page: currentPage, deal: deal.id });
            return (
              <li key={deal.id} className="rounded-2xl border border-[#E6ECF7] p-3">
                <p className="font-semibold text-[#1B1464]">{deal.title}</p>
                <p className="mt-1 text-sm text-[#344054]">{name}</p>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                  <span className={`rounded-full px-2.5 py-1 font-semibold ${pill.className}`}>{pill.text}</span>
                  <span>Held {moneyLabel(share.heldCents, deal.currency)}</span>
                  <span>Paid {moneyLabel(share.releasedCents, deal.currency)}</span>
                </div>
                <Link
                  href={openHref}
                  scroll={false}
                  className="mt-3 inline-flex rounded-full bg-[#5B4DFF] px-3 py-1.5 text-xs font-semibold text-white"
                >
                  View payment
                </Link>
              </li>
            );
          })}
          {rows.length === 0 ? <li className="py-6 text-sm text-[#667085]">No deals on this account yet. Fund from a signed collaboration contract.</li> : null}
        </ul>
        <div className="mt-4 hidden overflow-x-auto md:block">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="text-xs text-[#98A2B3]">
              <tr>
                <th className="px-2 py-2 font-semibold">Collaboration</th>
                <th className="px-2 py-2 font-semibold">Influencer</th>
                <th className="px-2 py-2 font-semibold">Funding</th>
                <th className="px-2 py-2 font-semibold">Held</th>
                <th className="px-2 py-2 font-semibold">Paid out</th>
                <th className="px-2 py-2 font-semibold">Action</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((deal) => {
                const pill = statusPill(deal.status);
                const share = partyMoney(deal);
                const name = creatorName(deal);
                const openHref = listHref({ q: params.q, status, currency, page: currentPage, deal: deal.id });
                return (
                  <tr key={deal.id} className="border-t border-[#F2F4F7]">
                    <td className="px-2 py-4 font-semibold text-[#1B1464]">{deal.title}</td>
                    <td className="px-2 py-4">
                      <span className="inline-flex items-center gap-2 text-[#344054]">
                        <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[#F4F0FF] text-[11px] font-bold text-[#6D4AFF]">
                          {initials(name)}
                        </span>
                        {name}
                      </span>
                    </td>
                    <td className="px-2 py-4">
                      <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${pill.className}`}>{pill.text}</span>
                    </td>
                    <td className="px-2 py-4 text-[#344054]">{moneyLabel(share.heldCents, deal.currency)}</td>
                    <td className="px-2 py-4 text-[#344054]">{moneyLabel(share.releasedCents, deal.currency)}</td>
                    <td className="px-2 py-4">
                      <span className="inline-flex items-center gap-1">
                        <Link
                          href={openHref}
                          scroll={false}
                          className="rounded-full bg-[#5B4DFF] px-3 py-1.5 text-xs font-semibold text-white"
                        >
                          View payment
                        </Link>
                        <ContractRowMenu
                          items={[
                            { href: `/collaboration/work/${deal.id}`, label: "Open collaboration" },
                            ...(contractByFunding.get(deal.id)
                              ? [{ href: `/collaboration/contracts/${contractByFunding.get(deal.id)}`, label: "View contract" }]
                              : []),
                          ]}
                        />
                      </span>
                    </td>
                  </tr>
                );
              })}
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-2 py-8 text-sm text-[#667085]">
                    No deals on this account yet. Fund from a signed collaboration contract.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs text-[#98A2B3]">
          {filtered.length === 0
            ? "0 deals"
            : `${(currentPage - 1) * PAGE_SIZE + 1}–${Math.min(currentPage * PAGE_SIZE, filtered.length)} of ${filtered.length}`}
        </p>
        {pageCount > 1 ? (
          <div className="mt-2 flex gap-1">
            {Array.from({ length: pageCount }, (_, index) => index + 1).map((number) => (
              <Link
                key={number}
                href={listHref({ q: params.q, status, currency, page: number })}
                scroll={false}
                className={`flex h-7 w-7 items-center justify-center rounded-full text-xs ${
                  number === currentPage ? "bg-[#6D4AFF] text-white" : "text-[#667085]"
                }`}
              >
                {number}
              </Link>
            ))}
          </div>
        ) : null}
      </section>

      {config?.provider.ready ? null : (
        <p className="text-xs text-[#667085]">The marketplace provider is not ready until an admin saves its webhook secret.</p>
      )}

      {selected ? (
        <PaymentDialog
          deal={selected}
          businessViewer={businessViewer}
          creatorName={creatorName(selected)}
          contractId={contractByFunding.get(selected.id) ?? null}
          closeHref={closeHref}
          heldCents={partyMoney(selected).heldCents}
          releasedCents={partyMoney(selected).releasedCents}
          changeOrdersEnabled={config?.changeOrdersEnabled !== false}
        />
      ) : null}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-[#E6ECF7] bg-white px-4 py-4">
      <p className="text-xs font-semibold text-[#667085]">{label}</p>
      <p className="mt-2 font-display text-2xl font-bold text-[#1B1464]">{value}</p>
    </div>
  );
}

function PaymentDialog({
  deal,
  businessViewer,
  creatorName,
  contractId,
  closeHref,
  heldCents,
  releasedCents,
  changeOrdersEnabled,
}: {
  deal: Deal;
  businessViewer: boolean;
  creatorName: string;
  contractId: string | null;
  closeHref: string;
  heldCents: number;
  releasedCents: number;
  changeOrdersEnabled: boolean;
}) {
  const pill = statusPill(deal.status);
  const money = memberDealView({
    role: businessViewer ? "business" : "influencer",
    grossCents: deal.grossCents,
    feeCents: deal.feeCents,
    plan: deal.feeSnapshotJson,
  });
  const signedDeal = readSignedDealMoney((deal.feeSnapshotJson as { financialPlan?: unknown } | null)?.financialPlan);
  const checkout = collectionCheckoutFields(deal.collectionProviderCode || deal.providerCode);
  const stripe = (deal.collectionProviderCode || deal.providerCode).trim().toLowerCase() === "stripe";
  const canDeposit = businessViewer && deal.status === "awaiting_provider" && (checkout.canOpen || stripe);
  const viewerRole = businessViewer ? "business" : "influencer";
  const entries = ledgerEntries(deal, viewerRole);
  const pending = deal.milestones.some((milestone) => milestonePayoutLabel(milestone.status) === "Pending confirmation");
  const provider = deal.providerCode.trim();
  const next = canDeposit
    ? "Deposit the signed amount. Nothing is held until the provider confirms the payment."
    : deal.status === "awaiting_provider"
      ? "The deposit is not confirmed yet."
      : heldCents > 0 && pending
        ? "Track the pending payout in Transactions."
        : releasedCents > 0 && heldCents === 0
          ? "Confirmed payouts are listed in Transactions."
          : "Review submissions in the collaboration workspace.";

  return (
    <PaymentDetailsDialog
      closeHref={closeHref}
      title={deal.title}
      company={`${deal.businessName} · ${creatorName}`}
      status={pill.text}
      statusClass={pill.className}
      workspaceHref={`/collaboration/work/${deal.id}`}
      overview={
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-[#E6ECF7] p-4">
              <p className="text-sm font-semibold text-[#1B1464]">Signed amounts</p>
              <dl className="mt-3 space-y-2 text-sm">
                {money.lines.map((line) => (
                  <div key={line.label} className="flex items-center justify-between gap-3">
                    <dt className="text-[#667085]">{line.label === "You pay" ? "Total paid" : line.label}</dt>
                    <dd className={`font-semibold ${line.label === "You pay" ? "text-[#6D4AFF]" : "text-[#1B1464]"}`}>
                      {moneyLabel(line.amountCents, deal.currency)}
                    </dd>
                  </div>
                ))}
              </dl>
              {signedDeal ? <p className="mt-3 text-xs text-[#667085]">Signed amounts stay locked.</p> : null}
            </div>
            <div className="rounded-2xl border border-[#E6ECF7] p-4">
              <p className="text-sm font-semibold text-[#1B1464]">Funds status</p>
              <dl className="mt-3 space-y-2 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-[#667085]">{businessViewer ? "Held by provider" : "Held for you"}</dt>
                  <dd className="font-semibold text-[#1B1464]">{moneyLabel(heldCents, deal.currency)}</dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-[#667085]">Paid out</dt>
                  <dd className="font-semibold text-[#1B1464]">{moneyLabel(releasedCents, deal.currency)}</dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-[#667085]">Provider</dt>
                  <dd className="font-semibold text-[#1B1464]">{provider ? provider[0].toUpperCase() + provider.slice(1) : "Not recorded"}</dd>
                </div>
              </dl>
            </div>
          </div>
          {heldCents > 0 && pending ? (
            <p className="rounded-2xl bg-[#F4F7FF] px-4 py-3 text-sm text-[#344054]">
              Funds received. Payout confirmation is pending for approved work.
            </p>
          ) : null}
          <div>
            <p className="text-sm font-semibold text-[#1B1464]">Next step</p>
            <p className="mt-1 text-sm text-[#667085]">{next}</p>
          </div>
          <div className="flex flex-wrap gap-4 text-sm font-semibold text-[#6D4AFF]">
            {contractId ? (
              <Link href={`/collaboration/contracts/${contractId}`} className="hover:underline">
                View signed contract
              </Link>
            ) : null}
            <Link href={`/collaboration/work/${deal.id}`} className="hover:underline">
              Open collaboration
            </Link>
          </div>
          {canDeposit ? (
            <div className="space-y-3">
              {checkout.canOpen ? (
                <form action={actionOpenFundingCheckout} className="flex flex-wrap items-end gap-2">
                  <input type="hidden" name="dealId" value={deal.id} />
                  {checkout.email ? (
                    <label className="text-xs font-semibold text-[#667085]">
                      Payer email
                      <input name="email" type="email" required className="mt-1 w-48 rounded-lg border border-[#E6ECF7] px-2 py-1 text-sm" />
                    </label>
                  ) : null}
                  {checkout.phone ? (
                    <label className="text-xs font-semibold text-[#667085]">
                      M-Pesa phone
                      <input name="phone" required className="mt-1 w-40 rounded-lg border border-[#E6ECF7] px-2 py-1 text-sm" />
                    </label>
                  ) : null}
                  <button type="submit" className="rounded-full bg-[#6D4AFF] px-4 py-2 text-sm font-semibold text-white">
                    Deposit funds
                  </button>
                </form>
              ) : null}
              {stripe ? (
                <Link href={`/payments/checkout/${deal.id}`} className="inline-flex rounded-full bg-[#6D4AFF] px-4 py-2 text-sm font-semibold text-white">
                  Deposit funds
                </Link>
              ) : null}
              {checkout.note ? <p className="text-xs text-[#667085]">{checkout.note}</p> : null}
            </div>
          ) : null}
          {businessViewer && deal.status === "awaiting_provider" && !signedDeal ? (
            <details className="rounded-xl border border-[#E6ECF7] px-3 py-2">
              <summary className="cursor-pointer text-xs font-semibold text-[#1B1464]">
                Change order
                {deal.changeOrderCount > 0 ? ` · ${deal.changeOrderCount} of ${deal.changeOrderLimit}` : ""}
              </summary>
              <div className="mt-3 space-y-3">
                <p className="text-xs text-[#667085]">
                  Change orders {deal.changeOrderCount} of {deal.changeOrderLimit}.
                  {changeOrdersEnabled ? "" : " Change orders are turned off."} A change order can amend this prefund only
                  before the provider confirms the hold.
                </p>
                {deal.changeOrders.map((order) => (
                  <p key={order.id} className="text-xs text-[#1B1464]">
                    {order.note}
                  </p>
                ))}
                {changeOrdersEnabled && deal.changeOrderCount < deal.changeOrderLimit ? (
                  <form action={actionRequestChangeOrder} className="flex flex-wrap items-end gap-2">
                    <input type="hidden" name="dealId" value={deal.id} />
                    <label className="text-xs font-semibold text-[#667085]">
                      New gross USD
                      <input name="grossUsd" type="number" min={1} step={1} required className="mt-1 w-32 rounded-lg border border-[#E6ECF7] px-2 py-1 text-sm" />
                    </label>
                    <label className="text-xs font-semibold text-[#667085]">
                      What changed
                      <input name="note" required minLength={8} placeholder="What the amendment covers" className="mt-1 w-64 rounded-lg border border-[#E6ECF7] px-2 py-1 text-sm" />
                    </label>
                    <button type="submit" className="rounded-full border border-[#E6ECF7] px-3 py-1.5 text-xs font-semibold text-[#1B1464]">
                      Record change order
                    </button>
                  </form>
                ) : null}
              </div>
            </details>
          ) : null}
          {businessViewer && deal.status === "awaiting_provider" ? (
            <form action={actionCancelPrefund}>
              <input type="hidden" name="dealId" value={deal.id} />
              <button type="submit" className="text-xs font-semibold text-[#667085] underline">
                Cancel prefund
              </button>
            </form>
          ) : null}
          {businessViewer && deal.scheduleKind === "recurring" && deal.scheduleId && !deal.seriesStopped ? (
            <form action={actionStopSeries}>
              <input type="hidden" name="scheduleId" value={deal.scheduleId} />
              <button type="submit" className="text-xs font-semibold text-[#667085] underline">
                Stop future tranches
              </button>
            </form>
          ) : null}
        </div>
      }
      milestones={
        <div className="space-y-3">
          <p className="text-sm text-[#667085]">Delivery status and payout status stay visible. Open a milestone for the submission.</p>
          {deal.milestones.map((milestone) => {
            const delivery = milestoneDeliveryLabel(milestone.status);
            const payout = milestonePayoutLabel(milestone.status);
            return (
              <details key={milestone.id} className="group rounded-2xl border border-[#E6ECF7]">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 [&::-webkit-details-marker]:hidden">
                  <span className="font-semibold text-[#1B1464]">{milestone.title}</span>
                  <span className="flex flex-wrap items-center justify-end gap-2">
                    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${deliveryClass(delivery)}`}>{delivery}</span>
                    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${payoutClass(payout)}`}>{payout}</span>
                    <span aria-hidden className="text-xs text-[#98A2B3] transition group-open:rotate-180">▾</span>
                  </span>
                </summary>
                <div className="space-y-3 border-t border-[#E6ECF7] px-4 py-3">
                  <p className="text-sm text-[#667085]">
                    {moneyLabel(milestone.amountCents, deal.currency)}. Review submissions and comments in the collaboration workspace.
                  </p>
                  {!businessViewer && deal.status === "held" && milestone.status === "pending" ? (
                    <form action={actionSubmitMilestone} className="space-y-2">
                      <input type="hidden" name="dealId" value={deal.id} />
                      <input type="hidden" name="milestoneId" value={milestone.id} />
                      <input name="linkUrl" placeholder="https:// link to the work" className="w-full rounded-lg border border-[#E6ECF7] px-2 py-1 text-xs" />
                      <input name="note" placeholder="What you are submitting" className="w-full rounded-lg border border-[#E6ECF7] px-2 py-1 text-xs" />
                      <input name="files" type="file" multiple accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt,.csv,.jpg,.jpeg,.png,.webp,.gif,.mp4,.webm,.mov,.mp3,.wav,.m4a,.zip" className="w-full text-xs" />
                      <button type="submit" className="rounded-full border border-[#E6ECF7] px-3 py-1.5 text-xs font-semibold text-[#1B1464]">
                        Submit work
                      </button>
                    </form>
                  ) : null}
                </div>
              </details>
            );
          })}
        </div>
      }
      transactions={
        entries.length === 0 ? (
          <p className="text-sm text-[#667085]">No confirmed transactions yet.</p>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-[#E6ECF7]">
            <table className="w-full min-w-[520px] text-left text-sm">
              <thead className="bg-[#F7F8FF] text-xs text-[#667085]">
                <tr>
                  <th className="px-3 py-2 font-semibold">When</th>
                  <th className="px-3 py-2 font-semibold">Record</th>
                  <th className="px-3 py-2 font-semibold">Amount</th>
                  <th className="px-3 py-2 font-semibold">Provider</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry) => (
                  <tr key={entry.id ?? `${entry.kind}-${entry.eventId ?? entry.amountCents}`} className="border-t border-[#F2F4F7]">
                    <td className="px-3 py-3 text-[#667085]">{when(entry.createdAt)}</td>
                    <td className="px-3 py-3 font-semibold text-[#1B1464]">{ledgerLabel(viewerRole, entry.kind)}</td>
                    <td className="px-3 py-3">{moneyLabel(entry.amountCents, deal.currency)}</td>
                    <td className="px-3 py-3 text-[#667085]">{entry.provider?.trim() || provider || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      }
    />
  );
}
