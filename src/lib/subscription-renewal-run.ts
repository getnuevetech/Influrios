import { prisma } from "@/lib/db";
import { annualOfferKey, skuForPlanCode } from "@/lib/billing-interval";
import { getAppOrigin, getProduct, listAnnualOffers } from "@/lib/billing";
import { planLabel } from "@/lib/entitlements";
import { emailPreference } from "@/lib/email-live";
import { sendMail } from "@/lib/mail";
import { readStripeSubscription, stripeCredentials, updateSubscriptionCancelAtPeriodEnd } from "@/lib/stripe-admin";
import {
  applyAutoRenew,
  autoRenewWrite,
  billingViewFromStored,
  deliverRenewalNotices,
  formatSubscriptionPrice,
  presentBillingPlan,
  renewalNoticeDue,
  subscriptionAmountCents,
  type BillingPlanView,
  type RenewalNoticeKind,
  type RenewalNoticeLedger,
  type RenewalNoticeRecord,
  type RenewalSubscription,
} from "@/lib/subscription-renewal";

const DAY_MS = 86_400_000;

function daysUntil(now: Date, renewsAt: Date) {
  const start = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const end = Date.UTC(renewsAt.getUTCFullYear(), renewsAt.getUTCMonth(), renewsAt.getUTCDate());
  return Math.round((end - start) / DAY_MS);
}

function namedPlan(sku: string, planCode: string, hasSubscription: boolean) {
  const product = sku ? getProduct(sku) : undefined;
  const fromProduct = product?.creatorPlan
    ? planLabel(product.creatorPlan)
    : product?.businessPlan
      ? planLabel(product.businessPlan)
      : "";
  const fallback = planLabel(planCode) || planCode || "Starter";
  return { product, name: (hasSubscription ? fromProduct : "") || fallback };
}

async function monthlyAmount(sku: string, planCode: string, productAmount: number | null) {
  if (productAmount != null) return productAmount;
  if (sku) {
    const bySku = await prisma.entitlementPlan.findUnique({ where: { code: sku }, select: { amountCents: true } }).catch(() => null);
    if (bySku) return bySku.amountCents;
  }
  const byCode = await prisma.entitlementPlan.findUnique({ where: { code: planCode }, select: { amountCents: true } }).catch(() => null);
  if (byCode) return byCode.amountCents;
  if (planCode === "STARTER" || planCode === "BUSINESS_FREE") return 0;
  return null;
}

async function annualAmount(sku: string) {
  if (!sku) return null;
  const offers = await listAnnualOffers().catch(() => ({} as Partial<Record<string, { amountCents: number }>>));
  return offers[sku]?.amountCents ?? offers[annualOfferKey(sku)]?.amountCents ?? null;
}

function prismaNoticeLedger(): RenewalNoticeLedger {
  return {
    async find(subscriptionId, renewsAt, kind) {
      const row = await prisma.subscriptionRenewalNotice.findUnique({
        where: {
          subscriptionId_renewsAt_kind: {
            subscriptionId,
            renewsAt: new Date(renewsAt),
            kind,
          },
        },
      });
      if (!row) return null;
      return noticeFromRow(row);
    },
    async save(record) {
      const renewsAt = new Date(record.renewsAt);
      const data = {
        status: record.status,
        reason: record.reason.slice(0, 500),
      };
      await prisma.subscriptionRenewalNotice.upsert({
        where: {
          subscriptionId_renewsAt_kind: {
            subscriptionId: record.subscriptionId,
            renewsAt,
            kind: record.kind,
          },
        },
        create: {
          subscriptionId: record.subscriptionId,
          renewsAt,
          kind: record.kind,
          ...data,
        },
        update: data,
      });
    },
  };
}

function noticeFromRow(row: { subscriptionId: string; renewsAt: Date; kind: string; status: string; reason: string }): RenewalNoticeRecord {
  const kind: RenewalNoticeKind = row.kind === "7d" || row.kind === "3d" || row.kind === "day" ? row.kind : "day";
  return {
    subscriptionId: row.subscriptionId,
    renewsAt: row.renewsAt.toISOString(),
    kind,
    status: row.status === "sent" ? "sent" : "unsent",
    reason: row.reason,
  };
}

