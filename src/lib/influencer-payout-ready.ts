import { prisma } from "@/lib/db";

/**
 * An influencer can be paid when a payout account is connected and its primary check is not unverified.
 * Funding and milestone approval both use this, so a deal is never funded for someone who cannot be paid.
 */
export function payoutProfileReady(profile: {
  stripeConnectAccountId?: string | null;
  providerConnectedAccountId?: string | null;
  primaryStatus?: string | null;
} | null | undefined): boolean {
  return Boolean(profile?.stripeConnectAccountId || profile?.providerConnectedAccountId) && profile?.primaryStatus !== "UNVERIFIED";
}

export async function influencerPayoutReady(creatorSlug: string): Promise<{ ready: boolean; name: string }> {
  const creator = await prisma.creator.findUnique({
    where: { slug: creatorSlug },
    select: { displayName: true, payoutProfile: { select: { stripeConnectAccountId: true, providerConnectedAccountId: true, primaryStatus: true } } },
  });
  return { ready: payoutProfileReady(creator?.payoutProfile), name: creator?.displayName || "The influencer" };
}

/** Tell the influencer a business is waiting on their payout setup (in-app notice; repeats re-surface it). */
export async function notifyPayoutSetupNeeded(input: { creatorSlug: string; businessName: string; title: string; documentId: string }) {
  const creator = await prisma.creator.findUnique({ where: { slug: input.creatorSlug }, select: { userId: true } });
  if (!creator?.userId) return;
  const kind = "payout_setup_needed";
  const sourceId = `${kind}:${input.documentId}`;
  const title = `${input.businessName} is ready to fund your collaboration`;
  const detail = `${input.title} · Finish payout setup so they can fund it. Nothing is charged until you do`;
  await prisma.accountNotice
    .upsert({
      where: { userId_kind_sourceId: { userId: creator.userId, kind, sourceId } },
      create: { userId: creator.userId, kind, sourceId, title, detail, href: "/creator/earnings#payouts" },
      update: { title, detail, readAt: null, createdAt: new Date() },
    })
    .catch((error) => console.error("payout setup notice", error));
}
