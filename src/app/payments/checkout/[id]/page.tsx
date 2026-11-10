import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { actionStartFundingDeposit } from "@/app/payments/actions";
import { isBusinessRole } from "@/lib/account-audience";
import { getAccountSession } from "@/lib/accounts";
import { prisma } from "@/lib/db";
import { assertFundingAccess } from "@/lib/funding-access";
import {
  DEPOSIT_METHOD_LABELS,
  DEPOSIT_METHODS,
  type DepositMethod,
  readManualDepositInstructions,
  syncOpenGatewayDeposits,
} from "@/lib/funding-checkout";
import { formatMoney } from "@/lib/money";
import { collectionInstructionAmount } from "@/lib/provider-outbox";
import { readSignedDealMoney } from "@/lib/payment-engine";

export const dynamic = "force-dynamic";
export const metadata = { title: "Deposit funds" };

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; recorded?: string; returned?: string; cancelled?: string }>;
};

function instructionLines(method: string, value: unknown) {
  const instructions = readManualDepositInstructions(value);
  if (method === "ach_wire") {
    return [
      ["Bank", instructions.bankName],
      ["Account name", instructions.accountName],
      ["Routing number", instructions.routingNumber],
      ["Account number", instructions.accountNumber],
    ];
  }
  return [
    ["Payable to", instructions.checkPayableTo],
    ["Mail the check to", instructions.checkMailingAddress],
  ];
}

export default async function FundingCheckoutPage({ params, searchParams }: Props) {
  const { id } = await params;
  const query = await searchParams;
  const account = await getAccountSession().catch(() => null);
  if (!account) redirect(`/login?next=${encodeURIComponent(`/payments/checkout/${id}`)}&gate=payments`);
  const access = await assertFundingAccess(account, id);
  if (!access.ok) notFound();
  const businessViewer = isBusinessRole(account.role);
  if (businessViewer) await syncOpenGatewayDeposits(access.funding.id).catch(() => false);
  const funding = await prisma.collaborationFunding.findUnique({
    where: { id: access.funding.id },
    include: { deposits: { orderBy: { createdAt: "desc" } } },
  });
  if (!funding) notFound();
  const plan = (funding.feeSnapshotJson as { financialPlan?: unknown } | null)?.financialPlan;
  const signed = readSignedDealMoney(plan);
  const amount = collectionInstructionAmount({
    fundingGrossCents: funding.grossCents,
    signedBusinessPaysCents: signed?.businessPaysCents ?? null,
  });
  const amountLabel = amount.ok ? formatMoney(amount.amountCents, funding.currency) : "";
  const funded = funding.status === "held" || funding.status === "completed";

  return (
    <div className="bg-[#F7FAFF]">
      <section className="hero-atmosphere text-white">
        <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-lavender/80">Protected payments</p>
          <h1 className="mt-2 font-display text-4xl font-bold">Deposit funds</h1>
          <p className="mt-3 text-white/75">{funding.title}</p>
        </div>
      </section>
      <div className="mx-auto max-w-3xl space-y-6 px-4 py-10 sm:px-6">
        <p>
          <Link href="/payments" className="text-sm font-semibold text-violet hover:underline">
            ← Payments
          </Link>
        </p>
        {query.error ? (
          <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{query.error}</p>
        ) : null}
        {query.recorded ? (
          <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
            The manual payment is recorded as pending. The agreement stays unfunded until finance confirms it.
          </p>
        ) : null}
        {query.returned && funded ? (
          <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
            Stripe confirmed the payment. Deliverables are open.
          </p>
        ) : query.returned ? (
          <p className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
            Stripe has not confirmed this payment. The agreement stays unfunded.
          </p>
        ) : null}
        {query.cancelled ? (
          <p className="rounded-xl border border-border bg-white px-4 py-3 text-sm text-muted">
            Checkout was cancelled. Nothing was charged.
          </p>
        ) : null}
        <section className="card-surface space-y-2 p-5">
          <p className="text-sm text-muted">
            Amount due{" "}
            <strong className="text-indigo">{amountLabel || formatMoney(funding.grossCents, funding.currency)}</strong>
          </p>
          <p className="text-sm text-muted">
            Status <strong className="text-indigo">{funding.status.replaceAll("_", " ")}</strong>. A card or online ACH
            payment is confirmed by the gateway. An ACH wire or a check is completed offline and stays pending until
            finance confirms it in admin.
          </p>
        </section>
        {funding.deposits.length > 0 ? (
          <section className="card-surface space-y-4 p-5">
            <h2 className="font-display text-lg font-bold text-indigo">Deposits</h2>
            {funding.deposits.map((deposit) => (
              <div key={deposit.id} className="space-y-2 rounded-xl border border-border px-4 py-3">
                <p className="text-sm text-indigo">
                  <strong>{DEPOSIT_METHOD_LABELS[deposit.method as DepositMethod] ?? deposit.method}</strong> ·{" "}
                  {formatMoney(deposit.amountCents, deposit.currency)} · {deposit.status.replaceAll("_", " ")}
                </p>
                {deposit.payerNote ? <p className="text-xs text-muted">{deposit.payerNote}</p> : null}
                {deposit.status === "manual_pending" ? (
                  <dl className="grid gap-1 text-sm text-indigo">
                    {instructionLines(deposit.method, deposit.instructionsJson).map(([label, value]) => (
                      <div key={label} className="flex flex-wrap gap-2">
                        <dt className="text-muted">{label}</dt>
                        <dd className="font-semibold">{value}</dd>
                      </div>
                    ))}
                  </dl>
                ) : null}
                {deposit.status === "manual_pending" ? (
                  <p className="text-xs text-muted">
                    Pay this amount offline with the reference {funding.id}. Finance confirmation is what funds the
                    agreement.
                  </p>
                ) : null}
              </div>
            ))}
          </section>
        ) : null}
        {funded ? (
          <Link href={`/collaboration/work/${funding.id}`} className="btn-primary inline-flex text-sm">
            Open deliverables
          </Link>
        ) : businessViewer && funding.status === "awaiting_provider" && amount.ok ? (
          <section className="card-surface space-y-4 p-5">
            <h2 className="font-display text-lg font-bold text-indigo">Choose how to pay</h2>
            <form action={actionStartFundingDeposit} className="space-y-4">
              <input type="hidden" name="fundingId" value={funding.id} />
              <fieldset className="space-y-2">
                <legend className="text-xs font-semibold text-muted">Payment method</legend>
                {DEPOSIT_METHODS.map((method) => (
                  <label key={method} className="flex items-center gap-2 text-sm text-indigo">
                    <input type="radio" name="method" value={method} required />
                    {DEPOSIT_METHOD_LABELS[method]}
                  </label>
                ))}
              </fieldset>
              <label className="block text-xs font-semibold text-muted">
                Receipt email
                <input
                  name="email"
                  type="email"
                  className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm font-normal text-indigo"
                />
              </label>
              <label className="block text-xs font-semibold text-muted">
                Note for finance
                <input
                  name="note"
                  className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm font-normal text-indigo"
                />
              </label>
              <button type="submit" className="btn-primary text-sm">
                Continue to deposit
              </button>
            </form>
          </section>
        ) : (
          <p className="text-sm text-muted">
            {businessViewer
              ? "This funding is not waiting for a deposit."
              : "The business deposits these funds. The agreement stays unfunded until the payment is confirmed."}
          </p>
        )}
      </div>
    </div>
  );
}
