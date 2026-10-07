import { countryCodeFromLocation } from "@/lib/contract-wizard";
import { prisma } from "@/lib/db";
import { readShareSnapshot } from "@/lib/fx-share";
import { parseApprovedProviderIds } from "@/lib/jurisdiction-capabilities";
import type { PaymentProviderAdapter } from "@/lib/payment-provider-adapter";
import { loadAirwallexConfig } from "@/lib/providers/airwallex-config";
import {
  cancelAirwallexFunding,
  createAirwallexConnectedAccount,
  createAirwallexFunding,
  createAirwallexIntroFeeIntent,
  fundingSplitPlan,
  getAirwallexFundingStatus,
  getAirwallexPayoutStatus,
  jurisdictionAllowsAirwallexIntent,
  loginAirwallex,
  parseAirwallexWebhook,
  reconcileAirwallexTransaction,
  refundAirwallexPayment,
  releaseAirwallexSplit,
  splitIdsForMilestone,
  verifyAirwallexSignature,
  type AirwallexSplit,
} from "@/lib/providers/airwallex";

async function session() {
  const settings = await loadAirwallexConfig();
  if (!settings) return { ok: false as const, error: "Save and enable the Airwallex client id, API key, and base URL in admin. Nothing was charged." };
  const login = await loginAirwallex({ baseUrl: settings.baseUrl, clientId: settings.clientId, apiKey: settings.apiKey });
  if (!login.ok) return login;
  return { ok: true as const, settings, token: login.token };
}

async function connectedAccountForSlug(slug: string) {
  const creator = await prisma.creator.findUnique({
    where: { slug },
    select: { payoutProfile: { select: { providerConnectedAccountId: true } } },
  });
  return creator?.payoutProfile?.providerConnectedAccountId?.trim() || "";
}

function splitMap(splits: AirwallexSplit[], splitIds: string[]) {
  const map: Record<string, string[]> = {};
  splits.forEach((split, index) => {
    const id = splitIds[index];
    if (!id) return;
    map[split.milestoneId] = [...(map[split.milestoneId] ?? []), id];
  });
  return map;
}

/** Opens the payment and stores the payment id and split ids. Does not mark the funding held. */
export async function openAirwallexFundingCollection(input: {
  fundingId: string;
}): Promise<{ ok: true; reference: string; url?: string } | { ok: false; error: string }> {
  const funding = await prisma.collaborationFunding.findUnique({
    where: { id: input.fundingId },
    include: { milestones: { orderBy: { sortOrder: "asc" } } },
  });
  if (!funding || funding.status !== "awaiting_provider") {
    return { ok: false, error: "This funding is not waiting for a provider. Nothing was charged." };
  }
  const jurisdiction = await prisma.collaborationJurisdiction.findUnique({ where: { code: funding.jurisdictionCode } });
  const allowed = jurisdictionAllowsAirwallexIntent(parseApprovedProviderIds(jurisdiction?.approvedProviderIds));
  if (!allowed.ok) return allowed;
  const primaryAccount = await connectedAccountForSlug(funding.creatorSlug);
  const parties = readShareSnapshot(funding.shareSnapshotJson);
  const resolved: { label: string; shareBps: number; connectedAccountId: string }[] = [];
  if (parties && parties.length >= 2) {
    for (const party of parties) {
      const accountId = await connectedAccountForSlug(party.label);
      if (accountId) resolved.push({ ...party, connectedAccountId: accountId });
    }
  }
  const teamParties = resolved.length >= 2 && parties && resolved.length === parties.length ? resolved : null;
  if (!teamParties && !primaryAccount) {
    return { ok: false, error: "Add the creator's connected account before opening checkout. Nothing was charged." };
  }
  const plan = fundingSplitPlan({
    milestones: funding.milestones.map((milestone) => ({
      id: milestone.id,
      amountCents: milestone.amountCents,
      title: milestone.title,
    })),
    grossCents: funding.grossCents,
    feeCents: funding.feeCents,
    financialPlan: (funding.feeSnapshotJson as { financialPlan?: unknown } | null)?.financialPlan,
    connectedAccountId: primaryAccount,
    parties: teamParties,
  });
  if (!plan.ok) return plan;
  const auth = await session();
  if (!auth.ok) return auth;
  if (!auth.settings.holdingAccountId) {
    return { ok: false, error: "Save the Airwallex holding account id in admin. Nothing was charged." };
  }
  const opened = await createAirwallexFunding({
    baseUrl: auth.settings.baseUrl,
    token: auth.token,
    request: {
      fundingId: funding.id,
      amountCents: funding.grossCents,
      currency: funding.currency,
      holdingAccountId: auth.settings.holdingAccountId,
      splits: plan.splits,
    },
  });
  if (!opened.ok) return opened;
  if (opened.splitIds.length !== plan.splits.length) {
    return { ok: false, error: "Airwallex did not return a split id for every milestone. Nothing was stored." };
  }
  const mapped = splitMap(plan.splits, opened.splitIds);
  await prisma.$transaction(async (tx) => {
    await tx.collaborationFunding.update({
      where: { id: funding.id },
      data: { providerPaymentId: opened.paymentId, providerSplitJson: mapped },
    });
    for (const milestone of funding.milestones) {
      const ids = mapped[milestone.id] ?? [];
      if (ids[0]) {
        await tx.fundingMilestone.update({ where: { id: milestone.id }, data: { providerSplitId: ids[0] } });
      }
    }
  });
  return { ok: true, reference: opened.paymentId, url: opened.url };
}

