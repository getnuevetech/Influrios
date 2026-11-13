import Link from "next/link";
import { actionStartFundingDeposit } from "@/app/payments/actions";
import { BlockedNote, MoneyAmount, PaymentStatus } from "@/components/payment-journey/status";
import { DEPOSIT_METHOD_LABELS, DEPOSIT_METHODS, type DepositMethod } from "@/lib/funding-checkout";
import { formatMinor } from "@/lib/payment-standard-v4";
import { readSignedDealMoney } from "@/lib/payment-engine";

type Deposit = {
  id: string;
  method: string;
  status: string;
  amountCents: number;
  currency: string;
};

export function CheckoutPanel({
  fundingId,
  title,
  currency,
  status,
  grossCents,
  feeSnapshot,
  deposits,
  businessViewer,
  error,
  recorded,
  returned,
  cancelled,
  readiness,
}: {
  fundingId: string;
  title: string;
  currency: string;
  status: string;
  grossCents: number;
  feeSnapshot: unknown;
  deposits: Deposit[];
  businessViewer: boolean;
  error?: string;
  recorded?: string;
  returned?: string;
  cancelled?: string;
  readiness: {
    signatures: boolean;
    businessVerification: "ready" | "unknown" | "blocked";
    recipientReady: boolean;
    routeRecorded: boolean;
  };
}) {
  const signed = readSignedDealMoney((feeSnapshot as { financialPlan?: unknown } | null)?.financialPlan);
  const taxKnown = signed != null;
  const total = signed?.businessPaysCents ?? grossCents;
  const openDeposit = deposits.find((row) => row.status === "gateway_opened" || row.status === "manual_pending");
  const failed = deposits.some((row) => row.status === "failed");
  const funded = status === "held" || status === "completed";
  const processing = Boolean(openDeposit) && !funded;
  const label = funded ? "Funded" : processing ? "Checking payment status" : failed ? "Needs attention" : "Needs funding";

  return (
    <div data-screen="B02" className="mx-auto max-w-3xl space-y-5 px-4 py-8">
      <Link href="/payments" className="text-sm font-semibold text-violet">Back to payments</Link>
      <div>
        <p className="text-xs font-bold uppercase tracking-wide text-violet">Funding checkout</p>
        <h1 className="font-display text-3xl font-bold text-indigo">{title}</h1>
        <div className="mt-3"><PaymentStatus label={label} /></div>
      </div>
      {error ? <p className="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-800">{error}</p> : null}
      {cancelled ? <p className="rounded-2xl bg-white px-4 py-3 text-sm">Checkout was cancelled. Nothing was charged.</p> : null}
      {recorded ? <BlockedNote kind="processing" /> : null}
      <section className="space-y-2 rounded-2xl border border-border bg-white p-5 text-sm">
        <h2 className="font-display text-lg font-bold">Signed breakdown</h2>
        {signed ? (
          <>
            <p>Gross work <MoneyAmount cents={signed.businessPaysCents - signed.businessPlatformFeeCents - (signed.activationFeeCents ?? 0) - signed.businessTaxCents} currency={currency} /></p>
            <p>Business collaboration fee <MoneyAmount cents={signed.businessPlatformFeeCents} currency={currency} /></p>
            <p>Tax <MoneyAmount cents={signed.businessTaxCents} currency={currency} /></p>
            {signed.activationFeeCents ? <p>Activation <MoneyAmount cents={signed.activationFeeCents} currency={currency} /></p> : <p>Activation is disabled for this agreement.</p>}
          </>
        ) : (
          <BlockedNote kind="tax" />
        )}
        <p className="font-display text-2xl font-bold">Total <MoneyAmount cents={total} currency={currency} /></p>
        <p className="text-xs text-muted">Influrios does not collect card numbers on this page. The approved provider hosts the card form.</p>
      </section>
      <section className="space-y-1 rounded-2xl border border-border bg-white p-5 text-sm">
        <h2 className="font-display text-lg font-bold">Readiness</h2>
        <p>Signatures {readiness.signatures ? "complete" : "still required"}.</p>
        <p>
          Business verification{" "}
          {readiness.businessVerification === "ready"
            ? "complete"
            : readiness.businessVerification === "blocked"
              ? "restricted"
              : "not confirmed on this account"}.
        </p>
        <p>
          {readiness.recipientReady
            ? "Recipient payout setup is ready. That does not pay the influencer."
            : "The influencer still needs to finish payout setup. Their private checks stay hidden."}
        </p>
        <p>Route {readiness.routeRecorded ? "is recorded for this agreement" : "is not recorded"}.</p>
      </section>
      {funded ? (
        <div className="space-y-3">
          <p className="text-sm">Funding confirmed. The influencer has not been paid yet.</p>
          <Link href={`/collaboration/work/${fundingId}`} className="inline-flex h-11 items-center rounded-full bg-violet px-4 text-sm font-semibold text-white">Open collaboration</Link>
        </div>
      ) : processing ? (
        <div className="space-y-2">
          <BlockedNote kind="processing" />
          <p className="text-sm">Reference {fundingId}. You can close this page. There is no second charge button.</p>
        </div>
      ) : businessViewer && status === "awaiting_provider" && taxKnown ? (
        <form action={actionStartFundingDeposit} className="space-y-4 rounded-2xl border border-border bg-white p-5">
          <input type="hidden" name="fundingId" value={fundingId} />
          <fieldset className="space-y-2">
            <legend className="text-sm font-semibold">Payment method</legend>
            {DEPOSIT_METHODS.filter((method) => method === "card" || method === "ach_online").map((method) => (
              <label key={method} className="flex min-h-11 items-center gap-2 text-sm">
                <input type="radio" name="method" value={method} required />
                {DEPOSIT_METHOD_LABELS[method as DepositMethod]}
              </label>
            ))}
          </fieldset>
          <p className="text-xs text-muted">Wire and check are not offered unless a route version lists them. Card checkout still waits for provider confirmation.</p>
          <button type="submit" className="inline-flex h-11 items-center rounded-full bg-violet px-4 text-sm font-semibold text-white">
            Fund collaboration {formatMinor(total, currency)}
          </button>
        </form>
      ) : (
        <p className="text-sm text-muted">{businessViewer ? "This agreement is not waiting for funding." : "Funding is paused until the business completes checkout. Private verification details stay hidden."}</p>
      )}
      {returned && !funded ? <p className="text-sm">The provider has not confirmed this payment.</p> : null}
    </div>
  );
}
