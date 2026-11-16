/**
 * Subscription dates, renewal reminders, and auto-renewal.
 * Dates come from the stored row, or from the Stripe period when that read succeeded.
 * A missing date stays missing. Auto-renewal off ends at the renewal date.
 */

import { formatOfferAmount } from "@/lib/billing-interval";

export const NOT_RECORDED = "Not recorded";

export const RENEWAL_NOTICE_KINDS = ["7d", "3d", "day"] as const;
export type RenewalNoticeKind = (typeof RENEWAL_NOTICE_KINDS)[number];

const DAY_MS = 86_400_000;

export function formatSubscriptionDate(iso: string | null | undefined): string {
  if (!iso) return NOT_RECORDED;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return NOT_RECORDED;
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

export function formatSubscriptionInterval(interval: string | null | undefined): string {
  if (interval === "year") return "Annual";
  if (interval === "month") return "Monthly";
  return NOT_RECORDED;
}

export function formatSubscriptionPrice(amountCents: number | null | undefined, interval: string | null | undefined): string {
  if (amountCents == null || !Number.isInteger(amountCents) || amountCents < 0) return NOT_RECORDED;
  const money = formatOfferAmount(amountCents);
  if (interval === "year") return `${money} per year`;
  if (interval === "month") return `${money} per month`;
  return money;
}

/** Yearly display uses the yearly amount. It does not reuse the monthly price. */
export function subscriptionAmountCents(input: {
  interval: string | null;
  monthlyAmountCents: number | null;
  annualAmountCents: number | null;
}): number | null {
  if (input.interval === "year") {
    return input.annualAmountCents != null && input.annualAmountCents > 0 ? input.annualAmountCents : null;
  }
  if (input.interval === "month") {
    return input.monthlyAmountCents != null && input.monthlyAmountCents >= 0 ? input.monthlyAmountCents : null;
  }
  return null;
}

function knownIso(value: string | null | undefined): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

/**
 * Stripe period dates win when the provider is Stripe and the subscription was read.
 * A null field on that read stays unrecorded. A failed read keeps the stored dates.
 */
export function subscriptionPeriodDates(input: {
  provider: string;
  storedStart: string | null;
  storedRenewal: string | null;
  stripe: { periodStart: string | null; periodEnd: string | null } | null;
}): { startedAt: string | null; renewsAt: string | null } {
  if (input.provider === "stripe" && input.stripe) {
    return {
      startedAt: knownIso(input.stripe.periodStart),
      renewsAt: knownIso(input.stripe.periodEnd),
    };
  }
  return {
    startedAt: knownIso(input.storedStart),
    renewsAt: knownIso(input.storedRenewal),
  };
}

export type BillingPlanView = {
  planName: string;
  intervalLabel: string;
  priceLabel: string;
  startedLabel: string;
  renewalLabel: string;
  autoRenew: boolean;
  autoRenewLabel: string;
  canToggle: boolean;
  endNote: string;
};

export function presentBillingPlan(input: {
  planName: string;
  interval: string | null;
  amountCents: number | null;
  startedAt: string | null;
  renewsAt: string | null;
  cancelAtPeriodEnd: boolean;
  hasSubscription: boolean;
  canToggle: boolean;
}): BillingPlanView {
  const startedLabel = formatSubscriptionDate(input.startedAt);
  const renewalLabel = formatSubscriptionDate(input.renewsAt);
  const autoRenew = input.hasSubscription && !input.cancelAtPeriodEnd;
  const autoRenewLabel = input.hasSubscription ? (autoRenew ? "On" : "Off") : NOT_RECORDED;
  let endNote = "";
  if (input.hasSubscription && !autoRenew) {
    endNote =
      renewalLabel === NOT_RECORDED
        ? "This subscription continues until the renewal date and then ends. The renewal date is not recorded."
        : `This subscription continues until ${renewalLabel} and then ends.`;
  } else if (input.hasSubscription && autoRenew) {
    endNote =
      renewalLabel === NOT_RECORDED
        ? "This subscription renews. The renewal date is not recorded."
        : `This subscription renews on ${renewalLabel}.`;
  }
  return {
    planName: input.planName.trim() || NOT_RECORDED,
    intervalLabel: formatSubscriptionInterval(input.interval),
    priceLabel: formatSubscriptionPrice(input.amountCents, input.interval),
    startedLabel,
    renewalLabel,
    autoRenew,
    autoRenewLabel,
    canToggle: input.canToggle,
    endNote,
  };
}

export function billingViewFromStored(input: {
  planName: string;
  billingInterval: string | null;
  amountCents: number | null;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  provider: string;
  externalId: string;
  stripe: { periodStart: string | null; periodEnd: string | null } | null;
}): BillingPlanView {
  const dates = subscriptionPeriodDates({
    provider: input.provider,
    storedStart: input.currentPeriodStart,
    storedRenewal: input.currentPeriodEnd,
    stripe: input.stripe,
  });
  const hasSubscription = Boolean(input.provider.trim() || input.externalId.trim());
  return presentBillingPlan({
    planName: input.planName,
    interval: input.billingInterval,
    amountCents: input.amountCents,
    startedAt: dates.startedAt,
    renewsAt: dates.renewsAt,
    cancelAtPeriodEnd: input.cancelAtPeriodEnd,
    hasSubscription,
    canToggle: input.provider === "stripe" && /^sub_[A-Za-z0-9]+$/.test(input.externalId),
  });
}

function utcDay(value: Date) {
  return Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate());
}