export async function openIntroFeeCheckout(introId: string): Promise<
  { ok: true; paymentId: string; url?: string } | { ok: false; error: string }
> {
  const intro = await prisma.managedIntro.findUnique({ where: { id: introId } });
  if (!intro) return { ok: false, error: "Introduction not found." };
  if (!intro.feeIntentRef || intro.feeExpectedCents == null || intro.feeExpectedCents <= 0) {
    return { ok: false, error: "Request an intro fee quote before opening checkout. Nothing was charged." };
  }
  if (intro.status === "paid") return { ok: false, error: "This intro fee is already settled." };
  const auth = await session();
  if (!auth.ok) return auth;
  const opened = await createAirwallexIntroFeeIntent({
    baseUrl: auth.settings.baseUrl,
    token: auth.token,
    intentRef: intro.feeIntentRef,
    introId: intro.id,
    amountCents: intro.feeExpectedCents,
    currency: "USD",
  });
  if (!opened.ok) return opened;
  return opened;
}

/** Creates a connected account when the jurisdiction lists this rail, or returns the stored id. */
export async function openCreatorConnectedAccount(input: { userId: string; email?: string }): Promise<
  { ok: true; accountId: string; linked: boolean; url?: string } | { ok: false; error: string }
> {
  const creator = await prisma.creator.findUnique({
    where: { userId: input.userId },
    include: { payoutProfile: true },
  });
  if (!creator) {
    return { ok: false, error: "Create your Influencer Card before opening payout setup. Nothing was opened." };
  }
  const country = countryCodeFromLocation(creator.locationCountry);
  const jurisdiction = country
    ? await prisma.collaborationJurisdiction.findUnique({ where: { code: country } })
    : null;
  const allowed = jurisdictionAllowsAirwallexIntent(parseApprovedProviderIds(jurisdiction?.approvedProviderIds));
  if (!allowed.ok) return { ok: false, error: "This jurisdiction does not list Airwallex. Nothing was opened." };
  const existing = creator.payoutProfile?.providerConnectedAccountId?.trim() || "";
  if (existing) return { ok: true, accountId: existing, linked: true };
  const auth = await session();
  if (!auth.ok) {
    return {
      ok: false,
      error: auth.error.includes("Nothing was charged")
        ? auth.error.replace("Nothing was charged.", "Nothing was opened.")
        : auth.error,
    };
  }
  const email = input.email?.trim() || "";
  if (!email) return { ok: false, error: "An account email is required. Nothing was opened." };
  const created = await createAirwallexConnectedAccount({
    baseUrl: auth.settings.baseUrl,
    token: auth.token,
    email,
    requestId: `connect_${creator.id}`,
  });
  if (!created.ok) return created;
  await prisma.influencerPayoutProfile.upsert({
    where: { creatorId: creator.id },
    create: { creatorId: creator.id, providerConnectedAccountId: created.accountId },
    update: { providerConnectedAccountId: created.accountId },
  });
  return { ok: true, accountId: created.accountId, linked: false, url: created.url };
}

async function paymentIdForFunding(fundingId: string) {
  const funding = await prisma.collaborationFunding.findUnique({
    where: { id: fundingId },
    select: { providerPaymentId: true, grossCents: true },
  });
  if (!funding?.providerPaymentId) return { ok: false as const, error: "This funding has no provider payment id." };
  return { ok: true as const, paymentId: funding.providerPaymentId, grossCents: funding.grossCents };
}

