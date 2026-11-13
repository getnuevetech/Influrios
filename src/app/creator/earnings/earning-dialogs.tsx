import Link from "next/link";
import { AccountDialog } from "@/components/account-dialog";
import { MoneyAmount, PaymentStatus } from "@/components/payment-journey/status";
import type { PaymentStatusLabel } from "@/lib/payment-standard-v4";

export function PayoutDetailDialog({
  row,
  destination,
  currency,
  stages,
  note,
}: {
  row: { id: string; title: string; milestone: string; netCents: number | null; status: PaymentStatusLabel };
  destination: string;
  currency: string | null;
  stages: { id: string; label: string; status: string; detail: string }[];
  note: string | null;
}) {
  return (
    <AccountDialog title={row.milestone || row.title} subtitle="Payout detail" closeHref="/creator/earnings">
      <div className="space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="font-display text-2xl font-bold text-indigo">
              {currency && row.netCents != null ? <MoneyAmount cents={row.netCents} currency={currency} /> : "—"}
            </p>
            <p className="text-sm text-muted">Paid to {destination}</p>
          </div>
          <PaymentStatus label={row.status} />
        </div>
        {note ? <p className="rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-950">{note}</p> : null}
        <ol className="space-y-2 text-sm">
          {stages.filter((stage) => stage.id !== "funding").map((stage) => (
            <li key={stage.id} className="rounded-2xl border border-border px-3 py-2">
              <span className="font-semibold text-indigo">{stage.label}</span>
              <span className="mt-1 block text-muted">{stage.status}. {stage.detail}</span>
            </li>
          ))}
        </ol>
        {row.status === "Payout returned" ? (
          <p className="text-sm text-amber-950">Update your bank details. We will confirm the next attempt. This return does not refund the business.</p>
        ) : null}
      </div>
    </AccountDialog>
  );
}

export function AgreementReviewDialog({
  title,
  company,
  signHref,
  lines,
  milestones,
  currency,
}: {
  title: string;
  company: string;
  signHref: string;
  lines: { label: string; amountCents: number }[];
  milestones: { title: string; shareLabel: string }[];
  currency: string | null;
}) {
  return (
    <AccountDialog title="Review agreement" subtitle={company ? `${title} with ${company}` : title} closeHref="/creator/earnings">
      <div className="space-y-4">
        <p className="inline-flex rounded-full bg-[#F4F0FF] px-3 py-1 text-xs font-semibold text-violet">Awaiting your signature</p>
        {lines.length && currency ? (
          <dl className="space-y-2 text-sm">
            {lines.map((line) => (
              <div key={line.label} className="flex justify-between gap-3">
                <dt>{line.label}</dt>
                <dd className="font-semibold"><MoneyAmount cents={line.amountCents} currency={currency} /></dd>
              </div>
            ))}
          </dl>
        ) : (
          <p className="text-sm text-muted">The signed amounts stay on the agreement. This screen does not invent them.</p>
        )}
        {milestones.length ? (
          <ul className="space-y-1 text-sm">
            {milestones.map((milestone) => (
              <li key={milestone.title}>{milestone.title} · {milestone.shareLabel}</li>
            ))}
          </ul>
        ) : null}
        <p className="text-sm text-muted">You are not charged the business fee.</p>
        <Link href={signHref} className="inline-flex h-11 items-center rounded-full bg-violet px-4 text-sm font-semibold text-white">
          Review and sign
        </Link>
      </div>
    </AccountDialog>
  );
}