/** Exact calendar day in UTC: 7 days before, 3 days before, or the renewal day. */
export function renewalNoticeDue(now: Date, renewsAt: Date): RenewalNoticeKind | null {
  if (Number.isNaN(now.getTime()) || Number.isNaN(renewsAt.getTime())) return null;
  const days = Math.round((utcDay(renewsAt) - utcDay(now)) / DAY_MS);
  if (days === 7) return "7d";
  if (days === 3) return "3d";
  if (days === 0) return "day";
  return null;
}

export function renewalReminderEligible(input: {
  status: string;
  amountCents: number | null;
  renewsAt: string | null;
  cancelAtPeriodEnd: boolean;
  email: string;
}): boolean {
  if (input.status !== "active") return false;
  if (input.cancelAtPeriodEnd) return false;
  if (input.amountCents == null || input.amountCents <= 0) return false;
  if (!input.renewsAt || Number.isNaN(new Date(input.renewsAt).getTime())) return false;
  return input.email.includes("@");
}

export function renewalNoticeCopy(input: {
  planName: string;
  priceLabel: string;
  renewsAt: string;
  kind: RenewalNoticeKind;
  manageUrl: string;
}): { subject: string; text: string } {
  const plan = input.planName.trim() || "your plan";
  const when = formatSubscriptionDate(input.renewsAt);
  const price = input.priceLabel.trim();
  const priceBit = price && price !== NOT_RECORDED ? ` (${price})` : "";
  if (input.kind === "day") {
    return {
      subject: "Your Influrios plan renews today",
      text: [
        `Your ${plan} plan${priceBit} is scheduled to be charged today, ${when}.`,
        "This notice is a reminder of the charge that day. It does not mark the invoice paid.",
        `Manage the subscription: ${input.manageUrl}`,
      ].join("\n"),
    };
  }
  const ahead = input.kind === "7d" ? "7 days" : "3 days";
  return {
    subject: `Your Influrios plan renews on ${when}`,
    text: [
      `Your ${plan} plan${priceBit} renews in ${ahead}, on ${when}.`,
      `Manage the subscription: ${input.manageUrl}`,
    ].join("\n"),
  };
}

export type RenewalSubscription = {
  id: string;
  status: string;
  amountCents: number | null;
  renewsAt: string | null;
  cancelAtPeriodEnd: boolean;
  email: string;
  planName: string;
  priceLabel: string;
};

export type RenewalNoticeRecord = {
  subscriptionId: string;
  renewsAt: string;
  kind: RenewalNoticeKind;
  status: "sent" | "unsent";
  reason: string;
};

export type RenewalNoticeLedger = {
  find(subscriptionId: string, renewsAt: string, kind: RenewalNoticeKind): Promise<RenewalNoticeRecord | null>;
  save(record: RenewalNoticeRecord): Promise<void>;
};

