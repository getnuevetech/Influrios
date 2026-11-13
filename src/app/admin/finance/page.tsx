import Link from "next/link";
import { actionExecuteApprovedRefund } from "@/app/payments/standard-actions";
import { requireAnyAdminModule } from "@/app/admin/guard";
import { MoneyAmount } from "@/components/payment-journey/status";
import { hasPermission } from "@/lib/admin-auth";
import { prisma } from "@/lib/db";
import { formatMinor } from "@/lib/payment-standard-v4";

export const dynamic = "force-dynamic";
export const metadata = { title: "Finance · Admin" };

export default async function AdminFinancePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; queued?: string; settlement?: string }>;
}) {
  const session = await requireAnyAdminModule(["collab_finance", "marketplace"]);
  const query = await searchParams;
  const canExecute = hasPermission(session, "collab_finance.manage");
  const [failed, accepted, cases] = await Promise.all([
    prisma.fundingMilestone.findMany({
      where: { payoutFailedAt: { not: null } },
      include: { funding: { select: { id: true, title: true, currency: true, businessName: true } } },
      orderBy: { payoutFailedAt: "desc" },
      take: 30,
    }).catch(() => []),
    prisma.fundingSettlement.findMany({
      where: { status: "accepted" },
      orderBy: { updatedAt: "desc" },
      take: 20,
    }).catch(() => []),
    prisma.reconciliationCaseV4.findMany({ orderBy: { createdAt: "desc" }, take: 20 }).catch(() => []),
  ]);
  const open = query.settlement ? accepted.find((row) => row.id === query.settlement) : null;
  return (
    <div data-screen="A03" className="mx-auto max-w-5xl space-y-6 px-4 py-8">
      <h1 className="font-display text-3xl font-bold text-indigo">Finance</h1>
      <p className="text-sm text-muted">Exceptions first. Customer allocations, fees, taxes, and refunds stay separate. Opening a row does not move money.</p>
      {query.error ? <p className="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-800">{query.error}</p> : null}
      {query.queued ? <p className="rounded-2xl bg-amber-50 px-4 py-3 text-sm">Refund submitted. Awaiting provider confirmation.</p> : null}
      <section className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-border bg-white p-4"><p className="text-xs text-muted">Payout failed</p><p className="font-display text-2xl font-bold">{failed.length}</p></div>
        <div className="rounded-2xl border border-border bg-white p-4"><p className="text-xs text-muted">Accepted refunds</p><p className="font-display text-2xl font-bold">{accepted.length}</p></div>
        <div className="rounded-2xl border border-border bg-white p-4"><p className="text-xs text-muted">Restricted cases</p><p className="font-display text-2xl font-bold">{cases.length}</p></div>
      </section>
      <section className="space-y-2">
        <h2 className="font-display text-xl font-bold">Payout failed or returned</h2>
        {failed.length === 0 ? <p className="text-sm text-muted">No failed payouts.</p> : failed.map((row) => (
          <article key={row.id} className="rounded-2xl border border-border bg-white p-4 text-sm">
            <p className="font-semibold">{row.funding.title}</p>
            <p>{row.title} · {row.funding.businessName}</p>
            <p>Amount <MoneyAmount cents={row.amountCents} currency={row.funding.currency} /></p>
            <p className="text-xs text-muted">Query status before another payout. Do not create a second transfer from this screen.</p>
          </article>
        ))}
      </section>
      <section className="space-y-2">
        <h2 className="font-display text-xl font-bold">Accepted refunds</h2>
        {accepted.map((row) => {
          const proposal = row.proposalJson as { businessRefundCents?: number };
          return (
            <article key={row.id} className="rounded-2xl border border-border bg-white p-4 text-sm">
              <p>Version {row.versionNumber} · {row.status}</p>
              <p>{Number.isInteger(proposal.businessRefundCents) ? formatMinor(Number(proposal.businessRefundCents), "USD") : "Amount on the accepted version"}</p>
              <Link href={`/admin/finance?settlement=${row.id}`} className="font-semibold text-violet">View settlement</Link>
            </article>
          );
        })}
      </section>
      {open && canExecute ? (
        <form action={actionExecuteApprovedRefund} className="rounded-2xl border border-border bg-white p-4">
          <input type="hidden" name="fundingId" value={open.fundingId} />
          <p className="text-sm">Execute only queues the provider refund. The case is not marked refunded here.</p>
          <button type="submit" className="mt-3 h-11 rounded-full bg-violet px-4 text-sm font-semibold text-white">Submit refund</button>
        </form>
      ) : null}
    </div>
  );
}