export function createAirwallexPaymentAdapter(): PaymentProviderAdapter {
  return {
    async getCapabilities() {
      return { code: "airwallex", funding: true, release: true, partialRefund: true, webhook: true };
    },
    async createFundingIntent(input) {
      const opened = await openAirwallexFundingCollection({ fundingId: input.fundingId });
      if (!opened.ok) return opened;
      return { ok: true, reference: opened.reference };
    },
    async getFundingStatus(reference) {
      const auth = await session();
      if (!auth.ok) return { error: auth.error };
      const status = await getAirwallexFundingStatus({
        baseUrl: auth.settings.baseUrl,
        token: auth.token,
        paymentId: reference,
      });
      if (!status.ok) return { error: status.error };
      return { status: status.status };
    },
    async cancelFunding(reference) {
      const funding = await paymentIdForFunding(reference);
      const paymentId = funding.ok ? funding.paymentId : reference;
      const auth = await session();
      if (!auth.ok) return auth;
      const cancelled = await cancelAirwallexFunding({
        baseUrl: auth.settings.baseUrl,
        token: auth.token,
        paymentId,
        requestId: `cancel_${paymentId}`,
      });
      if (!cancelled.ok) return cancelled;
      return { ok: true, reference: cancelled.paymentId };
    },
    async createReleaseOrTransfer(input) {
      const funding = await prisma.collaborationFunding.findUnique({
        where: { id: input.fundingId },
        include: { milestones: { where: { id: input.milestoneId }, take: 1 } },
      });
      if (!funding) return { ok: false, error: "Prefund not found." };
      const milestone = funding.milestones[0];
      const splitIds = splitIdsForMilestone(funding.providerSplitJson, input.milestoneId, milestone?.providerSplitId);
      if (splitIds.length < 1) return { ok: false, error: "This milestone has no FundsSplit id. Nothing was released." };
      const auth = await session();
      if (!auth.ok) return auth;
      for (const splitId of splitIds) {
        const released = await releaseAirwallexSplit({
          baseUrl: auth.settings.baseUrl,
          token: auth.token,
          splitId,
          requestId: `release_${input.fundingId}_${input.milestoneId}_${splitId}`,
        });
        if (!released.ok) return released;
      }
      return { ok: true, reference: splitIds.join(",") };
    },
    async createPartialRefund(input) {
      const funding = await paymentIdForFunding(input.fundingId);
      if (!funding.ok) return funding;
      const auth = await session();
      if (!auth.ok) return auth;
      const refunded = await refundAirwallexPayment({
        baseUrl: auth.settings.baseUrl,
        token: auth.token,
        paymentId: funding.paymentId,
        requestId: `refund_${input.fundingId}_${input.amountCents}_${input.milestoneId ?? "funding"}`,
        amountCents: input.amountCents,
      });
      if (!refunded.ok) return refunded;
      return { ok: true, reference: refunded.refundId };
    },
    async createFullRefund(input) {
      const funding = await paymentIdForFunding(input.fundingId);
      if (!funding.ok) return funding;
      const auth = await session();
      if (!auth.ok) return auth;
      const refunded = await refundAirwallexPayment({
        baseUrl: auth.settings.baseUrl,
        token: auth.token,
        paymentId: funding.paymentId,
        requestId: `refund_full_${input.fundingId}`,
      });
      if (!refunded.ok) return refunded;
      return { ok: true, reference: refunded.refundId };
    },
    async getPayoutStatus(reference) {
      const auth = await session();
      if (!auth.ok) return { error: auth.error };
      const status = await getAirwallexPayoutStatus({
        baseUrl: auth.settings.baseUrl,
        token: auth.token,
        splitId: reference,
      });
      if (!status.ok) return { error: status.error };
      return { status: status.status };
    },
    verifyWebhook(body, signature, secret) {
      return verifyAirwallexSignature(body, signature, secret);
    },
    parseWebhook(body) {
      const parsed = parseAirwallexWebhook(body);
      if (!parsed.ok) return { error: parsed.error };
      return {
        provider: "airwallex",
        eventId: parsed.eventId,
        eventType: parsed.eventType,
        fundingId: parsed.fundingId,
        amountCents: parsed.amountCents,
        milestoneId: parsed.milestoneId,
      };
    },
    async reconcileTransaction(reference) {
      const auth = await session();
      if (!auth.ok) return auth;
      const reconciled = await reconcileAirwallexTransaction({
        baseUrl: auth.settings.baseUrl,
        token: auth.token,
        paymentId: reference,
      });
      if (!reconciled.ok) return reconciled;
      await prisma.auditLog
        .create({
          data: {
            actor: "airwallex",
            action: "provider_reconcile",
            objectType: "CollaborationFunding",
            objectId: reference.slice(0, 120),
            after: { status: reconciled.status, ledgerUnchanged: true },
          },
        })
        .catch(() => undefined);
      return { ok: true };
    },
  };
}
