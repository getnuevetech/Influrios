/**
 * Stripe payment adapter.
 * Live collaboration collection stays closed — capability flags do not enable it.
 * Sandbox may open labelled ledger-hold routing without claiming allocated funds / Treasury.
 * A release instruction for money already collected on the original route is still only an instruction.
 * Bank payout is not marked from this adapter.
 */
import { verifyCollaborationCollectionAccess } from "@/lib/collaboration-collection-access";
import { isSandboxLedgerHoldTransferRef, readSandboxCollectionProvenance, stripeCapabilityStatus } from "@/lib/payment-account-routing";
import { queueProviderInstruction, type PaymentProviderAdapter } from "@/lib/payment-provider-adapter";
import { prisma } from "@/lib/db";
import { stripeApiRequest, stripeCredentials } from "@/lib/stripe-admin";

export function createStripePaymentAdapter(): PaymentProviderAdapter {
  return {
    async getCapabilities() {
      const access = await verifyCollaborationCollectionAccess({ originOrHost: "127.0.0.1" });
      const status = stripeCapabilityStatus({
        probe: {
          allocatedFunds: access.allocatedFunds,
          treasury: access.treasury,
          status: access.probe.status,
        },
        collectionDecision: access,
        checkedAt: access.checkedAt,
      });
      const funding = status.newCollaborationFunding === "sandbox_ledger_hold";
      return {
        code: "stripe",
        funding,
        release: false,
        partialRefund: true,
        webhook: true,
      };
    },
    async createFundingIntent() {
      const access = await verifyCollaborationCollectionAccess({ originOrHost: "127.0.0.1" });
      if (!access.ok) return { ok: false, error: access.error };
      if (access.simulation) {
        return {
          ok: false,
          error:
            "SIMULATION: sandbox_ledger_hold — open collaboration deposit via funding checkout. This adapter does not charge. Provider allocated-funds/Treasury E2E is not complete.",
        };
      }
      return {
        ok: false,
        error:
          "Live collaboration funding stays closed. Capability availability is not a proven allocated-funds or Treasury collection flow. Nothing was charged.",
      };
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
      const funding = await prisma.collaborationFunding
        .findUnique({ where: { id: input.fundingId.trim() }, select: { routeSnapshotJson: true } })
        .catch(() => null);
      const provenance = readSandboxCollectionProvenance(funding?.routeSnapshotJson);
      if (provenance) {
        const queued = await queueProviderInstruction({
          instruction: "release",
          fundingId: input.fundingId,
          amountCents: input.amountCents,
          milestoneId: input.milestoneId,
          shares: input.shares,
        });
        if (!queued.ok) return queued;
        return {
          ok: true,
          reference: `sim_sandbox_ledger_hold:${queued.reference}`,
          execution: "external" as const,
        };
      }
      return {
        ok: false,
        error:
          "Live distribution stays blocked. Capability availability is not a proven allocated-funds or Treasury release flow. Nothing was transferred.",
      };
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
      if (isSandboxLedgerHoldTransferRef(ref)) {
        return { ok: false, error: "SIMULATION references are not provider reconciliation. Provider E2E is not complete." };
      }
      const creds = await stripeCredentials();
      if (!creds.ok) return { ok: false, error: "Stripe could not be read. Reconciliation stays unknown. Nothing was marked settled." };
      const retrieved = await stripeApiRequest({ method: "GET", path: `/v1/charges/${encodeURIComponent(ref)}`, secret: creds.secret });
      if (!retrieved.ok) return { ok: false, error: retrieved.error };
      if (retrieved.id !== ref) return { ok: false, error: "The retrieved object does not match this reference. Nothing was marked settled." };
      return { ok: true };
    },
  };
}
