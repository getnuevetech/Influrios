import Link from "next/link";
import { MoneyAmount, PaymentStatus } from "@/components/payment-journey/status";
import { UnavailableNote } from "@/components/unavailable-note";
import { AgreementReviewDialog, PayoutDetailDialog } from "@/app/creator/earnings/earning-dialogs";
import { paymentStageNote, paymentStages } from "@/lib/payment-stages";
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
  agreement,
  agreementOpen,
}: {
  currency: string | null;
  upcomingCents: number;
  processingCents: number;
  paidCents: number;
  returnedCents: number;
  destination: string;
  rows: { id: string; title: string; milestone: string; netCents: number | null; status: PaymentStatusLabel; milestoneStatus?: string }[];
  selected?: string;
  processingLabel?: string;
  unavailable?: { incident: string } | null;
  unknown?: boolean;
  agreement?: {
    id: string;
    title: string;
    company: string;
    signHref: string;
    lines: { label: string; amountCents: number }[];
    milestones: { title: string; shareLabel: string }[];
    currency: string | null;
  } | null;
  agreementOpen?: boolean;
}) {
  const code = currency ?? "";
  const selectedRow = rows.find((row) => row.id === selected) ?? null;
  const payoutStages = selectedRow
    ? paymentStages({
        fundingStatus: "recorded",
        milestoneStatuses: [selectedRow.milestoneStatus || "pending"],
        entryKinds: [],
      })
    : [];
  const payoutNote = selectedRow ? paymentStageNote(payoutStages) : null;
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
          <p>Payout returned — update your bank details. We will confirm the next attempt. This does not refund the business.</p>
          <Link href={`/creator/earnings?payout=${rows.find((row) => row.status === "Payout returned")?.id ?? ""}`} className="rounded-full bg-[#6D4AFF] px-4 py-2 text-sm font-semibold text-white">
            Review payout
          </Link>
        </div>
      ) : null}
      {agreement ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-white px-4 py-3 text-sm">
          <p>Agreement awaiting your signature: {agreement.title}</p>
          <Link href={`/creator/earnings?agreement=${agreement.id}`} className="font-semibold text-violet">Review agreement</Link>
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
      {selectedRow ? (
        <PayoutDetailDialog
          row={selectedRow}
          destination={destination}
          currency={code || null}
          stages={payoutStages}
          note={payoutNote}
        />
      ) : null}
      {agreementOpen && agreement ? (
        <AgreementReviewDialog
          title={agreement.title}
          company={agreement.company}
          signHref={agreement.signHref}
          lines={agreement.lines}
          milestones={agreement.milestones}
          currency={agreement.currency}
        />
      ) : null}
    </section>
  );
}
