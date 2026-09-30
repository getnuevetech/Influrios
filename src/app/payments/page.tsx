import Link from "next/link";
import { actionApproveMilestone, actionCancelPrefund, actionCreateDeal, actionOpenDispute, actionSubmitMilestone } from "@/app/payments/actions";
import { listDisputeReasons } from "@/lib/milestone-disputes";
import { fundingTerm } from "@/lib/ledger";
import { listFundings, marketplaceConfig } from "@/lib/marketplace-ledger";
import { formatMoney } from "@/lib/protected-payments";
import { getCreatorBySlug, SEED_CREATORS } from "@/lib/seed-data";

export const dynamic = "force-dynamic";
export const metadata = { title: "Protected Payments" };

type Props = {
  searchParams: Promise<{ created?: string; submitted?: string; approved?: string; cancelled?: string; disputed?: string; error?: string }>;
};

const STATUS_COLOR: Record<string, string> = {
  awaiting_provider: "bg-blue-100 text-blue-800",
  held: "bg-violet-100 text-violet-800",
  completed: "bg-emerald-100 text-emerald-800",
  refunded: "bg-amber-100 text-amber-900",
  cancelled: "bg-rose-100 text-rose-800",
};

const MILESTONE_COLOR: Record<string, string> = {
  pending: "bg-slate-100 text-slate-600",
  submitted: "bg-amber-100 text-amber-800",
  approved: "bg-blue-100 text-blue-800",
  released: "bg-emerald-100 text-emerald-800",
  refunded: "bg-amber-100 text-amber-900",
};

