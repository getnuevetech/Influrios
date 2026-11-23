import Link from "next/link";
import { requireAdminPage } from "@/app/admin/guard";
import { loadContractLedger, type ContractLedgerRow, type MovementStatus } from "@/lib/contract-ledger";
import { LedgerFilters } from "./ledger-filters";
import { IconChevronDown, IconChevronRight, IconDownload, IconInfo, IconShield } from "./ledger-icons";
import { ReconciliationButtons, ReconciliationSelectors } from "./reconciliation-controls";
import { ReconciliationTab } from "./reconciliation-tab";

export const dynamic = "force-dynamic";
export const metadata = { title: "Contract ledger · Admin" };

type Props = { searchParams: Promise<{ tab?: string; q?: string; currency?: string; days?: string; open?: string }> };

const amount = (cents: number, currency: string) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency, minimumFractionDigits: 2 }).format(cents / 100);
const whole = (cents: number, currency: string) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 0 }).format(cents / 100);
const signed = (cents: number, currency: string, plus: boolean) =>
  cents < 0 ? `-${amount(-cents, currency)}` : `${plus ? "+" : ""}${amount(cents, currency)}`;
const day = (date: Date) => date.toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });

const STATUS_CHIP: Record<MovementStatus, string> = {
  Settled: "bg-[#C9F0D7] text-[#146C3A]",
  Paid: "bg-[#C9F0D7] text-[#146C3A]",
  Posted: "bg-[#E6E7EE] text-[#3D4260]",
  Reversed: "bg-[#FDE7D3] text-[#9A4B07]",
  Returned: "bg-[#FDE7D3] text-[#9A4B07]",
};

