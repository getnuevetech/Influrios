import Link from "next/link";
import { actionOpenConnect, actionOpenConnectedAccount } from "@/app/billing/actions";
import type { ReceivePaymentsAction, ReceivePaymentsView } from "@/lib/receive-payments-checklist";

function PrimaryAction({ action }: { action: ReceivePaymentsAction }) {
  if (action.kind === "link") {
    return (
      <Link href={action.href} className="btn-primary !py-2 text-sm">
        {action.label}
      </Link>
    );
  }
  if (action.kind === "stripe") {
    return (
      <form action={actionOpenConnect}>
        <button type="submit" className="btn-primary !py-2 text-sm">
          {action.label}
        </button>
      </form>
    );
  }
  return (
    <form action={actionOpenConnectedAccount}>
      <button type="submit" className="btn-primary !py-2 text-sm">
        {action.label}
      </button>
    </form>
  );
}

function SecondaryAction({ action }: { action: ReceivePaymentsAction }) {
  if (action.kind === "link") {
    return (
      <Link href={action.href} className="text-sm font-semibold text-violet hover:underline">
        {action.label}
      </Link>
    );
  }
  if (action.kind === "stripe") {
    return (
      <form action={actionOpenConnect}>
        <button type="submit" className="text-sm font-semibold text-violet hover:underline">
          {action.label}
        </button>
      </form>
    );
  }
  return (
    <form action={actionOpenConnectedAccount}>
      <button type="submit" className="text-sm font-semibold text-violet hover:underline">
        {action.label}
      </button>
    </form>
  );
}

export function CreatorPayoutMethodsPanel({
  view,
  error,
  notice,
}: {
  view: ReceivePaymentsView;
  error?: string;
  notice?: string;
}) {
  const tone =
    view.status === "ready"
      ? "border-emerald-200 bg-emerald-50 text-emerald-900"
      : view.status === "unavailable"
        ? "border-amber-200 bg-amber-50 text-amber-950"
        : "border-[#E6ECF7] bg-[#F7F9FD] text-indigo";

  return (
    <section id="payouts" className="space-y-4 rounded-3xl border border-[#E6ECF7] bg-white p-5 shadow-sm">
      <div>
        <h2 className="font-display text-base font-bold">Receive payments</h2>
        <p className="mt-1 text-sm text-muted">
          Collaboration milestone releases are separate from your Influrios plan subscription.
        </p>
      </div>

      {error ? (
        <p className="rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-900" role="alert">
          {error}
        </p>
      ) : null}
      {notice ? (
        <p className="rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">{notice}</p>
      ) : null}

      <div className={`rounded-2xl border px-3 py-2.5 ${tone}`}>
        <p className="text-[11px] font-semibold uppercase tracking-wide opacity-70">Status</p>
        <p className="mt-0.5 text-sm font-bold">{view.statusLabel}</p>
        <p className="mt-1 text-sm opacity-90">{view.summary}</p>
      </div>

      <ul className="space-y-3">
        {view.steps.map((step) => (
          <li key={step.id} className="flex items-start gap-3 rounded-2xl border border-[#F0F3FA] px-3 py-3">
            <span
              className={`mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${
                step.done
                  ? "bg-emerald-100 text-emerald-800"
                  : step.pending
                    ? "bg-amber-100 text-amber-900"
                    : "bg-[#EEF1F8] text-[#6B7289]"
              }`}
              aria-hidden
            >
              {step.done ? "✓" : step.pending ? "…" : "·"}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">{step.label}</p>
              <p className="mt-0.5 text-sm text-muted">{step.detail}</p>
              {step.done && step.action ? (
                <div className="mt-2">
                  <SecondaryAction action={step.action} />
                </div>
              ) : null}
            </div>
          </li>
        ))}
      </ul>

      {view.primaryAction ? (
        <div className="pt-1">
          <PrimaryAction action={view.primaryAction} />
        </div>
      ) : null}
    </section>
  );
}
