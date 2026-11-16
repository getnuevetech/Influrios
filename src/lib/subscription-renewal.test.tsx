import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { BillingPlanPanel } from "@/components/billing-plan-panel";
import { setStripeTransportForTests, updateSubscriptionCancelAtPeriodEnd } from "@/lib/stripe-admin";
import {
  applyAutoRenew,
  autoRenewWrite,
  billingViewFromStored,
  deliverRenewalNotices,
  memoryRenewalLedger,
  subscriptionRenewalUpdateFields,
  type RenewalSubscription,
} from "@/lib/subscription-renewal";

const RENEWS = "2026-12-15T00:00:00.000Z";
const TODAY = "2026-11-16";

function storedView(input: {
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  stripe?: { periodStart: string | null; periodEnd: string | null } | null;
  cancelAtPeriodEnd?: boolean;
}) {
  return billingViewFromStored({
    planName: "Plus",
    billingInterval: "month",
    amountCents: 1900,
    currentPeriodStart: input.currentPeriodStart,
    currentPeriodEnd: input.currentPeriodEnd,
    cancelAtPeriodEnd: input.cancelAtPeriodEnd ?? false,
    provider: "stripe",
    externalId: "sub_stored",
    stripe: input.stripe === undefined ? null : input.stripe,
  });
}

function paidSubscription(renewsAt: string): RenewalSubscription {
  return {
    id: "sub_row",
    status: "active",
    amountCents: 1900,
    renewsAt,
    cancelAtPeriodEnd: false,
    email: "ada@example.com",
    planName: "Plus",
    priceLabel: "$19 per month",
  };
}

describe("billing plan details", () => {
  it("renders the plan, start date, and renewal date from stored fields", () => {
    const view = storedView({
      currentPeriodStart: "2026-03-01T00:00:00.000Z",
      currentPeriodEnd: RENEWS,
    });
    const html = renderToStaticMarkup(<BillingPlanPanel view={view} manageHref="/billing" action={async () => {}} />);
    assert.match(html, /Current plan: Plus/);
    assert.match(html, /Plus/);
    assert.match(html, /Monthly/);
    assert.match(html, /\$19 per month/);
    assert.match(html, /Mar 1, 2026/);
    assert.match(html, /Dec 15, 2026/);
    assert.match(html, /Auto-renewal/);
    assert.match(html, />On</);
    assert.match(html, /Manage Billing &(?:amp;)? Plan/);
    assert.match(html, /href="\/billing"/);
    const page = readFileSync("src/app/account/page.tsx", "utf8");
    const panel = readFileSync("src/components/billing-plan-panel.tsx", "utf8");
    assert.match(page, /loadAccountBillingView/);
    assert.match(page, /export default async function AccountPage/);
    assert.equal(panel.includes("use client"), false);
    assert.equal(panel.includes("@/lib/db"), false);
    assert.equal(panel.includes("@/lib/stripe-admin"), false);
    assert.equal(panel.includes("@/lib/mail"), false);
  });

  it("labels a missing date as not recorded", () => {
    const view = storedView({ currentPeriodStart: null, currentPeriodEnd: null });
    const html = renderToStaticMarkup(<BillingPlanPanel view={view} manageHref="/billing" />);
    assert.match(html, /Not recorded/);
    assert.match(html, /Started/);
    assert.match(html, /Next renewal/);
    assert.equal(html.includes("Jan 1, 1970"), false);
    assert.equal(html.includes("Dec 31, 1969"), false);
    const fromStripe = storedView({
      currentPeriodStart: "2026-03-01T00:00:00.000Z",
      currentPeriodEnd: RENEWS,
      stripe: { periodStart: null, periodEnd: "2026-12-15T00:00:00.000Z" },
    });
    assert.equal(fromStripe.startedLabel, "Not recorded");
    assert.equal(fromStripe.renewalLabel, "Dec 15, 2026");
    const storedOnly = storedView({
      currentPeriodStart: "2026-03-01T00:00:00.000Z",
      currentPeriodEnd: RENEWS,
      stripe: null,
    });
    assert.equal(storedOnly.startedLabel, "Mar 1, 2026");
  });
});

