import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { PayoutOnboardingChoice } from "./payout-readiness";
import { buildReceivePaymentsView } from "./receive-payments-checklist";

function rail(partial: Partial<PayoutOnboardingChoice> & Pick<PayoutOnboardingChoice, "rail">): PayoutOnboardingChoice {
  return {
    countryCode: "NG",
    collectionProviderCode: null,
    showStripe: false,
    showProvider: false,
    reason: "test",
    emptyHint: null,
    ...partial,
  };
}

describe("buildReceivePaymentsView", () => {
  it("routes document KYC countries to upload documents before payout setup", () => {
    const view = buildReceivePaymentsView({
      rail: rail({ rail: "stripe", showStripe: true, collectionProviderCode: "stripe" }),
      kycType: "government_id",
      identityVerified: false,
      kycSubmission: "none",
      hasStripeConnectAccount: false,
      hasProviderAccount: false,
      hasVerifiedPayoutMethod: false,
    });
    assert.equal(view.status, "action_needed");
    assert.equal(view.primaryAction?.kind, "link");
    if (view.primaryAction?.kind === "link") {
      assert.equal(view.primaryAction.href, "/dashboard/kyc");
      assert.match(view.primaryAction.label, /Upload documents/i);
    }
    assert.equal(view.summary.includes("Nigeria"), false);
    assert.equal(view.summary.includes("Stripe"), false);
    assert.equal(view.steps[0]?.done, false);
    assert.equal(view.steps[1]?.done, false);
  });

  it("waits on document review without forcing payout CTA first", () => {
    const view = buildReceivePaymentsView({
      rail: rail({ rail: "provider", showProvider: true, collectionProviderCode: "airwallex" }),
      kycType: "government_id",
      identityVerified: false,
      kycSubmission: "submitted",
      hasStripeConnectAccount: false,
      hasProviderAccount: false,
      hasVerifiedPayoutMethod: false,
    });
    assert.equal(view.steps[0]?.pending, true);
    assert.match(view.summary, /review/i);
    assert.equal(view.primaryAction?.kind, "link");
  });

  it("uses gateway KYC continue path when corridor KYC is gateway", () => {
    const view = buildReceivePaymentsView({
      rail: rail({ rail: "stripe", showStripe: true, collectionProviderCode: "stripe" }),
      kycType: "gateway",
      identityVerified: false,
      kycSubmission: "pending_gateway",
      hasStripeConnectAccount: true,
      hasProviderAccount: false,
      hasVerifiedPayoutMethod: false,
    });
    assert.equal(view.status, "action_needed");
    assert.equal(view.primaryAction?.kind, "link");
    if (view.primaryAction?.kind === "link") {
      assert.match(view.primaryAction.label, /identity/i);
    }
    assert.equal(view.steps[1]?.done, true);
  });

  it("offers payout account setup after identity is verified", () => {
    const view = buildReceivePaymentsView({
      rail: rail({ rail: "provider", showProvider: true, collectionProviderCode: "airwallex" }),
      kycType: "gateway",
      identityVerified: true,
      kycSubmission: "verified",
      hasStripeConnectAccount: false,
      hasProviderAccount: false,
      hasVerifiedPayoutMethod: false,
    });
    assert.equal(view.status, "action_needed");
    assert.equal(view.primaryAction?.kind, "provider");
    assert.match(view.primaryAction?.label ?? "", /Set up payout account/i);
    assert.equal(JSON.stringify(view).includes("Airwallex"), false);
    assert.equal(JSON.stringify(view).includes("acct_"), false);
  });

  it("marks ready when identity and connected payout account are done", () => {
    const view = buildReceivePaymentsView({
      rail: rail({ rail: "stripe", showStripe: true, collectionProviderCode: "stripe" }),
      kycType: "government_id",
      identityVerified: true,
      kycSubmission: "verified",
      hasStripeConnectAccount: true,
      hasProviderAccount: false,
      hasVerifiedPayoutMethod: true,
    });
    assert.equal(view.status, "ready");
    assert.equal(view.primaryAction, null);
    assert.match(view.summary, /set up to receive/i);
  });

  it("marks unavailable when the corridor rail is not ready after identity", () => {
    const view = buildReceivePaymentsView({
      rail: rail({
        rail: "none",
        emptyHint: "Payouts aren’t available for your region yet. Check back soon.",
      }),
      kycType: "government_id",
      identityVerified: true,
      kycSubmission: "verified",
      hasStripeConnectAccount: false,
      hasProviderAccount: false,
      hasVerifiedPayoutMethod: false,
    });
    assert.equal(view.status, "unavailable");
    assert.equal(view.primaryAction, null);
    assert.match(view.summary, /region/i);
  });
});
