import Link from "next/link";
import { MoneyAmount, PaymentStatus } from "@/components/payment-journey/status";
import { UnavailableNote } from "@/components/unavailable-note";
import type { PaymentStatusLabel } from "@/lib/payment-standard-v4";

export function EarningsPanel({
  currency,
  upcomingCents,
  processingCents,
  paidCents,
  returnedCents,
  destination,
  rows,
  selected,
  processingLabel = "Processing",
  unavailable,
  unknown,
}: {
  currency: string | null;
  upcomingCents: number;
  processingCents: number;
  paidCents: number;
  returnedCents: number;
  destination: string;
  rows: { id: string; title: string; milestone: string; netCents: number | null; status: PaymentStatusLabel }[];
  selected?: string;
  processingLabel?: string;
  unavailable?: { incident: string } | null;
  unknown?: boolean;
}) {
  const code = currency ?? "";
  return (
    <section data-screen="I02" data-mobile="M02" className="mb-8 space-y-4">
      <div>
        <h1 className="font-display text-3xl font-bold text-indigo">Earnings and payouts</h1>
        <p className="mt-1 text-sm text-muted">Upcoming net is not a withdrawable balance. Paid means the bank payout was confirmed.</p>
      </div>
      {unavailable ? (
        <UnavailableNote label="Earnings" incident={unavailable.incident} href="/creator/earnings" />
      ) : null}
      {unknown ? (
        <p className="text-sm text-amber-900">A payout result is unknown. Those amounts are left out. This is not zero.</p>
      ) : null}
      {unavailable ? null : !code ? <p className="text-sm">Totals stay split by currency. This account has more than one currency, so they are not added together.</p> : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[
            ["Upcoming net", upcomingCents],
            [processingLabel, processingCents],
            ["Paid", paidCents],
            ["Returned / needs attention", returnedCents],
          ].map(([label, amount]) => (
            <div key={String(label)} className="rounded-2xl border border-border bg-white p-4">
              <p className="text-xs text-muted">{label}</p>
              <p className="mt-1 font-display text-xl font-bold"><MoneyAmount cents={Number(amount)} currency={code} /></p>
            </div>
          ))}
        </div>
      )}
      {returnedCents > 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          <p>Payout returned — update your bank details. We will confirm the next attempt.</p>
          <Link href="/creator/earnings#payouts" className="rounded-full bg-[#6D4AFF] px-4 py-2 text-sm font-semibold text-white">
            Review payout
          </Link>
        </div>
      ) : null}
      <p className="text-sm">Payout destination {destination}. Updating it does not retry a payout by itself.</p>
      <div className="space-y-2">
        {unavailable ? null : rows.length === 0 ? <p className="text-sm text-muted">No earnings yet.</p> : rows.map((row) => (
          <article key={row.id} className="rounded-2xl border border-border bg-white p-4 text-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-semibold text-indigo">{row.title}</p>
              <PaymentStatus label={row.status} />
            </div>
            <p>{row.milestone}</p>
            {code && row.netCents != null ? <p>Expected net <MoneyAmount cents={row.netCents} currency={code} /></p> : <p className="text-xs text-muted">Expected net stays on the signed agreement.</p>}
            <Link href={`/creator/earnings?payout=${row.id}`} className="font-semibold text-violet">View payout</Link>
          </article>
        ))}
      </div>
      {selected ? (
        <div className="rounded-2xl border border-border bg-white p-4 text-sm">
          <h2 className="font-display text-xl font-bold">Payout detail</h2>
          <ol className="mt-3 space-y-2">
            <li>Approval is recorded on the collaboration.</li>
            <li>Transfer and bank payout are separate.</li>
            <li>A returned payout keeps the net owed. The fee is not charged again.</li>
          </ol>
          <p className="mt-3 text-xs text-muted">Statement lines use the frozen gross and deductions. Bank amount alone is not the statement.</p>
        </div>
      ) : null}
    </section>
  );
}
