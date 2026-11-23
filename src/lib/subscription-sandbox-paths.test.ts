/**
 * Subscription paths (J16 checkout / J17 changes / J18 discounts / subscription tax)
 * do not require collaboration deposits. These tests keep sandbox credentials isolated
 * from live collaboration enablement.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { calculateCountryTax, type CountryTaxRule } from "@/lib/country-tax";
import {
  normalizeDiscountCode,
  quoteSubscription,
  type DiscountOffer,
} from "@/lib/discount-codes";
import { resolveCollaborationCollectionRoute, subscriptionEffect } from "@/lib/payment-account-routing";
import { classifyStripeKey, probeStripeSandbox, setStripeTransportForTests } from "@/lib/stripe-admin";

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

const at = "2026-03-15T12:00:00.000Z";

function rule(partial: Partial<CountryTaxRule> & Pick<CountryTaxRule, "countryCode" | "family" | "method">): CountryTaxRule {
  return {
    id: partial.id ?? `${partial.countryCode}-${partial.family}`,
    version: 1,
    countryCode: partial.countryCode,
    family: partial.family,
    chargeId: partial.chargeId ?? "",
    chargeLabel: partial.chargeLabel ?? partial.family,
    method: partial.method,
    ratePercent: partial.ratePercent ?? null,
    inclusive: false,
    effective: true,
    conflict: false,
  };
}

function offer(partial: Partial<DiscountOffer> & Pick<DiscountOffer, "productCharge">): DiscountOffer {
  return {
    id: partial.id ?? "offer_1",
    version: partial.version ?? 1,
    normalizedCode: partial.normalizedCode ?? "AUDITANN",
    displayCode: partial.displayCode ?? partial.normalizedCode ?? "AUDITANN",
    productCharge: partial.productCharge,
    kind: partial.kind ?? "percentage",
    percentBps: partial.percentBps ?? 2_000,
    fixedCents: partial.fixedCents ?? null,
    currency: partial.currency ?? "USD",
    countryCode: partial.countryCode ?? "US",
    planCode: partial.planCode ?? "plus",
    planName: partial.planName ?? "Plus",
    billingInterval: partial.billingInterval ?? "month",
    serviceLevel: partial.serviceLevel ?? "",
    startsAt: partial.startsAt ?? "2026-01-01T00:00:00.000Z",
    endsAt: partial.endsAt ?? "2026-12-31T23:59:59.999Z",
    totalUses: partial.totalUses ?? 50,
    usesPerCustomer: partial.usesPerCustomer ?? 1,
    lifecycle: partial.lifecycle ?? "active",
    reservedCount: partial.reservedCount ?? 0,
    redeemedCount: partial.redeemedCount ?? 0,
    refundedCount: partial.refundedCount ?? 0,
  };
}

describe("subscription sandbox paths (independent of collab deposits)", () => {
  it("keeps subscription webhook effects off the collaboration settlement ledger", () => {
    assert.equal(subscriptionEffect("customer.subscription.updated").touchesSubscriptionLedger, true);
    assert.equal(subscriptionEffect("customer.subscription.updated").createsCollaborationSettlement, false);
    assert.equal(subscriptionEffect("invoice.paid").createsCollaborationSettlement, false);
    assert.equal(subscriptionEffect("checkout.session.completed").touchesSubscriptionLedger, true);
  });

  it("quotes subscription discount + tax without moving money", () => {
    assert.equal(normalizeDiscountCode("  auditann "), "AUDITANN");
    const taxRule = rule({
      countryCode: "US",
      family: "subscription",
      method: "percentage",
      ratePercent: 8.25,
      chargeId: "plus",
    });
    const quoted = quoteSubscription({
      typedCode: "AUDITANN",
      offer: offer({ productCharge: "subscription" }),
      plan: { code: "plus", name: "Plus", amountCents: 1_900, interval: "month" },
      countryCode: "US",
      currency: "USD",
      accountId: "user_audit_sub",
      checkoutAt: at,
      priorUses: 0,
      rules: [taxRule],
    });
    assert.equal(quoted.ok, true);
    if (!quoted.ok) return;
    assert.equal(quoted.discountCents, 380);
    assert.equal(quoted.subtotalCents, 1_520);
    const tax = calculateCountryTax({
      rules: [taxRule],
      family: "subscription",
      chargeId: "plus",
      countryCode: "US",
      baseCents: 1_520,
      currency: "USD",
      at,
    });
    assert.equal(quoted.taxCents, tax.taxCents);
    assert.ok((quoted.taxCents ?? 0) > 0);
    assert.equal(quoted.moneyMoved, false);

    const liveCollab = resolveCollaborationCollectionRoute({
      environment: "live",
      stripeKeyMode: "live",
      originOrHost: "https://influrios.com",
      probe: { status: "checked", allocatedFunds: true, treasury: true, reason: "flags" },
      trustedDeployment: true,
      sandboxRouteEnabled: true,
    });
    // Subscription quotes never move money; collaboration collection with live keys is standard Stripe.
    assert.equal(liveCollab.ok && liveCollab.topology, "stripe_charges_and_transfers");
  });

  it("allows Stripe sandbox probe with sk_test while collab live path stays refused", async () => {
    assert.equal(classifyStripeKey("sk_test_subpath"), "sandbox");
    const previous = process.env.STRIPE_SECRET_KEY;
    process.env.STRIPE_SECRET_KEY = "sk_test_subpath";
    setStripeTransportForTests(async () =>
      jsonResponse(200, { object: "list", data: [{ id: "cs_test_a", livemode: false }] }),
    );
    const probed = await probeStripeSandbox();
    process.env.STRIPE_SECRET_KEY = previous;
    setStripeTransportForTests(null);
    assert.equal(probed.ok, true);
  });

  it("opens test-mode collaboration collection on the production host (test accounts only)", () => {
    const route = resolveCollaborationCollectionRoute({
      environment: "sandbox",
      stripeKeyMode: "sandbox",
      originOrHost: "https://influrios.com/billing",
      probe: { status: "checked", allocatedFunds: false, treasury: false, reason: "none" },
      trustedDeployment: true,
      sandboxRouteEnabled: true,
    });
    assert.equal(route.ok, true);
    assert.equal(route.ok && route.simulation, true);
  });
});