export default async function ContractLedgerPage({ searchParams }: Props) {
  await requireAdminPage("marketplace");
  const params = await searchParams;
  const tab = params.tab === "reconciliation" ? "reconciliation" : "contracts";
  const days = ["7", "30", "90", "365"].includes(params.days ?? "") ? (params.days as string) : "";
  const { rows: all, currencies: found } = await loadContractLedger({ q: params.q, days: Number(days) || 0 });
  const currencies = found.length ? found : ["USD"];
  const currency = currencies.includes((params.currency ?? "").toUpperCase())
    ? (params.currency as string).toUpperCase()
    : currencies.includes("USD")
      ? "USD"
      : currencies[0]!;
  const rows = all.filter((row) => row.currency === currency);
  const open = rows.find((row) => row.id === params.open) ?? rows[0] ?? null;
  const query = (extra: Record<string, string>) => {
    const search = new URLSearchParams({ tab, currency, ...(params.q ? { q: params.q } : {}), ...(days ? { days } : {}), ...extra });
    return `/admin/contract-ledger?${search.toString()}`;
  };
  const exportHref = (id?: string) => {
    const search = new URLSearchParams({ currency, ...(params.q ? { q: params.q } : {}), ...(days ? { days } : {}), ...(id ? { id } : {}) });
    return `/admin/contract-ledger/export?${search.toString()}`;
  };

  return (
    <div className="mx-auto max-w-[1280px] text-[#1B1464]">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="font-display text-[30px] font-bold leading-tight">
              {tab === "contracts" ? "Contract ledger" : "Gateway & bank reconciliation"}
            </h1>
            <span className="inline-flex items-center gap-1.5 rounded-lg bg-[#EEE9FF] px-2.5 py-1 text-[13px] font-semibold text-[#6D4AFF]">
              <IconShield /> Admin-only
            </span>
          </div>
          <p className="mt-1 text-[15px] text-[#3D4260]">
            {tab === "contracts"
              ? "Track every collection, allocation, release and payout by contract."
              : "Compare posted ledger balances with imported provider and bank records."}
          </p>
        </div>
        {tab === "contracts" ? (
          <a
            href={exportHref()}
            className="inline-flex items-center gap-2 rounded-xl border-2 border-[#6D4AFF] bg-white px-5 py-2.5 text-[15px] font-semibold text-[#6D4AFF] hover:bg-[#F6F3FF]"
          >
            <IconDownload /> Download full ledger
          </a>
        ) : (
          <ReconciliationButtons currency={currency} />
        )}
      </div>

      {tab === "contracts" ? (
        <LedgerFilters tab={tab} q={params.q ?? ""} currency={currency} currencies={currencies} days={days} />
      ) : null}

      <div className="mt-4 flex flex-wrap items-end justify-between gap-3 border-b border-[#E4E6F0]">
      <nav className="flex gap-8 text-[15px]" aria-label="Ledger views">
        <Link
          href={query({ tab: "contracts" })}
          aria-current={tab === "contracts" ? "page" : undefined}
          className={tab === "contracts" ? "-mb-px border-b-[3px] border-[#6D4AFF] px-4 pb-2.5 font-semibold text-[#6D4AFF]" : "px-1 pb-2.5 text-[#1B1464]"}
        >
          Contracts
        </Link>
        <Link
          href={query({ tab: "reconciliation" })}
          aria-current={tab === "reconciliation" ? "page" : undefined}
          className={tab === "reconciliation" ? "-mb-px border-b-[3px] border-[#6D4AFF] px-4 pb-2.5 font-semibold text-[#6D4AFF]" : "px-1 pb-2.5 text-[#1B1464]"}
        >
          Gateway &amp; bank reconciliation
        </Link>
      </nav>
        {tab === "reconciliation" ? <ReconciliationSelectors currency={currency} currencies={currencies} readAt={new Date()} /> : null}
      </div>

      {tab === "reconciliation" ? (
        <ReconciliationTab currency={currency} rows={rows} />
      ) : (
        <>
          {open ? <SelectedBar row={open} /> : null}
          <div className="mt-4 overflow-x-auto rounded-2xl border border-[#E4E6F0] bg-white">
            <table className="w-full min-w-[1080px] text-[14px]">
              <thead>
                <tr className="text-left text-[13px] font-semibold text-[#1B1464]">
                  <th className="w-10 py-3 pl-4" />
                  <th className="py-3 pr-3">Contract</th>
                  <th className="py-3 pr-3 text-right">Collected ({currency})</th>
                  <th className="py-3 pr-3 text-right">Collaboration fees ({currency})</th>
                  <th className="py-3 pr-3 text-right">Taxes ({currency})</th>
                  <th className="py-3 pr-3 text-right">Platform retained ({currency})</th>
                  <th className="py-3 pr-3 text-right">Processing costs ({currency})</th>
                  <th className="py-3 pr-3 text-right">Net earnings ({currency})</th>
                  <th className="py-3 pr-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const isOpen = open?.id === row.id;
                  const bold = isOpen ? "font-bold" : "";
                  return (
                    <ContractRows key={row.id} row={row} isOpen={isOpen}>
                      <tr className={`border-t border-[#E4E6F0] ${isOpen ? "bg-[#F4F2FF]" : ""}`}>
                        <td className="py-3 pl-4">
                          <Link href={query({ open: row.id })} aria-label={`Open ${row.code}`} aria-expanded={isOpen} className="text-[#1B1464]">
                            {isOpen ? <IconChevronDown /> : <IconChevronRight />}
                          </Link>
                        </td>
                        <td className="py-3 pr-3 font-semibold">
                          <Link href={query({ open: row.id })}>
                            {row.code} · {row.title}
                          </Link>
                        </td>
                        <td className={`py-3 pr-3 text-right tabular-nums ${bold}`}>{amount(row.collectedCents, currency)}</td>
                        <td className={`py-3 pr-3 text-right tabular-nums ${bold}`}>{amount(row.collaborationFeesCents, currency)}</td>
                        <td className={`py-3 pr-3 text-right tabular-nums ${bold}`}>{amount(row.taxesCents, currency)}</td>
                        <td className={`py-3 pr-3 text-right tabular-nums ${bold}`}>{amount(row.platformRetainedCents, currency)}</td>
                        <td className={`py-3 pr-3 text-right tabular-nums ${bold}`}>{amount(row.processingCostsCents, currency)}</td>
                        <td className={`py-3 pr-3 text-right tabular-nums ${bold}`}>{amount(row.netEarningsCents, currency)}</td>
                        <td className="py-3 pr-4 text-right">
                          <a
                            href={exportHref(row.id)}
                            aria-label={`Download ${row.code} ledger`}
                            className="inline-flex h-7 w-8 items-center justify-center rounded-md border border-[#6D4AFF] text-[#6D4AFF] hover:bg-[#F6F3FF]"
                          >
                            <IconDownload size={15} />
                          </a>
                        </td>
                      </tr>
                    </ContractRows>
                  );
                })}
                {rows.length === 0 ? (
                  <tr className="border-t border-[#E4E6F0]">
                    <td colSpan={9} className="px-4 py-8 text-center text-[#4B5070]">
                      No contract has collected money in {currency}
                      {params.q || days ? " for these filters" : " yet"}.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

function SelectedBar({ row }: { row: ContractLedgerRow }) {
  const c = row.currency;
  const stat = (label: string, cents: number) => (
    <div className="min-w-[130px] border-l border-[#E4E6F0] px-5">
      <p className="text-[13px] text-[#3D4260]">{label}</p>
      <p className="font-display text-[22px] font-bold leading-tight">{whole(cents, c)}</p>
    </div>
  );
  return (
    <section className="mt-4 flex flex-wrap items-center gap-y-3 rounded-2xl border border-[#E4E6F0] bg-white py-3 pr-4">
      <div className="mr-auto flex items-center gap-3 border-l-4 border-[#6D4AFF] py-2 pl-5 pr-6">
        <p className="text-[17px] font-semibold">
          Selected contract · <span className="font-bold">{row.code}</span>
        </p>
      </div>
      {stat("Collected", row.collectedCents)}
      {stat("Platform retained", row.platformRetainedCents)}
      {stat("Processing costs", row.processingCostsCents)}
      {stat("Net platform earnings", row.netEarningsCents)}
      <p className="max-w-[220px] border-l border-[#E4E6F0] pl-5 text-[12px] text-[#3D4260]">
        Net earnings after recorded transaction costs; excludes operating overhead.
      </p>
    </section>
  );
}

function ContractRows({ row, isOpen, children }: { row: ContractLedgerRow; isOpen: boolean; children: React.ReactNode }) {
  if (!isOpen) return <>{children}</>;
  const c = row.currency;
  const unearned = Math.max(0, row.collaborationFeesCents - row.platformRetainedCents);
  const stat = (label: string, cents: number) => (
    <div className="border-l border-[#E4E6F0] px-5">
      <p className="whitespace-nowrap text-[13px] text-[#3D4260]">{label}</p>
      <p className="text-[17px] font-bold">{amount(cents, c).replace(/\.00$/, "")}</p>
    </div>
  );
  return (
    <>
      {children}
      <tr className="bg-[#F4F2FF]">
        <td colSpan={9} className="px-3 pb-3">
          <div className="rounded-xl border border-[#E4E6F0] bg-white px-4 py-3">
            <div className="flex flex-wrap items-center justify-between gap-y-3">
              <div className="flex min-w-0 flex-wrap items-center gap-x-6 gap-y-2">
                <p className="text-[17px] font-bold">
                  {row.businessName} → {row.influencerName}
                </p>
                <a
                  href={`/admin/contract-ledger/export?currency=${encodeURIComponent(c)}&id=${encodeURIComponent(row.id)}`}
                  className="inline-flex items-center gap-2 whitespace-nowrap rounded-lg border border-[#6D4AFF] px-3.5 py-1.5 text-[14px] font-semibold text-[#6D4AFF] hover:bg-[#F6F3FF]"
                >
                  <IconDownload size={16} /> Download contract ledger
                </a>
              </div>
              <div className="flex flex-wrap gap-y-2">
                {stat("Held for milestones", row.heldCents)}
                {stat("Released, awaiting payout", row.releasedAwaitingPayoutCents)}
                {stat("Paid to influencer", row.paidToInfluencerCents)}
                {stat("Tax payable", row.taxesCents)}
              </div>
            </div>
            <p className="mt-3 flex items-start gap-2 rounded-lg bg-[#F1EFFB] px-3 py-2 text-[12.5px] text-[#3D4260]">
              <IconInfo size={15} className="mt-px shrink-0" />
              <span>
                Collaboration fees: {whole(row.businessFeeCents, c)} business + {whole(row.influencerFeeCents, c)} influencer. Retained to date:{" "}
                {whole(row.retainedBusinessFeeCents, c)} business + {whole(row.retainedInfluencerFeeCents, c)} released influencer fee.{" "}
                {whole(unearned, c)} remains unearned.
              </span>
            </p>
            <p className="mt-3 inline-block border-b-[3px] border-[#6D4AFF] px-3 pb-1.5 text-[14px] font-semibold text-[#6D4AFF]">Money movements</p>
            <div className="overflow-x-auto rounded-lg border border-[#E4E6F0]">
              <table className="w-full min-w-[960px] text-[13px]">
                <thead className="bg-[#F7F7FB] text-left font-semibold">
                  <tr>
                    <th className="px-4 py-2">Date</th>
                    <th className="px-3 py-2">Movement</th>
                    <th className="px-3 py-2">From → To</th>
                    <th className="px-3 py-2 text-right">Amount ({c})</th>
                    <th className="px-6 py-2">Status</th>
                    <th className="px-3 py-2">Reference</th>
                  </tr>
                </thead>
                <tbody>
                  {row.movements.map((move) => (
                    <tr key={move.id} className="border-t border-[#EEEFF5]">
                      <td className="px-4 py-1.5">{day(move.date)}</td>
                      <td className="px-3 py-1.5">{move.movement}</td>
                      <td className="px-3 py-1.5">
                        {move.from} <span aria-hidden>→</span> {move.to}
                      </td>
                      <td className="px-3 py-1.5 text-right font-semibold tabular-nums">
                        {signed(move.amountCents, c, move.movement === "Collection")}
                      </td>
                      <td className="px-6 py-1.5">
                        <span className={`inline-block min-w-[64px] rounded px-2 py-0.5 text-center text-[11px] font-semibold ${STATUS_CHIP[move.status]}`}>
                          {move.status}
                        </span>
                      </td>
                      <td className="px-3 py-1.5">{move.reference}</td>
                    </tr>
                  ))}
                  {row.movements.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-4 text-[#4B5070]">
                        No money movements posted yet.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
            <p className="mt-2 flex items-center gap-2 text-[12px] text-[#3D4260]">
              <IconInfo size={14} /> Internal allocations do not create additional cash.
            </p>
          </div>
        </td>
      </tr>
    </>
  );
}