export async function loadAccountBillingView(input: { userId: string; planCode: string }): Promise<BillingPlanView> {
  const planCode = input.planCode.trim() || "STARTER";
  const fallbackName = planLabel(planCode) || planCode || "Starter";
  try {
    const subscription = await prisma.subscriptionState.findFirst({
      where: { userId: input.userId },
      orderBy: { updatedAt: "desc" },
    });
    const sku = subscription?.sku || skuForPlanCode(planCode) || "";
    const named = namedPlan(sku, planCode, Boolean(subscription));
    const monthly = await monthlyAmount(sku, planCode, named.product?.amountCents ?? null);
    const interval = subscription?.billingInterval === "year" ? "year" : subscription?.billingInterval === "month" ? "month" : null;
    const annual = interval === "year" ? await annualAmount(sku) : null;
    let stripe: { periodStart: string | null; periodEnd: string | null } | null = null;
    let cancelAtPeriodEnd = subscription?.cancelAtPeriodEnd ?? false;
    if (subscription?.provider === "stripe" && /^sub_[A-Za-z0-9]+$/.test(subscription.externalId)) {
      const creds = await stripeCredentials();
      if (creds.ok) {
        const read = await readStripeSubscription(creds.secret, subscription.externalId);
        if (read.ok) {
          stripe = {
            periodStart: read.subscription.periodStart != null ? new Date(read.subscription.periodStart * 1000).toISOString() : null,
            periodEnd: read.subscription.periodEnd != null ? new Date(read.subscription.periodEnd * 1000).toISOString() : null,
          };
          cancelAtPeriodEnd = read.subscription.cancelAtPeriodEnd;
          await prisma.subscriptionState
            .update({
              where: { id: subscription.id },
              data: {
                ...(read.subscription.periodStart != null ? { currentPeriodStart: new Date(read.subscription.periodStart * 1000) } : {}),
                ...(read.subscription.periodEnd != null ? { currentPeriodEnd: new Date(read.subscription.periodEnd * 1000) } : {}),
                cancelAtPeriodEnd: read.subscription.cancelAtPeriodEnd,
              },
            })
            .catch(() => undefined);
        }
      }
    }
    const amountCents = subscription
      ? subscriptionAmountCents({ interval, monthlyAmountCents: monthly, annualAmountCents: annual })
      : monthly;
    return billingViewFromStored({
      planName: named.name || fallbackName,
      billingInterval: subscription ? interval : null,
      amountCents,
      currentPeriodStart: subscription?.currentPeriodStart?.toISOString() ?? null,
      currentPeriodEnd: subscription?.currentPeriodEnd?.toISOString() ?? null,
      cancelAtPeriodEnd: subscription ? cancelAtPeriodEnd : false,
      provider: subscription?.provider ?? "",
      externalId: subscription?.externalId ?? "",
      stripe,
    });
  } catch {
    return presentBillingPlan({
      planName: fallbackName,
      interval: null,
      amountCents: null,
      startedAt: null,
      renewsAt: null,
      cancelAtPeriodEnd: false,
      hasSubscription: false,
      canToggle: false,
    });
  }
}

export async function setSubscriptionAutoRenew(input: { userId: string; turnOn: boolean }) {
  const subscription = await prisma.subscriptionState.findFirst({
    where: { userId: input.userId },
    orderBy: { updatedAt: "desc" },
  });
  if (!subscription || subscription.provider !== "stripe" || !/^sub_[A-Za-z0-9]+$/.test(subscription.externalId)) {
    return { ok: false as const, error: "Resolve the subscription reference before changing it. Nothing was changed." };
  }
  const creds = await stripeCredentials();
  if (!creds.ok) {
    return { ok: false as const, error: "Stripe is not ready. Nothing was changed." };
  }
  const renewsAt = subscription.currentPeriodEnd?.toISOString() ?? null;
  const updated = await updateSubscriptionCancelAtPeriodEnd({
    secret: creds.secret,
    subscriptionId: subscription.externalId,
    cancelAtPeriodEnd: !input.turnOn,
    idempotencyKey: `auto-renew:${subscription.externalId}:${input.turnOn ? "on" : "off"}:${Date.now()}`,
  });
  const decision = applyAutoRenew({
    turnOn: input.turnOn,
    renewsAt,
    previousCancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
    providerConfirmed: updated.ok,
  });
  const write = autoRenewWrite(decision);
  if (!updated.ok || !write) {
    return {
      ok: false as const,
      error: updated.ok ? "Stripe did not update the subscription. Nothing was changed." : updated.error,
    };
  }
  await prisma.subscriptionState.update({
    where: { id: subscription.id },
    data: {
      ...write,
      ...(subscription.currentPeriodStart == null && updated.periodStart != null
        ? { currentPeriodStart: new Date(updated.periodStart * 1000) }
        : {}),
      ...(subscription.currentPeriodEnd == null && updated.periodEnd != null
        ? { currentPeriodEnd: new Date(updated.periodEnd * 1000) }
        : {}),
    },
  });
  return { ok: true as const, decision };
}

