/**
 * Stripe payment adapter.
 * Live collaboration collection stays closed — capability flags do not enable it.
 * Sandbox may open labelled ledger-hold routing without claiming allocated funds / Treasury.
 * Release uses the same sandbox auth as settlement (trusted env + enable + provenance + non-prod host).
 */
import { verifyCollaborationCollectionAccess } from "@/lib/collaboration-collection-access";
import {
  authorizeSandboxLedgerHoldRelease,
  isSandboxLedgerHoldTransferRef,
  resolveSandboxDeploymentHost,
  SANDBOX_TRANSFER_REF_PREFIX,
  stripeCapabilityStatus,
} from "@/lib/payment-account-routing";
import { queueProviderInstruction, type PaymentProviderAdapter } from "@/lib/payment-provider-adapter";
import { prisma } from "@/lib/db";
import { stripeApiRequest, stripeCredentials } from "@/lib/stripe-admin";

export type StripePaymentAdapterOptions = {
  originOrHost?: string;
  env?: Record<string, string | undefined>;
};

export type ReleaseOrTransferDeps = {
  findRouteSnapshot: (fundingId: string) => Promise<unknown | null>;
  queueRelease: typeof queueProviderInstruction;
};

const defaultReleaseDeps: ReleaseOrTransferDeps = {
  async findRouteSnapshot(fundingId) {
    const funding = await prisma.collaborationFunding
      .findUnique({ where: { id: fundingId }, select: { routeSnapshotJson: true } })
      .catch(() => null);
    return funding?.routeSnapshotJson ?? null;
  },
  queueRelease: queueProviderInstruction,
};

/** Shared release entry — same sandbox auth as executeOwnedSettlement. */
export async function executeSandboxReleaseOrTransfer(
  input: {
    fundingId: string;
    milestoneId: string;
    amountCents: number;
    shares?: { label: string; amountCents: number }[];
  },
  context?: { originOrHost?: string; env?: Record<string, string | undefined> },
  deps: ReleaseOrTransferDeps = defaultReleaseDeps,
): Promise<{ ok: true; reference: string; execution?: "provider" | "external" } | { ok: false; error: string }> {
  if (!Number.isInteger(input.amountCents) || input.amountCents <= 0) {
    return { ok: false, error: "Release needs a positive integer amount." };
  }
  const routeSnapshotJson = await deps.findRouteSnapshot(input.fundingId.trim());
  const auth = authorizeSandboxLedgerHoldRelease({
    env: context?.env,
    originOrHost: context?.originOrHost,
    routeSnapshotJson,
  });
  if (!auth.ok) return { ok: false, error: auth.error };

  const queued = await deps.queueRelease({
    instruction: "release",
    fundingId: input.fundingId,
    amountCents: input.amountCents,
    milestoneId: input.milestoneId,
    shares: input.shares,
  });
  if (!queued.ok) return queued;
  return {
    ok: true,
    reference: `${SANDBOX_TRANSFER_REF_PREFIX}${queued.reference}`,
    execution: "external",
  };
}

export function createStripePaymentAdapter(options?: StripePaymentAdapterOptions): PaymentProviderAdapter {
  const env = options?.env ?? (process.env as Record<string, string | undefined>);
  const originOrHost = options?.originOrHost ?? resolveSandboxDeploymentHost(env);

  return {
    async getCapabilities() {
      const access = await verifyCollaborationCollectionAccess({ originOrHost, environment: "sandbox", env });
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
      const access = await verifyCollaborationCollectionAccess({ originOrHost, environment: "sandbox", env });
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
      return executeSandboxReleaseOrTransfer(input, { originOrHost, env });
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