describe("renewal notices", () => {
  it("sends the 7-day, 3-day, and renewal-day notices once for that renewal date", async () => {
    const ledger = memoryRenewalLedger();
    const calls: string[] = [];
    const send = async (message: { subject: string; text: string }) => {
      calls.push(`${message.subject}\n${message.text}`);
      return { ok: true as const };
    };
    const subscription = paidSubscription(RENEWS);
    const days = ["2026-12-08T12:00:00.000Z", "2026-12-12T12:00:00.000Z", "2026-12-15T12:00:00.000Z"];
    for (const now of days) {
      const first = await deliverRenewalNotices({
        now: new Date(now),
        subscriptions: [subscription],
        ledger,
        send,
        manageUrl: "https://example.com/account?tab=billing",
      });
      const second = await deliverRenewalNotices({
        now: new Date(now),
        subscriptions: [subscription],
        ledger,
        send,
        manageUrl: "https://example.com/account?tab=billing",
      });
      assert.equal(first.sent, 1);
      assert.equal(first.markedPaid, false);
      assert.equal(second.sent, 0);
    }
    assert.equal(calls.length, 3);
    assert.match(calls[0], /renews in 7 days/);
    assert.match(calls[1], /renews in 3 days/);
    assert.match(calls[2], /charged today/);
    assert.match(calls[2], /does not mark the invoice paid/);
    assert.equal(ledger.rows.length, 3);
    assert.equal(ledger.rows.every((row) => row.status === "sent" && row.renewsAt === RENEWS), true);

    const moved = paidSubscription("2027-01-15T00:00:00.000Z");
    const again = await deliverRenewalNotices({
      now: new Date("2027-01-15T12:00:00.000Z"),
      subscriptions: [moved],
      ledger,
      send,
      manageUrl: "https://example.com/account?tab=billing",
    });
    assert.equal(again.sent, 1);
    assert.equal(calls.length, 4);
    assert.equal(ledger.rows.some((row) => row.renewsAt === "2027-01-15T00:00:00.000Z" && row.kind === "day"), true);
  });

  it("records an unsent notice when mail is not configured", async () => {
    const ledger = memoryRenewalLedger();
    const result = await deliverRenewalNotices({
      now: new Date("2026-12-08T12:00:00.000Z"),
      subscriptions: [paidSubscription(RENEWS)],
      ledger,
      manageUrl: "https://example.com/account?tab=billing",
      send: async () => ({ ok: false, error: "No SMTP settings are saved yet. Fill the form, check Enabled, and save." }),
    });
    assert.equal(result.sent, 0);
    assert.equal(result.unsent, 1);
    assert.equal(result.markedPaid, false);
    assert.equal(ledger.rows[0]?.status, "unsent");
    assert.match(ledger.rows[0]?.reason ?? "", /No SMTP settings/);
    assert.equal(ledger.rows[0]?.reason.includes("accepted"), false);
  });

  it("does not remind a free plan or a subscription that ends at renewal", async () => {
    const ledger = memoryRenewalLedger();
    let calls = 0;
    const send = async () => {
      calls += 1;
      return { ok: true as const };
    };
    const now = new Date("2026-12-08T12:00:00.000Z");
    await deliverRenewalNotices({
      now,
      subscriptions: [
        { ...paidSubscription(RENEWS), amountCents: 0 },
        { ...paidSubscription(RENEWS), cancelAtPeriodEnd: true, id: "sub_ending" },
        { ...paidSubscription(RENEWS), status: "past_due", id: "sub_due" },
      ],
      ledger,
      send,
      manageUrl: "https://example.com/account?tab=billing",
    });
    assert.equal(calls, 0);
    assert.equal(ledger.rows.length, 0);
  });
});

