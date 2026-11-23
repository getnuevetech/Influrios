/**
 * Milestone release on Stripe (separate charges and transfers).
 *
 * The business's full payment sits in the Influrios platform balance (the Collaborations account).
 * When a milestone is released:
 *   1. the influencer's net amount is transferred to their Stripe connected account, and
 *   2. that milestone's platform fees (business + influencer share) are transferred to the
 *      Influrios-owned Operations connected account.
 * Each transfer is tied to the original charge (source_transaction) and is posted to the ledger
 * only after Stripe returns the transfer object. Idempotency keys make retries safe.
 */
import { prisma } from "@/lib/db";

const ACCOUNT = /^acct_[A-Za-z0-9]+$/;
const CHECKOUT_SESSION = /^cs_[A-Za-z0-9_]+$/;

export type StripeReleaseConfig =
  | { ok: true; secret: string; operationsAccountId: string }
  | { ok: false; reason: string };

/** Stripe key and Operations account are both required; otherwise releases stay external. */
export async function stripeReleaseConfig(): Promise<StripeReleaseConfig> {
  const { stripeCredentials } = await import("@/lib/stripe-admin");
  const creds = await stripeCredentials().catch(() => null);
  if (!creds?.ok) return { ok: false, reason: "Stripe is not connected." };
  const settings = await prisma.marketplaceSettings.findUnique({ where: { id: "default" } }).catch(() => null);
  const operations = (settings?.operationsStripeAccountId ?? "").trim();
  if (!ACCOUNT.test(operations)) return { ok: false, reason: "The Operations Stripe account is not set." };
  return { ok: true, secret: creds.secret, operationsAccountId: operations };
}

/** Body for POST /v1/transfers. Amounts are integer minor units. */
export function transferBody(input: {
  amountCents: number;
  currency: string;
  destination: string;
  chargeId: string;
  fundingId: string;
  milestoneId: string;
  purpose: "influencer_payout" | "platform_fees";
}) {
  if (!Number.isInteger(input.amountCents) || input.amountCents <= 0) throw new Error("A transfer needs a positive amount.");
  if (!ACCOUNT.test(input.destination)) throw new Error("The destination is not a Stripe connected account.");
  if (!/^(ch|py)_[A-Za-z0-9]+$/.test(input.chargeId)) throw new Error("The original charge is missing.");
  const body = new URLSearchParams();
  body.set("amount", String(input.amountCents));
  body.set("currency", input.currency.toLowerCase());
  body.set("destination", input.destination);
  body.set("source_transaction", input.chargeId);
  body.set("transfer_group", input.fundingId);
  body.set("metadata[fundingId]", input.fundingId);
  body.set("metadata[milestoneId]", input.milestoneId);
  body.set("metadata[purpose]", input.purpose);
  return body;
}

/** Unsettled milestone fees that are due to Operations, from posted ledger entries. */
export async function unsettledFeeCents(fundingId: string) {
  const { eligiblePlatformFeePosition } = await import("@/lib/payment-engine");
  const entries = await prisma.ledgerEntry.findMany({
    where: { fundingId },
    select: { kind: true, amountCents: true, party: true, milestoneId: true },
  });
  const position = eligiblePlatformFeePosition(entries);
  return (
    Math.max(0, position.eligibleBusinessCents - position.settledBusinessCents) +
    Math.max(0, position.eligibleInfluencerCents - position.settledInfluencerCents)
  );
}

async function chargeForFunding(fundingId: string, secret: string) {
  const deposit = await prisma.fundingDeposit.findFirst({
    where: { fundingId, status: "confirmed", method: { in: ["card", "ach_online", "bank_transfer"] } },
    orderBy: { confirmedAt: "desc" },
    select: { reference: true },
  });
  const session = deposit?.reference?.trim() ?? "";
  if (!CHECKOUT_SESSION.test(session)) return { ok: false as const, error: "No confirmed Stripe deposit for this funding." };
  const { stripeGet } = await import("@/lib/stripe-admin");
  const read = await stripeGet(`/v1/checkout/sessions/${session}?expand[]=payment_intent`, secret);
  if (!read.ok) return { ok: false as const, error: read.error };
  const intent = read.payload.payment_intent as { latest_charge?: unknown } | string | null;
  const charge = intent && typeof intent === "object" ? String(intent.latest_charge ?? "") : "";
  if (!charge) return { ok: false as const, error: "Stripe has no charge for this deposit yet." };
  return { ok: true as const, chargeId: charge };
}

async function transfer(secret: string, body: URLSearchParams, idempotencyKey: string) {
  const { stripeApiRequest } = await import("@/lib/stripe-admin");
  return stripeApiRequest({ method: "POST", path: "/v1/transfers", secret, body, idempotencyKey });
}

async function audit(action: string, objectId: string, after: Record<string, unknown>) {
  await prisma.auditLog
    .create({ data: { actor: "system", action, objectType: "CollaborationFunding", objectId, after: after as never } })
    .catch(() => undefined);
}

