import Link from "next/link";
import { redirect } from "next/navigation";
import { CreatorPayoutMethodsPanel } from "@/components/creator-payout-methods";
import { Panel, StatCard, StatusPill } from "@/components/dashboard-ui";
import { IconWallet } from "@/components/icons";
import { getAccountSession } from "@/lib/accounts";
import { draftToSeedCreator, getCreatorSessionDraft } from "@/lib/claim";
import { loadCreatorHub } from "@/lib/collaboration-hub";
import { prisma } from "@/lib/db";
import { formatMoney } from "@/lib/money";
import { resolvePayoutOnboardingRail } from "@/lib/payout-readiness";
import { loadAirwallexConfig } from "@/lib/providers/airwallex-config";
import { stripeConnectReady } from "@/lib/stripe-admin";

export const dynamic = "force-dynamic";
export const metadata = { title: "Earnings" };

type Props = { searchParams: Promise<{ error?: string; connected?: string }> };

/** Provider/config errors that should surface on Earnings payout setup. */
function memberFacingPayoutError(raw: string | undefined) {
  const message = raw?.trim() ?? "";
  if (!message) return undefined;
  if (/^</.test(message) || /<!DOCTYPE/i.test(message) || /<html[\s>]/i.test(message)) {
    return "Payout setup could not reach the payment provider. Ask an admin to check credentials and base URL on Payment gateways.";
  }
  if (/^Airwallex[:\s]/i.test(message) || /Airwallex rejected/i.test(message)) return message;
  if (/hosted onboarding is not configured/i.test(message) || /hosted flow template/i.test(message)) return message;
  if (/HTML instead of JSON/i.test(message) || /Check the base URL/i.test(message)) return message;
  if (/Stripe Connect is not ready/i.test(message)) return undefined;
  if (/Nothing was opened/i.test(message) && /Stripe|Connect|portal/i.test(message)) return undefined;
  return message;
}

export default async function CreatorEarningsPage({ searchParams }: Props) {
  const account = await getAccountSession();
  if (!account) redirect("/login?next=/creator/earnings");
  const params = await searchParams;

  const [creator, draft, identity, connectReady, airwallexConfig] = await Promise.all([
    prisma.creator.findUnique({ where: { userId: account.id }, select: { slug: true, displayName: true } }).catch(() => null),
    getCreatorSessionDraft().catch(() => null),
    prisma.user
      .findUnique({
        where: { id: account.id },
        select: {
          creator: {
            select: {
              locationCountry: true,
              identityVerified: true,
              payoutProfile: {
                select: {
                  stripeConnectAccountId: true,
                  providerConnectedAccountId: true,
                  primaryCountryCode: true,
                },
              },
            },
          },
        },
      })
      .catch(() => null),
    stripeConnectReady().catch(() => false),
    loadAirwallexConfig().catch(() => null),
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

  const hasConnectAccount = Boolean(identity?.creator?.payoutProfile?.stripeConnectAccountId);
  const hasProviderAccount = Boolean(identity?.creator?.payoutProfile?.providerConnectedAccountId);
  const payoutRail = identity?.creator
    ? await resolvePayoutOnboardingRail({
        locationCountry: identity.creator.locationCountry,
        fallbackCountryCode: identity.creator.payoutProfile?.primaryCountryCode,
        stripeConnectReady: connectReady,
        providerReady: Boolean(airwallexConfig),
        hasStripeConnectAccount: hasConnectAccount,
        hasProviderAccount,
      }).catch(() => null)
    : null;

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

      {identity?.creator ? (
        <CreatorPayoutMethodsPanel
          rail={payoutRail}
          hasStripeConnectAccount={hasConnectAccount}
          hasProviderAccount={hasProviderAccount}
          stripeConnectAccountId={identity.creator.payoutProfile?.stripeConnectAccountId}
          providerConnectedAccountId={identity.creator.payoutProfile?.providerConnectedAccountId}
          locationCountry={identity.creator.locationCountry}
          identityVerified={identity.creator.identityVerified === "VERIFIED"}
          payoutReady={payoutReady}
          error={memberFacingPayoutError(params.error)}
          notice={params.connected ? "Connected account saved on your payout profile." : undefined}
        />
      ) : (
        <section id="payouts" className="rounded-3xl border border-[#E6ECF7] bg-white p-5 shadow-sm">
          <h2 className="font-display text-base font-bold">Payout methods</h2>
          <p className="mt-1 text-sm text-muted">Create your Influencer Card first, then open payout setup here.</p>
          <Link href="/claim" className="btn-primary mt-3 inline-flex !py-2 text-sm">
            Create your card
          </Link>
        </section>
      )}

      <Panel title="Collaboration payouts">
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
        <Link href="/creator/earnings#payouts" className="btn-secondary !py-2 text-sm">
          Jump to payout methods
        </Link>
        <Link href="/collaboration/hub?view=collaborations#pipeline" className="btn-secondary !py-2 text-sm">
          Collaboration pipeline
        </Link>
      </div>
    </div>
  );
}