describe("auto-renewal", () => {
  it("schedules the end at the renewal date and clears it without marking the subscription paid", () => {
    const off = applyAutoRenew({
      turnOn: false,
      renewsAt: RENEWS,
      previousCancelAtPeriodEnd: false,
      providerConfirmed: true,
    });
    assert.equal(off.cancelAtPeriodEnd, true);
    assert.equal(off.endsAt, RENEWS);
    assert.notEqual(off.endsAt?.slice(0, 10), TODAY);
    assert.equal(off.status, "active");
    assert.equal(off.markedPaid, false);
    assert.equal(off.endedToday, false);
    assert.deepEqual(autoRenewWrite(off), { cancelAtPeriodEnd: true });
    assert.equal(Object.hasOwn(autoRenewWrite(off) ?? {}, "status"), false);

    const on = applyAutoRenew({
      turnOn: true,
      renewsAt: RENEWS,
      previousCancelAtPeriodEnd: true,
      providerConfirmed: true,
    });
    assert.equal(on.cancelAtPeriodEnd, false);
    assert.equal(on.endsAt, null);
    assert.equal(on.markedPaid, false);
    assert.equal(on.endedToday, false);
    assert.deepEqual(autoRenewWrite(on), { cancelAtPeriodEnd: false });

    const failed = applyAutoRenew({
      turnOn: false,
      renewsAt: RENEWS,
      previousCancelAtPeriodEnd: false,
      providerConfirmed: false,
    });
    assert.equal(failed.changed, false);
    assert.equal(failed.cancelAtPeriodEnd, false);
    assert.equal(failed.markedPaid, false);
    assert.equal(failed.endedToday, false);
    assert.equal(autoRenewWrite(failed), null);

    const fields = subscriptionRenewalUpdateFields({ cancelAtPeriodEnd: true });
    assert.equal(fields.cancel_at_period_end, "true");
    assert.equal("items[0][price]" in fields, false);
    assert.equal("cancel_at" in fields, false);
  });

  it("leaves the previous setting when Stripe does not confirm the renewal change", async () => {
    let body = "";
    setStripeTransportForTests(async (input, init) => {
      body = String(init?.body ?? "");
      assert.equal(String(input), "https://api.stripe.com/v1/subscriptions/sub_123");
      assert.equal(init?.method, "POST");
      return new Response(JSON.stringify({ error: { message: "no" } }), { status: 400 });
    });
    try {
      const failed = await updateSubscriptionCancelAtPeriodEnd({
        secret: "sk_test_example",
        subscriptionId: "sub_123",
        cancelAtPeriodEnd: true,
        idempotencyKey: "auto-renew:sub_123:off",
      });
      assert.equal(failed.ok, false);
      assert.equal(body, "cancel_at_period_end=true");
      assert.equal(body.includes("price"), false);
      const kept = applyAutoRenew({
        turnOn: false,
        renewsAt: RENEWS,
        previousCancelAtPeriodEnd: false,
        providerConfirmed: failed.ok,
      });
      assert.equal(kept.cancelAtPeriodEnd, false);
      assert.equal(autoRenewWrite(kept), null);

      setStripeTransportForTests(async (_input, init) => {
        body = String(init?.body ?? "");
        return new Response(
          JSON.stringify({
            id: "sub_123",
            status: "active",
            cancel_at_period_end: true,
            current_period_end: 1765756800,
            items: { data: [{ id: "si_123", price: { id: "price_existing", recurring: { interval: "month" } } }] },
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      });
      const confirmed = await updateSubscriptionCancelAtPeriodEnd({
        secret: "sk_test_example",
        subscriptionId: "sub_123",
        cancelAtPeriodEnd: true,
        idempotencyKey: "auto-renew:sub_123:off:confirmed",
      });
      assert.equal(confirmed.ok, true);
      if (confirmed.ok) {
        assert.equal(confirmed.cancelAtPeriodEnd, true);
        assert.equal(confirmed.periodEnd, 1765756800);
      }
      assert.equal(body, "cancel_at_period_end=true");
      assert.equal(body.includes("price_existing"), false);

      setStripeTransportForTests(async () =>
        new Response(JSON.stringify({ id: "sub_123", status: "canceled", cancel_at_period_end: true }), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      );
      const endedNow = await updateSubscriptionCancelAtPeriodEnd({
        secret: "sk_test_example",
        subscriptionId: "sub_123",
        cancelAtPeriodEnd: true,
        idempotencyKey: "auto-renew:sub_123:off:ended",
      });
      assert.equal(endedNow.ok, false);
    } finally {
      setStripeTransportForTests(null);
    }
  });
});
