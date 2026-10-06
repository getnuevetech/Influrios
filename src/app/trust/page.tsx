import Link from "next/link";
import { listMilestoneDisputes } from "@/lib/milestone-disputes";
import { formatMoney } from "@/lib/money";

export const dynamic = "force-dynamic";
export const metadata = { title: "Trust & Disputes" };

type Props = {
  searchParams: Promise<{ opened?: string; error?: string }>;
};

export default async function TrustPage({ searchParams }: Props) {
  const params = await searchParams;
  const ledgerDisputes = await listMilestoneDisputes().catch(() => []);
  const open = ledgerDisputes.filter((dispute) => dispute.status === "open" || dispute.status === "under_review").length;
  const resolved = ledgerDisputes.length - open;

  return (
    <div className="bg-[#F7FAFF]">
      <section className="hero-atmosphere text-white">
        <div className="mx-auto max-w-[90rem] px-4 py-12 sm:px-6">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-lavender/80">
            Trust &amp; Disputes
          </p>
          <h1 className="mt-2 font-display text-4xl font-bold">Mediation &amp; briefs</h1>
          <p className="mt-3 max-w-2xl text-white/75">
            Ledger disputes for provider-held milestones. A decision records what should happen next and does not move the money.
          </p>
        </div>
      </section>

      <div className="mx-auto max-w-[90rem] space-y-8 px-4 py-10 sm:px-6">
        <div className="flex flex-wrap gap-3 text-center text-xs">
          <div className="rounded-xl bg-amber-100 px-4 py-2">
            <p className="font-display text-lg font-bold text-amber-800">{open}</p>
            <p className="text-muted">Open / review</p>
          </div>
          <div className="rounded-xl bg-emerald-100 px-4 py-2">
            <p className="font-display text-lg font-bold text-emerald-700">{resolved}</p>
            <p className="text-muted">Resolved</p>
          </div>
        </div>

        {params.error ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            {params.error}
          </div>
        ) : null}
        {params.opened ? (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            Dispute {params.opened} opened — ops will mediate.
          </div>
        ) : null}

        <section className="card-surface p-6">
          <h2 className="font-display text-xl font-bold text-indigo">Provider-held disputes</h2>
          <p className="mt-1 text-sm text-muted">
            These cases block a release until they close. A refund still waits for the marketplace provider.
            Open one from{" "}
            <Link href="/payments" className="font-semibold text-violet hover:underline">
              Protected Payments
            </Link>
            .
          </p>
          {ledgerDisputes.length === 0 ? (
            <p className="mt-4 text-sm text-muted">No provider-held disputes yet.</p>
          ) : (
            <ul className="mt-4 space-y-2 text-sm">
              {ledgerDisputes.map((dispute) => (
                <li key={dispute.id} className="rounded-xl border border-border px-4 py-3">
                  <p className="font-semibold text-indigo">
                    {dispute.funding.title} · {dispute.milestone?.title ?? "Milestone"}
                  </p>
                  <p className="text-muted">
                    {dispute.reasonLabel} · {dispute.status.replaceAll("_", " ")}
                    {dispute.requestedRefundCents
                      ? ` · refund requested ${formatMoney(dispute.requestedRefundCents)}`
                      : ""}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>

        <p className="text-center text-sm text-muted">
          Admin mediation:{" "}
          <Link href="/admin/trust" className="font-semibold text-violet hover:underline">
            Trust console
          </Link>
          {" · "}
          <Link href="/payments" className="font-semibold text-violet hover:underline">
            Protected Payments
          </Link>
        </p>
      </div>
    </div>
  );
}
