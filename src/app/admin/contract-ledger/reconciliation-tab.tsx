import type { ContractLedgerRow } from "@/lib/contract-ledger";
import { prisma } from "@/lib/db";
import { loadStripeSnapshot, reconcile } from "@/lib/reconciliation";
import {
  IconBank,
  IconCalculator,
  IconCard,
  IconCheckCircle,
  IconCoins,
  IconInfo,
  IconTransfer,
} from "./ledger-icons";

const amount = (cents: number, currency: string) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency, minimumFractionDigits: 2 }).format(cents / 100);
const whole = (cents: number, currency: string) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 0 }).format(cents / 100);

export async function ReconciliationTab({ currency, rows }: { currency: string; rows: ContractLedgerRow[] }) {
  const [snapshot, unmatched] = await Promise.all([
    loadStripeSnapshot(currency),
    prisma.fundingDeposit
      .count({ where: { status: "confirmed", currency, funding: { entries: { none: { kind: "hold" } } } } })
      .catch(() => 0),
  ]);
  const result = reconcile(rows, snapshot, unmatched);
  const c = currency;
  const reconciled = result.unexplainedCents === 0 && result.lines.every((line) => line.matched !== false);
  const card = (icon: React.ReactNode, label: string, value: string, wide = false) => (
    <div className={`flex items-center gap-5 rounded-xl border border-[#E4E6F0] bg-white px-6 py-3.5 ${wide ? "" : ""}`}>
      <span className="text-[#6D4AFF]">{icon}</span>
      <div>
        <p className="text-[14px] text-[#1B1464]">{label}</p>
        <p className="font-display text-[22px] font-bold leading-tight">{value}</p>
      </div>
    </div>
  );
  const dash = "—";

  return (
    <div className="mt-4 space-y-3">
      {!snapshot.ok ? (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900">{snapshot.error}</p>
      ) : null}

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {card(<IconCard />, "Gateway balance", result.gatewayCents == null ? dash : whole(result.gatewayCents, c))}
        {card(<IconBank />, "Platform bank", result.bankCents == null ? dash : whole(result.bankCents, c))}
        {card(<IconCoins />, "Combined cash", result.combinedCents == null ? dash : whole(result.combinedCents, c))}
        {card(
          <IconCheckCircle className={reconciled ? "text-[#1F9D55]" : "text-[#C4320A]"} />,
          "Unexplained difference",
          result.unexplainedCents == null ? dash : whole(result.unexplainedCents, c),
        )}
      </div>

      <p className={`flex items-center gap-2 text-[14px] font-medium ${reconciled ? "text-[#146C3A]" : "text-[#9A4B07]"}`}>
        <span className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-white ${reconciled ? "bg-[#1F9D55]" : "bg-[#C4320A]"}`}>
          {reconciled ? "✓" : "!"}
        </span>
        {snapshot.ok ? `Stripe ${c} account · ${reconciled ? "Reconciled" : "Not reconciled"}` : "Provider records unavailable"}
      </p>

      <div className="overflow-x-auto rounded-xl border border-[#E4E6F0] bg-white">
        <table className="w-full min-w-[820px] text-[14px]">
          <thead className="bg-[#F7F7FB] text-left font-semibold">
            <tr>
              <th className="px-5 py-2">Location</th>
              <th className="px-3 py-2 text-right">Ledger balance ({c})</th>
              <th className="px-3 py-2 text-right">Provider or bank balance ({c})</th>
              <th className="px-3 py-2 text-right">Difference ({c})</th>
              <th className="px-8 py-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {result.lines.map((line) => (
              <tr key={line.location} className="border-t border-[#EEEFF5]">
                <td className="px-5 py-1.5 font-semibold">{line.location}</td>
                <td className="px-3 py-1.5 text-right tabular-nums">{amount(line.ledgerCents, c)}</td>
                <td className="px-3 py-1.5 text-right tabular-nums">{line.providerCents == null ? dash : amount(line.providerCents, c)}</td>
                <td className="px-3 py-1.5 text-right tabular-nums">{line.differenceCents == null ? dash : amount(line.differenceCents, c)}</td>
                <td className="px-8 py-1.5">
                  <span
                    className={`inline-block min-w-[72px] rounded px-2 py-0.5 text-center text-[12px] font-semibold ${
                      line.matched == null ? "bg-[#E6E7EE] text-[#3D4260]" : line.matched ? "bg-[#C9F0D7] text-[#146C3A]" : "bg-[#FDE2DD] text-[#B42318]"
                    }`}
                  >
                    {line.matched == null ? "Not read" : line.matched ? "Matched" : "Difference"}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {snapshot.ok && snapshot.lastPayout ? (
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg bg-[#F1EFFB] px-5 py-2 text-[13.5px]">
          <IconTransfer className="text-[#6D4AFF]" />
          <span className="font-medium">
            {snapshot.lastPayout.id.slice(-8).toUpperCase()} · Gateway → Platform bank · {amount(snapshot.lastPayout.amountCents, c)} ·{" "}
            {snapshot.lastPayout.status === "paid" ? "Paid to bank" : `Payout ${snapshot.lastPayout.status.replaceAll("_", " ")}`} ·{" "}
            {snapshot.lastPayout.arrivalDate.toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" })}
          </span>
          <span className="ml-auto flex items-center gap-2 text-[12.5px] text-[#3D4260]">
            <IconInfo size={15} /> Bank transfer is internal, not additional income.
          </span>
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-y-2 rounded-xl border border-[#E4E6F0] bg-white px-5 py-3 text-[14.5px]">
        <span className="flex items-center gap-3 pr-6">
          <IconCoins size={22} className="text-[#6D4AFF]" />
          <span>
            <strong>Cash reconciliation:</strong> {whole(result.collectedCents, c)} collected − {whole(result.paidCents, c)} paid −{" "}
            {whole(result.costsCents, c)} costs{result.refundedCents ? ` − ${whole(result.refundedCents, c)} refunded` : ""}
            {result.topupsCents ? ` + ${whole(result.topupsCents, c)} platform top-ups` : ""} ={" "}
            {whole(result.ledgerCashCents, c)}
          </span>
        </span>
        <span className="flex items-center gap-3 border-l border-[#E4E6F0] pl-6">
          <IconCalculator className="text-[#6D4AFF]" />
          <span>
            <strong>Cash ownership:</strong> {whole(result.heldCents + result.awaitingPayoutCents, c)} contract funds +{" "}
            {whole(result.taxPayableCents, c)} tax payable + {whole(result.platformNetCents, c)} platform net
            {result.topupsCents ? ` + ${whole(result.topupsCents, c)} platform top-ups` : ""}
          </span>
        </span>
      </div>

      <p className="flex items-center gap-2 rounded-lg bg-[#F1EFFB] px-5 py-2 text-[13.5px]">
        <IconInfo size={15} />
        <span>
          <strong>Exceptions:</strong> Unmatched transactions {result.exceptions.unmatched} · Duplicates {result.exceptions.duplicates} · Pending
          settlement {result.exceptions.pendingSettlement}
        </span>
      </p>
    </div>
  );
}
