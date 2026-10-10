import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdminPage } from "@/app/admin/guard";
import { frozenFeeRuleHeading, getFundingTransactionView } from "@/lib/admin-transaction-view";
import { FEE_TYPE_LABELS, type FeeType } from "@/lib/collaboration-fees";
import { formatMoney } from "@/lib/money";

export const dynamic = "force-dynamic";
export const metadata = { title: "Admin · Transaction" };

type Props = { params: Promise<{ fundingId: string }> };

export default async function AdminFundingTransactionPage({ params }: Props) {
  await requireAdminPage("marketplace");
  const { fundingId } = await params;
  const view = await getFundingTransactionView(fundingId);
  if (!view) notFound();

  const { funding, feeRule, funds, provider, milestones, disputes, changeOrders, audits, collaboration } =
    view;
  const feeTypeLabel = FEE_TYPE_LABELS[feeRule.feeType as FeeType] ?? feeRule.feeType;

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/marketplace" className="text-sm font-semibold text-violet hover:underline">
          ← Marketplace ledger
        </Link>
        <h1 className="mt-2 font-display text-3xl font-bold text-indigo">Transaction</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted">
          Unified admin view for one prefund — parties, milestones, provider, frozen fee rule, funds, and audit
          (Product §16 / Dev §19).
        </p>
      </div>

      <section className="card-surface space-y-2 p-5">
        <h2 className="font-display text-lg font-bold text-indigo">Collaboration</h2>
        <p className="text-sm text-indigo">
          <span className="font-semibold">{funding.businessName}</span> →{" "}
          <span className="font-semibold">{funding.creatorSlug}</span>
        </p>
        <p className="text-sm text-muted">{funding.title}</p>
        <p className="text-xs text-muted">
          {funding.jurisdictionCode} · {funding.serviceLevel} · {funding.fundingMode} · status{" "}
          <span className="font-semibold uppercase tracking-wide text-violet">
            {funding.status.replaceAll("_", " ")}
          </span>
          {funding.attributionLabel ? ` · ${funding.attributionLabel}` : ""}
        </p>
        {collaboration ? (
          <p className="text-xs text-muted">
            Proposal{" "}
            <Link
              href={`/collaboration/records/${collaboration.id}`}
              className="font-semibold text-violet hover:underline"
            >
              {collaboration.id}
            </Link>{" "}
            · {collaboration.status} · {collaboration.initiatorSlug} → {collaboration.recipientSlug}
          </p>
        ) : (
          <p className="text-xs text-muted">No matching Collaboration proposal row found.</p>
        )}
        <p className="text-[11px] text-muted">
          Funding id <code>{funding.id}</code> · created {funding.createdAt}
        </p>
      </section>

      <section className="grid gap-4 sm:grid-cols-2">
        <div className="card-surface space-y-2 p-5">
          <h2 className="font-display text-lg font-bold text-indigo">Provider</h2>
          <p className="text-sm text-indigo">
            {provider.name ?? provider.code} ({provider.code})
          </p>
          <p className="text-xs text-muted">{provider.ready ? "Ready for signed webhooks" : "Not ready"}</p>
        </div>
        <div className="card-surface space-y-2 p-5">
          <h2 className="font-display text-lg font-bold text-indigo">Fee rule (frozen)</h2>
          <p className="text-sm text-indigo">
            {frozenFeeRuleHeading(feeRule.ruleName, feeRule.ruleVersion)}
          </p>
          <p className="text-xs text-muted">
            {feeTypeLabel}
            {feeRule.method ? ` · ${feeRule.method}` : ""}
            {feeRule.percentBps != null ? ` · ${feeRule.percentBps} bps` : ""}
            {feeRule.ruleId ? ` · ${feeRule.ruleId}` : ""}
          </p>
          <p className="text-sm font-semibold text-indigo">
            Snapshot fee {formatMoney(feeRule.calculatedFeeCents, funding.currency)}
          </p>
        </div>
      </section>

      <section className="card-surface space-y-2 p-5">
        <h2 className="font-display text-lg font-bold text-indigo">Funds</h2>
        <p className="text-sm text-muted">
          Gross {formatMoney(funding.grossCents, funding.currency)} · held{" "}
          {formatMoney(funds.heldCents, funding.currency)} · released{" "}
          {formatMoney(funds.releasedCents, funding.currency)} · refunded{" "}
          {formatMoney(funds.refundedCents, funding.currency)} · earned fee{" "}
          {formatMoney(funds.feeCents, funding.currency)}
        </p>
        {funding.status === "awaiting_provider" ? (
          <p className="pt-2 text-xs text-muted">
            This prefund stays unfunded until the provider webhook confirms it.
          </p>
        ) : null}
      </section>

      <section className="card-surface space-y-3 p-5">
        <h2 className="font-display text-lg font-bold text-indigo">Milestones</h2>
        {milestones.length === 0 ? <p className="text-sm text-muted">No milestones.</p> : null}
        <ul className="space-y-2 text-sm text-indigo">
          {milestones.map((m) => (
            <li key={m.id} className="rounded-lg border border-[#E6ECFF] px-3 py-2">
              <span className="font-semibold">{m.title}</span> · {formatMoney(m.amountCents, funding.currency)} ·{" "}
              {m.status}
              {m.refundedCents > 0
                ? ` · refunded ${formatMoney(m.refundedCents, funding.currency)}`
                : ""}
              {m.revisionLimit > 0
                ? ` · revisions ${m.revisionCount}/${m.revisionLimit}`
                : " · no revisions"}
              {m.autoApproveAt ? ` · review by ${m.autoApproveAt}` : ""}
              {m.rightsStatus ? ` · rights ${m.rightsStatus}` : ""}
            </li>
          ))}
        </ul>
        {disputes.length > 0 ? (
          <div className="pt-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-violet">Open disputes</p>
            <ul className="mt-1 space-y-1 text-xs text-muted">
              {disputes.map((d) => (
                <li key={d.id}>
                  {d.id} · {d.status}
                  {d.milestoneId ? ` · milestone ${d.milestoneId}` : ""}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        {changeOrders.length > 0 ? (
          <div className="pt-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-violet">Change orders</p>
            <ul className="mt-1 space-y-1 text-xs text-muted">
              {changeOrders.map((o) => (
                <li key={o.id}>
                  {formatMoney(o.previousUsdCents)} → {formatMoney(o.nextUsdCents)} · {o.note}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </section>

      <section className="card-surface space-y-3 p-5">
        <h2 className="font-display text-lg font-bold text-indigo">Audit history</h2>
        {audits.length === 0 ? (
          <p className="text-sm text-muted">No audit rows for this funding tree yet.</p>
        ) : (
          <ul className="space-y-2 text-xs text-muted">
            {audits.map((row) => (
              <li key={row.id} className="rounded-lg border border-[#E6ECFF] px-3 py-2">
                <span className="font-semibold text-indigo">{row.action}</span> · {row.actor} · {row.objectType}{" "}
                {row.objectId} · {row.createdAt}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