export function memoryRenewalLedger(seed: RenewalNoticeRecord[] = []): RenewalNoticeLedger & { rows: RenewalNoticeRecord[] } {
  const rows = seed.map((row) => ({ ...row }));
  return {
    rows,
    async find(subscriptionId, renewsAt, kind) {
      return rows.find((row) => row.subscriptionId === subscriptionId && row.renewsAt === renewsAt && row.kind === kind) ?? null;
    },
    async save(record) {
      const index = rows.findIndex((row) => row.subscriptionId === record.subscriptionId && row.renewsAt === record.renewsAt && row.kind === record.kind);
      if (index >= 0) rows[index] = record;
      else rows.push(record);
    },
  };
}

export type RenewalSendResult = { ok: true } | { ok: false; error: string };

/**
 * Sends each due notice once for that subscription and renewal instant.
 * A failed send is stored as unsent with the reason and can be tried again.
 * A sent notice is not sent again. This does not mark an invoice paid.
 */
export async function deliverRenewalNotices(input: {
  now: Date;
  subscriptions: RenewalSubscription[];
  ledger: RenewalNoticeLedger;
  send: (message: { to: string; subject: string; text: string }) => Promise<RenewalSendResult>;
  manageUrl: string;
}): Promise<{ sent: number; unsent: number; markedPaid: false }> {
  let sent = 0;
  let unsent = 0;
  for (const subscription of input.subscriptions) {
    if (!renewalReminderEligible(subscription) || !subscription.renewsAt) continue;
    const kind = renewalNoticeDue(input.now, new Date(subscription.renewsAt));
    if (!kind) continue;
    const existing = await input.ledger.find(subscription.id, subscription.renewsAt, kind);
    if (existing?.status === "sent") continue;
    const copy = renewalNoticeCopy({
      planName: subscription.planName,
      priceLabel: subscription.priceLabel,
      renewsAt: subscription.renewsAt,
      kind,
      manageUrl: input.manageUrl,
    });
    let result: RenewalSendResult;
    try {
      result = await input.send({ to: subscription.email, subject: copy.subject, text: copy.text });
    } catch (error) {
      result = { ok: false, error: error instanceof Error ? error.message : "The renewal notice was not sent." };
    }
    await input.ledger.save({
      subscriptionId: subscription.id,
      renewsAt: subscription.renewsAt,
      kind,
      status: result.ok ? "sent" : "unsent",
      reason: result.ok ? "" : result.error.slice(0, 500),
    });
    if (result.ok) sent += 1;
    else unsent += 1;
  }
  return { sent, unsent, markedPaid: false };
}

export type AutoRenewDecision = {
  changed: boolean;
  cancelAtPeriodEnd: boolean;
  endsAt: string | null;
  status: "active";
  markedPaid: false;
  endedToday: false;
};

/** Off schedules the end on the renewal date. On clears that end. A failed provider call keeps the previous flag. */
export function applyAutoRenew(input: {
  turnOn: boolean;
  renewsAt: string | null;
  previousCancelAtPeriodEnd: boolean;
  providerConfirmed: boolean;
}): AutoRenewDecision {
  if (!input.providerConfirmed) {
    return {
      changed: false,
      cancelAtPeriodEnd: input.previousCancelAtPeriodEnd,
      endsAt: input.previousCancelAtPeriodEnd ? input.renewsAt : null,
      status: "active",
      markedPaid: false,
      endedToday: false,
    };
  }
  if (input.turnOn) {
    return {
      changed: true,
      cancelAtPeriodEnd: false,
      endsAt: null,
      status: "active",
      markedPaid: false,
      endedToday: false,
    };
  }
  return {
    changed: true,
    cancelAtPeriodEnd: true,
    endsAt: input.renewsAt,
    status: "active",
    markedPaid: false,
    endedToday: false,
  };
}

/** The only local write. It does not set status, a payment, or today's date. */
export function autoRenewWrite(decision: AutoRenewDecision): { cancelAtPeriodEnd: boolean } | null {
  if (!decision.changed) return null;
  return { cancelAtPeriodEnd: decision.cancelAtPeriodEnd };
}

/** Stripe subscription update for auto-renewal. The current price is not included. */
export function subscriptionRenewalUpdateFields(input: { cancelAtPeriodEnd: boolean }) {
  return {
    cancel_at_period_end: input.cancelAtPeriodEnd ? "true" : "false",
  };
}
