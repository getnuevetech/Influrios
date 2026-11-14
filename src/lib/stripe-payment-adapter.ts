/**
 * Stripe payment adapter.
 * New collaboration collection stays closed until allocated funds or Treasury is proven.
 * A release instruction for money already collected on the original route is still only an instruction.
 * Bank payout is not marked from this adapter.
 */
import { collaborationCollectionGate, stripeCapabilityStatus } from "@/lib/payment-account-routing";
import { queueProviderInstruction, type PaymentProviderAdapter } from "@/lib/payment-provider-adapter";
import { stripeApiRequest, stripeCredentials } from "@/lib/stripe-admin";

export function createStripePaymentAdapter(): PaymentProviderAdapter {
  return {
    async getCapabilities() {
      const status = stripeCapabilityStatus();
      const open = status.newCollaborationFunding === "disabled" ? false : true;
      return { code: "stripe", funding: open, release: false, partialRefund: true, webhook: true };
    },
    async createFundingIntent() {
      const gate = collaborationCollectionGate({ allocatedFunds: false, treasury: false });
      return { ok: false, error: gate.ok ? "Nothing was charged." : gate.error };
    },
    async getFundingStatus() {
      return { error: "Funding status comes from a retrieved provider object, not from this screen." };
    },
    async cancelFunding(reference) {
      return queueProviderInstruction({ instruction: "cancel", fundingId: reference });
    },
    async createReleaseOrTransfer(input) {
      if (!Number.isInteger(input.amountCents) || input.amountCents <= 0) {
        return { ok: false, error: "Release needs a positive integer amount." };
      }
      const queued = await queueProviderInstruction({
        instruction: "release",
        fundingId: input.fundingId,
        amountCents: input.amountCents,
        milestoneId: input.milestoneId,
        shares: input.shares,
      });
      if (!queued.ok) return queued;
      return { ok: true, reference: queued.reference, execution: "external" as const };
    },
    async createPartialRefund(input) {
      return queueProviderInstruction({
        instruction: "partial_refund",
        fundingId: input.fundingId,
        amountCents: input.amountCents,
        milestoneId: input.milestoneId,
      });
    },
    async createFullRefund(input) {
      return queueProviderInstruction({ instruction: "full_refund", fundingId: input.fundingId });
    },
    async getPayoutStatus() {
      return { error: "Payout status stays unknown until Stripe returns the payout." };
    },
    verifyWebhook() {
      return false;
    },
    parseWebhook(body) {
      try {
        const payload = JSON.parse(body) as { id?: string; type?: string; data?: { object?: { id?: string; metadata?: { fundingId?: string } } } };
        const fundingId = payload.data?.object?.metadata?.fundingId?.trim() ?? "";
        if (!payload.id || !payload.type || !fundingId) return { error: "The Stripe event is missing an id, a type, or the funding reference." };
        return {
          provider: "stripe",
          eventId: payload.id,
          eventType: payload.type,
          fundingId,
          amountCents: 0,
        };
      } catch {
        return { error: "Invalid JSON." };
      }
    },
    async reconcileTransaction(reference) {
      const ref = reference.trim();
      if (!ref) return { ok: false, error: "Reconciliation needs a provider reference. The balance was not treated as zero." };
      const creds = await stripeCredentials();
      if (!creds.ok) return { ok: false, error: "Stripe could not be read. Reconciliation stays unknown. Nothing was marked settled." };
      const retrieved = await stripeApiRequest({ method: "GET", path: `/v1/charges/${encodeURIComponent(ref)}`, secret: creds.secret });
      if (!retrieved.ok) return { ok: false, error: retrieved.error };
      if (retrieved.id !== ref) return { ok: false, error: "The retrieved object does not match this reference. Nothing was marked settled." };
      return { ok: true };
    },
  };
}