/** Send any milestone fees that are due but not yet with Operations. Safe to call repeatedly. */
export async function settleFeesToOperations(input: { fundingId: string; milestoneId: string; config?: StripeReleaseConfig }) {
  const config = input.config ?? (await stripeReleaseConfig());
  if (!config.ok) return { ok: false as const, error: config.reason };
  const funding = await prisma.collaborationFunding.findUnique({ where: { id: input.fundingId } });
  if (!funding) return { ok: false as const, error: "Funding not found." };
  const due = await unsettledFeeCents(funding.id);
  if (due <= 0) return { ok: true as const, settledCents: 0 };
  const charge = await chargeForFunding(funding.id, config.secret);
  if (!charge.ok) return charge;
  const sent = await transfer(
    config.secret,
    transferBody({
      amountCents: due,
      currency: funding.currency,
      destination: config.operationsAccountId,
      chargeId: charge.chargeId,
      fundingId: funding.id,
      milestoneId: input.milestoneId,
      purpose: "platform_fees",
    }),
    `ops-${funding.id}-${due}-${input.milestoneId}`,
  );
  if (!sent.ok) {
    await audit("operations_fee_transfer_failed", funding.id, { milestoneId: input.milestoneId, amountCents: due, error: sent.error });
    return { ok: false as const, error: sent.error };
  }
  const { applyMarketplaceEvent } = await import("@/lib/marketplace-ledger");
  await applyMarketplaceEvent({
    provider: funding.providerCode,
    eventId: sent.id,
    eventType: "fee.settled",
    fundingId: funding.id,
    amountCents: due,
    currency: funding.currency,
  });
  await audit("operations_fee_transferred", funding.id, { milestoneId: input.milestoneId, amountCents: due, transferId: sent.id });
  return { ok: true as const, settledCents: due, transferId: sent.id };
}

/**
 * Release one milestone: influencer net to their connected account, then the milestone's fees to
 * Operations. Returns execution "provider" when Stripe moved the money.
 */
export async function releaseMilestoneOnStripe(input: { fundingId: string; milestoneId: string; amountCents: number }) {
  const config = await stripeReleaseConfig();
  if (!config.ok) return { ok: false as const, error: config.reason, configured: false as const };
  const funding = await prisma.collaborationFunding.findUnique({ where: { id: input.fundingId } });
  if (!funding) return { ok: false as const, error: "Funding not found.", configured: true as const };
  const creator = await prisma.creator.findUnique({
    where: { slug: funding.creatorSlug },
    select: { id: true, payoutProfile: { select: { stripeConnectAccountId: true } } },
  });
  const influencerAccount = creator?.payoutProfile?.stripeConnectAccountId?.trim() ?? "";
  if (!creator || !ACCOUNT.test(influencerAccount)) {
    return { ok: false as const, error: "The influencer has not finished Stripe payout setup.", configured: true as const };
  }
  // Stripe must report the influencer verified with payouts enabled before any money moves to them.
  const { refreshCreatorConnectStatus } = await import("@/lib/stripe-connect-status");
  const reading = await refreshCreatorConnectStatus(creator.id);
  if (!reading.ok || reading.status !== "VERIFIED") {
    return {
      ok: false as const,
      error: "Stripe has not verified the influencer's payout account yet. Nothing was transferred.",
      configured: true as const,
    };
  }
  const charge = await chargeForFunding(funding.id, config.secret);
  if (!charge.ok) return { ...charge, configured: true as const };
  const sent = await transfer(
    config.secret,
    transferBody({
      amountCents: input.amountCents,
      currency: funding.currency,
      destination: influencerAccount,
      chargeId: charge.chargeId,
      fundingId: funding.id,
      milestoneId: input.milestoneId,
      purpose: "influencer_payout",
    }),
    `inf-${input.milestoneId}-${input.amountCents}`,
  );
  if (!sent.ok) {
    await audit("influencer_transfer_failed", funding.id, { milestoneId: input.milestoneId, amountCents: input.amountCents, error: sent.error });
    return { ok: false as const, error: sent.error, configured: true as const };
  }
  const { applyMarketplaceEvent } = await import("@/lib/marketplace-ledger");
  await applyMarketplaceEvent({
    provider: funding.providerCode,
    eventId: sent.id,
    eventType: "payout.released",
    fundingId: funding.id,
    amountCents: input.amountCents,
    currency: funding.currency,
    milestoneId: input.milestoneId,
  });
  await audit("influencer_transferred", funding.id, { milestoneId: input.milestoneId, amountCents: input.amountCents, transferId: sent.id });
  // Fees follow the payout; if this transfer fails it is retried by the release sweep.
  await settleFeesToOperations({ fundingId: funding.id, milestoneId: input.milestoneId, config });
  return { ok: true as const, reference: sent.id, execution: "provider" as const, configured: true as const };
}