async function renewalTarget(
  row: {
    id: string;
    sku: string;
    status: string;
    provider: string;
    externalId: string;
    billingInterval: string;
    currentPeriodStart: Date | null;
    currentPeriodEnd: Date | null;
    cancelAtPeriodEnd: boolean;
    user: { email: string; planTier: string } | null;
  },
  now: Date,
): Promise<RenewalSubscription | null> {
  const email = row.user?.email?.trim() ?? "";
  if (!email) return null;
  let renewsAt = row.currentPeriodEnd?.toISOString() ?? null;
  let cancelAtPeriodEnd = row.cancelAtPeriodEnd;
  const renewsDate = renewsAt ? new Date(renewsAt) : null;
  const readStripe = row.provider === "stripe" && /^sub_[A-Za-z0-9]+$/.test(row.externalId) && (renewsDate == null || daysUntil(now, renewsDate) <= 8);
  if (readStripe) {
    const creds = await stripeCredentials();
    if (creds.ok) {
      const read = await readStripeSubscription(creds.secret, row.externalId);
      if (read.ok) {
        cancelAtPeriodEnd = read.subscription.cancelAtPeriodEnd;
        if (read.subscription.periodEnd != null) renewsAt = new Date(read.subscription.periodEnd * 1000).toISOString();
        await prisma.subscriptionState
          .update({
            where: { id: row.id },
            data: {
              ...(read.subscription.periodStart != null ? { currentPeriodStart: new Date(read.subscription.periodStart * 1000) } : {}),
              ...(read.subscription.periodEnd != null ? { currentPeriodEnd: new Date(read.subscription.periodEnd * 1000) } : {}),
              cancelAtPeriodEnd: read.subscription.cancelAtPeriodEnd,
            },
          })
          .catch(() => undefined);
      }
    }
  }
  if (!renewsAt || !renewalNoticeDue(now, new Date(renewsAt))) return null;
  const interval = row.billingInterval === "year" ? "year" : row.billingInterval === "month" ? "month" : null;
  const named = namedPlan(row.sku, row.user?.planTier || "", true);
  const monthly = await monthlyAmount(row.sku, row.user?.planTier || "", named.product?.amountCents ?? null);
  const annual = interval === "year" ? await annualAmount(row.sku) : null;
  const amountCents = subscriptionAmountCents({ interval, monthlyAmountCents: monthly, annualAmountCents: annual });
  return {
    id: row.id,
    status: row.status,
    amountCents,
    renewsAt,
    cancelAtPeriodEnd,
    email,
    planName: named.name,
    priceLabel: formatSubscriptionPrice(amountCents, interval),
  };
}

export async function runSubscriptionRenewalSweep(now = new Date()) {
  const rows = await prisma.subscriptionState.findMany({
    where: { status: "active" },
    include: { user: { select: { email: true, planTier: true } } },
  });
  const subscriptions: RenewalSubscription[] = [];
  for (const row of rows) {
    const target = await renewalTarget(row, now).catch(() => null);
    if (target) subscriptions.push(target);
  }
  return deliverRenewalNotices({
    now,
    subscriptions,
    ledger: prismaNoticeLedger(),
    manageUrl: `${getAppOrigin()}/account?tab=billing`,
    send: async (message) => {
      const preference = await emailPreference(message.to).catch(() => ({ billing: true }));
      if (!preference.billing) {
        return { ok: false as const, error: "Billing email is turned off for this account. Nothing was sent." };
      }
      const mailed = await sendMail(message);
      if (!mailed.ok) return { ok: false as const, error: mailed.error };
      return { ok: true as const };
    },
  });
}
