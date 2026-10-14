import { actionOpenConnect, actionOpenConnectedAccount } from "@/app/billing/actions";
import type { PayoutOnboardingChoice } from "@/lib/payout-readiness";
import { countryDisplayName } from "@/lib/providers";

function maskAccountId(id: string | null | undefined) {
  const value = (id ?? "").trim();
  if (!value) return null;
  if (value.length <= 10) return value;
  return `${value.slice(0, 7)}…${value.slice(-4)}`;
}

function railLabel(choice: PayoutOnboardingChoice | null) {
  if (!choice) return "Unknown";
  if (choice.rail === "stripe") return "Stripe Connect";
  if (choice.rail === "provider") {
    const code = (choice.collectionProviderCode ?? "").trim();
    if (!code) return "Connected account";
    return `${code.charAt(0).toUpperCase()}${code.slice(1)} connected account`;
  }
  const code = (choice.collectionProviderCode ?? "").trim();
  if (code === "flutterwave" || code === "mpesa") return `Local rail (${code})`;
  return "Not configured";
}

export function CreatorPayoutMethodsPanel({
  rail,
  hasStripeConnectAccount,
  hasProviderAccount,
  stripeConnectAccountId,
  providerConnectedAccountId,
  locationCountry,
  identityVerified,
  payoutReady,
  error,
  notice,
}: {
  rail: PayoutOnboardingChoice | null;
  hasStripeConnectAccount: boolean;
  hasProviderAccount: boolean;
  stripeConnectAccountId?: string | null;
  providerConnectedAccountId?: string | null;
  locationCountry?: string | null;
  identityVerified?: boolean;
  payoutReady: boolean;
  error?: string;
  notice?: string;
}) {
  const showStripe = Boolean(rail?.showStripe);
  const showProvider = Boolean(rail?.showProvider);
  const countryCode = rail?.countryCode ?? null;
  const countryLabel = countryCode
    ? `${countryDisplayName(countryCode, locationCountry)} (${countryCode})`
    : locationCountry?.trim() || "Not set on your Influencer Card";
  const accountId = showStripe
    ? maskAccountId(stripeConnectAccountId)
    : showProvider
      ? maskAccountId(providerConnectedAccountId)
      : null;

  return (
    <section id="payouts" className="space-y-4 rounded-3xl border border-[#E6ECF7] bg-white p-5 shadow-sm">
      <div>
        <h2 className="font-display text-base font-bold">Payout methods</h2>
        <p className="mt-1 text-sm text-muted">
          Collaboration milestone releases use the payout rail for your country corridor — not your Influrios plan
          subscription.
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

      <dl className="grid gap-3 text-sm sm:grid-cols-2">
        <div className="rounded-2xl bg-[#F7F9FD] px-3 py-2.5">
          <dt className="text-[11px] font-semibold uppercase tracking-wide text-muted">Country corridor</dt>
          <dd className="mt-0.5 font-semibold">{countryLabel}</dd>
        </div>
        <div className="rounded-2xl bg-[#F7F9FD] px-3 py-2.5">
          <dt className="text-[11px] font-semibold uppercase tracking-wide text-muted">Collection rail</dt>
          <dd className="mt-0.5 font-semibold">{railLabel(rail)}</dd>
        </div>
        <div className="rounded-2xl bg-[#F7F9FD] px-3 py-2.5">
          <dt className="text-[11px] font-semibold uppercase tracking-wide text-muted">Payout account</dt>
          <dd className="mt-0.5 font-semibold">
            {accountId ? (
              <>
                Saved <span className="font-mono text-xs font-medium text-muted">{accountId}</span>
              </>
            ) : (
              "Not set up yet"
            )}
          </dd>
        </div>
        <div className="rounded-2xl bg-[#F7F9FD] px-3 py-2.5">
          <dt className="text-[11px] font-semibold uppercase tracking-wide text-muted">Status</dt>
          <dd className="mt-0.5 font-semibold">
            {payoutReady ? "Ready to receive" : identityVerified === false ? "Identity or method still needed" : "Setup needed"}
          </dd>
        </div>
      </dl>

      {showStripe ? (
        <form action={actionOpenConnect}>
          <p className="text-sm text-muted">
            {hasStripeConnectAccount
              ? "Your Stripe Connect account is on file. Opening it updates onboarding — it does not send a payout."
              : "Create a Stripe Connect account for this corridor. This does not send a payout."}
          </p>
          <button type="submit" className="btn-primary mt-3 !py-2 text-sm">
            {hasStripeConnectAccount ? "Open Stripe Connect" : "Set up Stripe Connect"}
          </button>
        </form>
      ) : null}

      {showProvider ? (
        <form action={actionOpenConnectedAccount}>
          <p className="text-sm text-muted">
            {hasProviderAccount
              ? "Your connected account is on file. Confirming it does not send a payout."
              : "Create the connected account that receives milestone splits. This does not send a payout."}
          </p>
          <button type="submit" className="btn-primary mt-3 !py-2 text-sm">
            {hasProviderAccount ? "Confirm connected account" : "Set up connected account"}
          </button>
        </form>
      ) : null}

      {!showStripe && !showProvider ? (
        <p className="text-sm text-muted">
          {rail?.emptyHint ??
            "Payout onboarding opens here once your country corridor’s collection route is ready."}
        </p>
      ) : null}
    </section>
  );
}