export default async function PaymentsPage({ searchParams }: Props) {
  const params = await searchParams;
  const [config, fundings, reasons] = await Promise.all([
    marketplaceConfig().catch(() => null),
    listFundings().catch(() => []),
    listDisputeReasons().catch(() => []),
  ]);
  const jurisdictions = config?.jurisdictions ?? [];
  const homeJurisdiction = jurisdictions.find((row) => row.code === "US") ?? jurisdictions[0];
  const term = fundingTerm(Boolean(homeJurisdiction?.escrowTermAllowed));
  const held = fundings.reduce((sum, row) => sum + row.ledger.heldCents, 0);
  const released = fundings.reduce((sum, row) => sum + row.ledger.releasedCents, 0);
  const confirmed = fundings.filter((row) => row.status === "held" || row.status === "completed").length;

  return (
    <div className="bg-[#F7FAFF]">
      <section className="hero-atmosphere text-white">
        <div className="mx-auto max-w-[90rem] px-4 py-12 sm:px-6">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-lavender/80">Protected payments</p>
          <h1 className="mt-2 font-display text-4xl font-bold">{term} & milestones</h1>
          <p className="mt-3 max-w-2xl text-white/75">
            Request a prefund, track deliverables, and release each milestone only after the marketplace provider
            confirms the money is held.
          </p>
        </div>
      </section>

      <div className="mx-auto max-w-[90rem] space-y-8 px-4 py-10 sm:px-6">
        <div className="flex flex-wrap gap-3 text-center text-xs">
          <div className="rounded-xl bg-lavender px-4 py-2">
            <p className="font-display text-lg font-bold text-violet">{fundings.length}</p>
            <p className="text-muted">Deals</p>
          </div>
          <div className="rounded-xl bg-[#D9E8FF] px-4 py-2">
            <p className="font-display text-lg font-bold text-blue">{confirmed}</p>
            <p className="text-muted">Provider confirmed</p>
          </div>
          <div className="rounded-xl bg-emerald-100 px-4 py-2">
            <p className="font-display text-lg font-bold text-emerald-700">{formatMoney(released)}</p>
            <p className="text-muted">Released</p>
          </div>
          <div className="rounded-xl bg-amber-100 px-4 py-2">
            <p className="font-display text-lg font-bold text-amber-800">{formatMoney(held)}</p>
            <p className="text-muted">Held by provider</p>
          </div>
        </div>

        {params.error ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">{params.error}</div>
        ) : null}
        {params.created || params.submitted || params.approved || params.cancelled || params.disputed ? (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            {params.created ? `Prefund ${params.created} is waiting for the provider.` : ""}
            {params.submitted ? " Milestone submitted for review." : ""}
            {params.approved ? " Milestone approved. Release still waits for the provider." : ""}
            {params.cancelled ? " Unconfirmed prefund cancelled. Nothing was held." : ""}
            {params.disputed ? " Dispute opened. Release waits until it is resolved." : ""}
          </div>
        ) : null}

        <section className="card-surface p-6">
          <h2 className="font-display text-xl font-bold text-indigo">Start a protected deal</h2>
          <p className="mt-1 text-sm text-muted">
            {config?.provider.ready
              ? "The provider is ready to confirm a prefund. Creating a deal does not mark it funded."
              : "The marketplace provider is not ready. A deal cannot be funded until an admin saves its webhook secret."}
            {config?.templates.length
              ? ` Milestones follow the admin template: ${config.templates
                  .filter((row) => row.active)
                  .map((row) => `${row.title} ${row.shareBps / 100}%`)
                  .join(", ")}.`
              : ""}
          </p>
          <form action={actionCreateDeal} className="mt-4 grid gap-3 sm:grid-cols-2">
            <label className="text-sm">
              <span className="font-semibold text-indigo">Business</span>
              <input
                name="businessName"
                defaultValue="Luminous Beauty"
                required
                className="mt-1 w-full rounded-xl border border-border bg-white px-3 py-2"
              />
            </label>
            <label className="text-sm">
              <span className="font-semibold text-indigo">Creator</span>
              <select
                name="creatorSlug"
                required
                className="mt-1 w-full rounded-xl border border-border bg-white px-3 py-2"
                defaultValue="sofia-martinez"
              >
                {SEED_CREATORS.slice(0, 12).map((creator) => (
                  <option key={creator.slug} value={creator.slug}>
                    {creator.displayName}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm">
              <span className="font-semibold text-indigo">Jurisdiction</span>
              <select
                name="jurisdictionCode"
                className="mt-1 w-full rounded-xl border border-border bg-white px-3 py-2"
                defaultValue={homeJurisdiction?.code ?? "US"}
              >
                {jurisdictions.map((row) => (
                  <option key={row.code} value={row.code}>
                    {row.label} · {fundingTerm(row.escrowTermAllowed)}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm">
              <span className="font-semibold text-indigo">Gross USD</span>
              <input
                name="grossUsd"
                type="number"
                min={1}
                step={50}
                defaultValue={4500}
                required
                className="mt-1 w-full rounded-xl border border-border bg-white px-3 py-2"
              />
            </label>
            <label className="text-sm sm:col-span-2">
              <span className="font-semibold text-indigo">Brief / campaign</span>
              <input
                name="briefTitle"
                defaultValue="Product launch collab"
                required
                className="mt-1 w-full rounded-xl border border-border bg-white px-3 py-2"
              />
            </label>
            <button type="submit" className="btn-primary sm:col-span-2 !py-2.5 text-sm">
              Request prefund →
            </button>
          </form>
        </section>

        <section className="space-y-4">
          <h2 className="font-display text-2xl font-bold text-indigo">Active deals</h2>
          {fundings.length === 0 ? <p className="text-sm text-muted">No deals yet — request a prefund above.</p> : null}
          {fundings.map((deal) => {
            const creator = getCreatorBySlug(deal.creatorSlug);
            const jurisdiction = jurisdictions.find((row) => row.code === deal.jurisdictionCode);
            return (
              <article key={deal.id} className="card-surface p-6">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wide text-violet">
                      {deal.businessName} → {creator?.displayName ?? deal.creatorSlug}
                    </p>
                    <h3 className="mt-1 font-display text-xl font-bold text-indigo">{deal.title}</h3>
                    <p className="mt-1 font-mono text-[11px] text-muted">
                      {deal.id} · {fundingTerm(Boolean(jurisdiction?.escrowTermAllowed))}
                    </p>
                  </div>
                  <span className={`rounded-full px-3 py-1 text-xs font-semibold capitalize ${STATUS_COLOR[deal.status] ?? "bg-slate-100 text-slate-700"}`}>
                    {deal.status.replaceAll("_", " ")}
                  </span>
                </div>
                <div className="mt-4 flex flex-wrap gap-4 text-sm text-muted">
                  <span>
                    Total <strong className="text-indigo">{formatMoney(deal.grossCents)}</strong>
                  </span>
                  <span>
                    Fee snapshot <strong className="text-indigo">{formatMoney(deal.feeCents)}</strong>
                  </span>
                  <span>
                    Released <strong className="text-emerald-700">{formatMoney(deal.ledger.releasedCents)}</strong>
                  </span>
                  <span>
                    Held by provider <strong className="text-amber-800">{formatMoney(deal.ledger.heldCents)}</strong>
                  </span>
                </div>
                {deal.status === "awaiting_provider" ? (
                  <form action={actionCancelPrefund} className="mt-4">
                    <input type="hidden" name="dealId" value={deal.id} />
                    <button type="submit" className="rounded-xl border border-border bg-white px-3 py-1.5 text-xs font-semibold text-indigo">
                      Cancel prefund
                    </button>
                  </form>
                ) : null}
                <ul className="mt-5 space-y-3">
                  {deal.milestones.map((milestone) => (
                    <li
                      key={milestone.id}
                      className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-white px-4 py-3"
                    >
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-semibold text-indigo">{milestone.title}</p>
                          <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${MILESTONE_COLOR[milestone.status] ?? ""}`}>
                            {milestone.status}
                          </span>
                        </div>
                        <p className="mt-0.5 text-xs text-muted">{formatMoney(milestone.amountCents)}</p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {deal.status === "held" && milestone.status === "pending" ? (
                          <form action={actionSubmitMilestone}>
                            <input type="hidden" name="dealId" value={deal.id} />
                            <input type="hidden" name="milestoneId" value={milestone.id} />
                            <button type="submit" className="rounded-xl border border-border bg-white px-3 py-1.5 text-xs font-semibold text-indigo hover:bg-lavender">
                              Submit work
                            </button>
                          </form>
                        ) : null}
                        {milestone.status === "submitted" ? (
                          <form action={actionApproveMilestone}>
                            <input type="hidden" name="dealId" value={deal.id} />
                            <input type="hidden" name="milestoneId" value={milestone.id} />
                            <button type="submit" className="btn-primary !px-3 !py-1.5 text-xs">
                              Approve work
                            </button>
                          </form>
                        ) : null}
                        {milestone.status === "approved" ? (
                          <p className="text-xs text-muted">Release waits for the provider.</p>
                        ) : null}
                        {deal.status === "held" && milestone.status !== "released" && milestone.status !== "refunded" ? (
                          deal.disputes?.some((dispute) => dispute.milestoneId === milestone.id || dispute.milestoneId == null) ? (
                            <p className="text-xs text-muted">Dispute open. Release waits until it is resolved.</p>
                          ) : (
                          <form action={actionOpenDispute} className="flex flex-wrap items-center gap-2">
                            <input type="hidden" name="dealId" value={deal.id} />
                            <input type="hidden" name="milestoneId" value={milestone.id} />
                            <select name="reasonId" className="rounded-lg border border-border px-2 py-1 text-xs" required>
                              {reasons.filter((reason) => reason.active).map((reason) => (
                                <option key={reason.id} value={reason.id}>
                                  {reason.label}
                                </option>
                              ))}
                            </select>
                            <input name="details" required minLength={8} placeholder="What happened" className="rounded-lg border border-border px-2 py-1 text-xs" />
                            <button type="submit" className="rounded-xl border border-border bg-white px-3 py-1.5 text-xs font-semibold text-indigo">
                              Open dispute
                            </button>
                          </form>
                          )
                        ) : null}
                      </div>
                    </li>
                  ))}
                </ul>
              </article>
            );
          })}
        </section>

        <p className="text-center text-sm text-muted">
          Admin ops:{" "}
          <Link href="/admin/marketplace" className="font-semibold text-violet hover:underline">
            Marketplace ledger
          </Link>
          {" · "}
          <Link href="/trust" className="font-semibold text-violet hover:underline">
            Trust &amp; disputes
          </Link>
          {" · "}
          <Link href="/billing" className="font-semibold text-violet hover:underline">
            Plan billing
          </Link>
        </p>
      </div>
    </div>
  );
}
