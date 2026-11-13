import { exceptionCopy, formatMinor, type PaymentStatusLabel } from "@/lib/payment-standard-v4";

const TONE: Record<PaymentStatusLabel, string> = {
  "Needs funding": "bg-amber-50 text-amber-900",
  "Checking payment status": "bg-amber-50 text-amber-900",
  "Funding confirmation pending": "bg-amber-50 text-amber-900",
  Funded: "bg-emerald-50 text-emerald-800",
  "Payout processing": "bg-amber-50 text-amber-900",
  "Payout confirmed": "bg-emerald-50 text-emerald-800",
  "Payout returned": "bg-rose-50 text-rose-800",
  "Refund processing": "bg-amber-50 text-amber-900",
  Refunded: "bg-emerald-50 text-emerald-800",
  "Needs attention": "bg-rose-50 text-rose-800",
};

export function PaymentStatus({ label }: { label: PaymentStatusLabel }) {
  const icon = label === "Payout returned" || label === "Needs attention" ? "!" : label === "Payout confirmed" || label === "Funded" || label === "Refunded" ? "✓" : "•";
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${TONE[label]}`}>
      <span aria-hidden>{icon}</span>
      {label}
    </span>
  );
}

export function MoneyAmount({ cents, currency }: { cents: number; currency: string }) {
  return <span className="tabular-nums">{formatMinor(cents, currency)}</span>;
}

export function EmptyPayments({ filtered }: { filtered: boolean }) {
  return (
    <div data-screen="E01" className="rounded-2xl border border-dashed border-[#d9d3f5] bg-white px-4 py-10 text-center">
      <p className="font-display text-xl font-bold text-indigo">{filtered ? "No matches" : "No collaboration payments yet."}</p>
      <a href={filtered ? "/payments" : "/collaboration/contracts"} className="mt-3 inline-flex h-11 items-center font-semibold text-violet">
        {filtered ? "Clear filters" : "Open contracts"}
      </a>
    </div>
  );
}

export function BlockedNote({ kind }: { kind: Parameters<typeof exceptionCopy>[0] }) {
  return (
    <p data-screen="E01" className="rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-950">
      {exceptionCopy(kind)}
    </p>
  );
}
