import Link from "next/link";
import { redirect } from "next/navigation";
import { Panel, StatCard, StatusPill } from "@/components/dashboard-ui";
import { IconWallet } from "@/components/icons";
import { getAccountSession } from "@/lib/accounts";
import { draftToSeedCreator, getCreatorSessionDraft } from "@/lib/claim";
import { loadCreatorHub } from "@/lib/collaboration-hub";
import { prisma } from "@/lib/db";
import { formatMoney } from "@/lib/money";

export const dynamic = "force-dynamic";
export const metadata = { title: "Earnings" };

export default async function CreatorEarningsPage() {
  const account = await getAccountSession();
  if (!account) redirect("/login?next=/creator/earnings");

  const [creator, draft] = await Promise.all([
    prisma.creator.findUnique({ where: { userId: account.id }, select: { slug: true, displayName: true } }).catch(() => null),
    getCreatorSessionDraft().catch(() => null),
  ]);

  const seed = draft ? draftToSeedCreator(draft) : null;
  const hub =
    creator && seed
      ? await loadCreatorHub({ userId: account.id, creator: seed }).catch(() => null)
      : null;

  const released = hub?.earnings.releasedCents ?? 0;
  const held = hub?.earnings.heldCents ?? 0;
  const currency = hub?.earnings.currency || "USD";
  const pipeline = hub?.pipeline ?? [];
  const payoutReady = Boolean(hub?.payout.readiness?.globalPayoutReady || hub?.payout.readiness?.hasVerifiedMethod);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-3xl font-bold">Earnings</h1>
        <p className="mt-1 text-sm text-muted">
          Released and held collaboration funds for this influencer account. Amounts come from the marketplace ledger —
          not estimates.
        </p>
      </div>

      <section className="grid gap-3 sm:grid-cols-3">
        <StatCard
          label="Released"
          value={formatMoney(released, currency)}
          note="Paid out or cleared to you"
          tone="emerald"
          icon={<IconWallet size={16} />}
        />
        <StatCard
          label="Held"
          value={formatMoney(held, currency)}
          note="In collaboration holding"
          tone="amber"
          icon={<IconWallet size={16} />}
        />
        <StatCard
          label="Payout status"
          value={payoutReady ? "Ready" : "Setup needed"}
          note={payoutReady ? "Identity and payout method on file" : "Finish payout methods to receive funds"}
          tone={payoutReady ? "violet" : "blue"}
          icon={<IconWallet size={16} />}
        />
      </section>

      <Panel
        title="Collaboration payouts"
        action={<Link href="/billing#payouts" className="text-xs font-semibold text-violet hover:underline">Payout methods</Link>}
      >
        {pipeline.length === 0 ? (
          <p className="text-sm text-muted">
            No collaboration pipeline items yet. When brands fund a deal, released and held amounts show here.
          </p>
        ) : (
          <ul className="space-y-3">
            {pipeline.map((item) => (
              <li key={item.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#F0F3FA] px-3 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{item.title}</p>
                  <p className="text-xs text-muted">{item.counterparty}</p>
                  {item.revisionSummary ? <p className="mt-1 text-xs text-muted">{item.revisionSummary}</p> : null}
                </div>
                <div className="text-right">
                  <StatusPill
                    tone={
                      item.stage === "Released"
                        ? "success"
                        : item.stage === "Funded" || item.stage === "In Progress"
                          ? "info"
                          : "violet"
                    }
                  >
                    {item.stage}
                  </StatusPill>
                  {typeof item.feeCents === "number" && item.currency ? (
                    <p className="mt-1 text-xs text-muted">Fee {formatMoney(item.feeCents, item.currency)}</p>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <div className="flex flex-wrap gap-2">
        <Link href="/billing#payouts" className="btn-primary !py-2 text-sm">
          Manage payout methods
        </Link>
        <Link href="/collaboration/hub#pipeline" className="btn-secondary !py-2 text-sm">
          Collaboration pipeline
        </Link>
      </div>
    </div>
  );
}
