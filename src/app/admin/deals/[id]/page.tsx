import Link from "next/link";
import { notFound } from "next/navigation";
import { actionApproveDealAmendment, actionVoidDealContract } from "@/app/admin/deals/actions";
import { requireAnyAdminModule } from "@/app/admin/guard";
import { hasPermission, isSuperAdmin } from "@/lib/admin-auth";
import { loadAdminDeal } from "@/lib/admin-deal";
import { formatMoney } from "@/lib/money";
import { contractMayBeVoided } from "@/lib/signed-funding";

export const dynamic = "force-dynamic";
export const metadata = { title: "Deal · Admin" };

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string; voided?: string; amended?: string }> };

export default async function AdminDealPage({ params, searchParams }: Props) {
  const session = await requireAnyAdminModule(["collaborations", "contracts", "marketplace"]);
  const { id } = await params;
  const query = await searchParams;
  const deal = await loadAdminDeal(id);
  if (!deal) notFound();
  const { contract, funding, collaboration, relatedContracts, audits, progress, terms } = deal;
  const anchor = contract?.id ?? funding?.id ?? collaboration?.id ?? id;
  const canVoid = isSuperAdmin(session);
  const canAmend = canVoid || hasPermission(session, "contracts.manage");
  const holdLabel = progress.hold
    ? `${formatMoney(progress.hold.amountCents, progress.hold.currency || funding?.currency || "USD")} on ${progress.hold.title}`
    : null;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <Link href="/admin/deals" className="text-sm font-semibold text-violet hover:underline">
          ← Deals
        </Link>
        <h1 className="mt-2 font-display text-3xl font-bold text-indigo">
          {contract?.title || funding?.title || collaboration?.title || "Deal"}
        </h1>
        <p className="mt-2 max-w-3xl text-sm font-semibold text-indigo">{progress.next}</p>
        {holdLabel ? <p className="mt-1 text-sm text-amber-800">Amount on hold: {holdLabel}</p> : null}
      </div>
      {query.error ? <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900">{query.error}</p> : null}
      {query.voided ? <p className="text-sm font-semibold text-emerald-700">Agreement voided. The PDF and signatures stay on record.</p> : null}
      {query.amended ? <p className="text-sm font-semibold text-emerald-700">Change order approved. The next funding instruction uses these terms.</p> : null}

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ["Collaboration", progress.collaboration],
          ["Agreement", progress.agreement],
          ["Funding", progress.funding],
          ["Delivery and payout", progress.delivery],
        ].map(([label, value]) => (
          <div key={label} className="rounded-2xl border border-[#E4EBFF] bg-white p-4">
            <p className="text-[11px] font-bold uppercase tracking-wide text-muted">{label}</p>
            <p className="mt-1 text-sm font-semibold text-indigo">{value}</p>
          </div>
        ))}
      </section>

      <section className="rounded-2xl border border-[#E4EBFF] bg-white p-5 text-sm">
        <h2 className="font-display text-lg font-bold text-indigo">Records</h2>
        <ul className="mt-3 space-y-2 text-indigo">
          <li>
            Collaboration:{" "}
            {collaboration ? (
              <span>
                {collaboration.status} · {collaboration.initiatorSlug} → {collaboration.recipientSlug}
              </span>
            ) : (
              "No proposal row"
            )}
          </li>
          <li>
            Agreement:{" "}
            {contract ? (
              <Link href={`/collaboration/contracts/${contract.id}`} className="font-semibold text-violet hover:underline">
                {contract.status} · {contract.title}
              </Link>
            ) : (
              "No agreement"
            )}
            {contract?.supersededById ? ` · replaced by ${contract.supersededById}` : ""}
            {contract?.voidReason ? ` · void reason: ${contract.voidReason}` : ""}
          </li>
          <li>
            Funding:{" "}
            {funding ? (
              <Link href={`/admin/marketplace/${funding.id}`} className="font-semibold text-violet hover:underline">
                {funding.status.replaceAll("_", " ")} · {formatMoney(funding.grossCents, funding.currency)}
              </Link>
            ) : (
              "Not started"
            )}
          </li>
        </ul>
        {funding ? (
          <div className="mt-4">
            <h3 className="text-xs font-bold uppercase tracking-wide text-muted">Payment events</h3>
            <ul className="mt-2 space-y-1 text-xs text-muted">
              {funding.entries.map((entry) => (
                <li key={entry.id}>
                  {entry.createdAt.toISOString()} · {entry.kind} · {formatMoney(entry.amountCents, funding.currency)}
                </li>
              ))}
              {funding.entries.length === 0 ? <li>No provider event yet.</li> : null}
            </ul>
          </div>
        ) : null}
        {funding && funding.milestones.length > 0 ? (
          <ul className="mt-4 space-y-1">
            {funding.milestones.map((milestone) => (
              <li key={milestone.id}>
                {milestone.title} · {formatMoney(milestone.amountCents, funding.currency)} · {milestone.status}
                {milestone.releaseScheduledAt ? ` · release scheduled ${milestone.releaseScheduledAt.toISOString()}` : ""}
                {milestone.submissions.length > 0
                  ? ` · ${milestone.submissions.length} version${milestone.submissions.length === 1 ? "" : "s"}`
                  : ""}
              </li>
            ))}
          </ul>
        ) : null}
        {funding && funding.disputes.length > 0 ? (
          <ul className="mt-4 space-y-1 text-amber-900">
            {funding.disputes.map((dispute) => (
              <li key={dispute.id}>
                Dispute {dispute.status} · {dispute.reasonLabel}
                {dispute.milestoneId ? ` · milestone ${dispute.milestoneId}` : ""}
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      {relatedContracts.length > 1 ? (
        <section className="rounded-2xl border border-[#E4EBFF] bg-white p-5">
          <h2 className="font-display text-lg font-bold text-indigo">Agreement versions</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {relatedContracts.map((row) => (
              <li key={row.id}>
                <Link href={`/admin/deals/${row.id}`} className="font-semibold text-violet hover:underline">
                  {row.title}
                </Link>{" "}
                <span className="text-muted">
                  {row.status}
                  {row.supersededById ? " · superseded" : ""}
                  {row.id === contract?.id ? " · this version" : ""}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {terms ? (
        <section className="rounded-2xl border border-[#E4EBFF] bg-white p-5 text-sm">
          <h2 className="font-display text-lg font-bold text-indigo">Stored terms</h2>
          <p className="mt-2 text-muted">
            {terms.currency} {formatMoney(terms.grossCents, terms.currency)} · {terms.serviceLevel} ·{" "}
            {terms.creators.map((row) => `${row.slug} ${row.shareBps / 100}%`).join(", ")}
          </p>
          <ul className="mt-2 space-y-1">
            {terms.milestones.map((row) => (
              <li key={`${row.title}-${row.shareBps}`}>
                {row.title} · {row.shareBps / 100}%
              </li>
            ))}
          </ul>
          {contract && contract.amendments.length > 0 ? (
            <ul className="mt-3 space-y-1 text-xs text-muted">
              {contract.amendments.map((row) => (
                <li key={row.id}>
                  Change order {row.createdAt.toISOString().slice(0, 10)} · {row.currency} {formatMoney(row.grossCents, row.currency)} · {row.note}
                </li>
              ))}
            </ul>
          ) : null}
        </section>
      ) : null}

      <section className="rounded-2xl border border-[#E4EBFF] bg-white p-5">
        <h2 className="font-display text-lg font-bold text-indigo">Audit</h2>
        <ul className="mt-3 space-y-1 text-xs text-muted">
          {audits.map((row) => (
            <li key={row.id}>
              {row.createdAt.toISOString()} · {row.actor} · {row.action}
            </li>
          ))}
          {audits.length === 0 ? <li>No audit rows for this deal yet.</li> : null}
        </ul>
      </section>

      {contract && canAmend && contract.status === "signed" && !contract.fundingId ? (
        <form action={actionApproveDealAmendment} className="space-y-3 rounded-2xl border border-[#E4EBFF] bg-white p-5">
          <h2 className="font-display text-lg font-bold text-indigo">Approve a change order</h2>
          <p className="text-xs text-muted">
            Funding uses these terms instead of the signed snapshot. Creators are one per line as slug, percent. Milestones
            are one per line as title | percent. Shares must add up to 100.
          </p>
          <input type="hidden" name="id" value={contract.id} />
          <input name="gross" placeholder="Gross amount" className="w-full rounded-xl border border-border px-3 py-2 text-sm" />
          <input name="currency" placeholder="USD" defaultValue={terms?.currency ?? ""} className="w-full rounded-xl border border-border px-3 py-2 text-sm" />
          <textarea name="creators" rows={3} placeholder={"creator-slug, 100"} className="w-full rounded-xl border border-border px-3 py-2 text-sm" />
          <textarea name="milestones" rows={3} placeholder={"Delivery | 100"} className="w-full rounded-xl border border-border px-3 py-2 text-sm" />
          <textarea name="note" required minLength={8} rows={2} placeholder="Why the terms changed" className="w-full rounded-xl border border-border px-3 py-2 text-sm" />
          <button type="submit" className="btn-primary !py-2 text-sm">
            Approve change order
          </button>
        </form>
      ) : null}

      {contract && canVoid && contractMayBeVoided(contract.status, contract.fundingId) ? (
        <form action={actionVoidDealContract} className="space-y-3 rounded-2xl border border-[#E4EBFF] bg-white p-5">
          <h2 className="font-display text-lg font-bold text-indigo">Void this agreement</h2>
          <p className="text-xs text-muted">
            Void keeps the PDF, signatures, and history. A business can send a replacement after this. Deleting a signed
            agreement is not available.
          </p>
          <input type="hidden" name="id" value={contract.id} />
          <textarea name="reason" required minLength={8} rows={2} placeholder="Why this agreement should be voided" className="w-full rounded-xl border border-border px-3 py-2 text-sm" />
          <button type="submit" className="text-sm font-semibold text-rose-700">
            Void agreement
          </button>
        </form>
      ) : null}
      <p className="text-xs text-muted">Deal anchor {anchor}</p>
    </div>
  );
}
