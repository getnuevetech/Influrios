/** @jsxRuntime automatic */
/** @jsxImportSource react */
import Link from "next/link";
import type { BillingPlanView } from "@/lib/subscription-renewal";

export function BillingPlanPanel({
  view,
  manageHref,
  action,
}: {
  view: BillingPlanView;
  manageHref: string;
  action?: (formData: FormData) => void | Promise<void>;
}) {
  return (
    <section className="mt-6 space-y-3 text-sm text-indigo">
      <h2 className="font-display text-lg font-bold">Billing & Plan</h2>
      <p>Current plan: {view.planName}</p>
      <dl className="grid gap-2 sm:grid-cols-2">
        <div>
          <dt className="text-muted">Plan</dt>
          <dd>{view.planName}</dd>
        </div>
        <div>
          <dt className="text-muted">Interval</dt>
          <dd>{view.intervalLabel}</dd>
        </div>
        <div>
          <dt className="text-muted">Price</dt>
          <dd>{view.priceLabel}</dd>
        </div>
        <div>
          <dt className="text-muted">Started</dt>
          <dd>{view.startedLabel}</dd>
        </div>
        <div>
          <dt className="text-muted">Next renewal</dt>
          <dd>{view.renewalLabel}</dd>
        </div>
        <div>
          <dt className="text-muted">Auto-renewal</dt>
          <dd>{view.autoRenewLabel}</dd>
        </div>
      </dl>
      {view.endNote ? <p>{view.endNote}</p> : null}
      {view.canToggle && action ? (
        <form action={action}>
          <input type="hidden" name="autoRenew" value={view.autoRenew ? "off" : "on"} />
          <button type="submit" className="btn-primary !py-2 text-sm">
            {view.autoRenew ? "Turn auto-renewal off" : "Turn auto-renewal on"}
          </button>
        </form>
      ) : null}
      <p className="text-muted">Payout setup stays on Earnings & Payouts. This page is the subscription.</p>
      <p>
        <Link href={manageHref} className="font-semibold text-violet">
          Manage Billing & Plan
        </Link>
      </p>
    </section>
  );
}
