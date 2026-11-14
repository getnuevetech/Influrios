/**
 * Collab OS P4 — PaymentProviderAdapter.
 * Collaboration domain calls capabilities, never provider endpoints directly.
 *
 * Marketplace adapter queues refund/cancel *instructions* (Job + AuditLog).
 * Cash still moves only via signed provider webhooks (payout.refunded, etc.).
 */

import { prisma } from "@/lib/db";

export type ProviderFundingIntent = {
  fundingId: string;
  amountCents: number;
  currency: string;
  metadata?: Record<string, unknown>;
};

export type ProviderWebhookParse = {
  provider: string;
  eventId: string;
  eventType: string;
  fundingId: string;
  amountCents: number;
  milestoneId?: string;
};

export type ProviderCapabilities = {
  code: string;
  funding: boolean;
  release: boolean;
  partialRefund: boolean;
  webhook: boolean;
};

export type ProviderInstructionKind = "cancel" | "partial_refund" | "full_refund" | "release";

export interface PaymentProviderAdapter {
  getCapabilities(): Promise<ProviderCapabilities>;
  createFundingIntent(input: ProviderFundingIntent): Promise<{ ok: true; reference: string } | { ok: false; error: string }>;
  getFundingStatus(reference: string): Promise<{ status: string } | { error: string }>;
  cancelFunding(reference: string): Promise<{ ok: true; reference: string } | { ok: false; error: string }>;
  createReleaseOrTransfer(input: {
    fundingId: string;
    milestoneId: string;
    amountCents: number;
    /** One release pays each party this amount. Team proposals use creator slugs. */
    shares?: { label: string; amountCents: number }[];
  }): Promise<{ ok: true; reference: string; execution?: "provider" | "external" } | { ok: false; error: string }>;
  createPartialRefund(input: {
    fundingId: string;
    amountCents: number;
    milestoneId?: string;
  }): Promise<{ ok: true; reference: string } | { ok: false; error: string }>;
  createFullRefund(input: { fundingId: string }): Promise<{ ok: true; reference: string } | { ok: false; error: string }>;
  getPayoutStatus(reference: string): Promise<{ status: string } | { error: string }>;
  verifyWebhook(body: string, signature: string | null, secret: string): boolean;
  parseWebhook(body: string, providerHint?: string): ProviderWebhookParse | { error: string };
  reconcileTransaction(reference: string): Promise<{ ok: true } | { ok: false; error: string }>;
}

/** Durable instruction record — not executed against a live rail in this adapter. */
export async function queueProviderInstruction(input: {
  instruction: ProviderInstructionKind;
  fundingId: string;
  amountCents?: number;
  milestoneId?: string | null;
  actor?: string;
  shares?: { label: string; amountCents: number }[];
}): Promise<{ ok: true; reference: string } | { ok: false; error: string }> {
  const fundingId = input.fundingId.trim();
  if (!fundingId) return { ok: false, error: "Funding id is required." };
  if (
    (input.instruction === "partial_refund" || input.instruction === "release") &&
    (input.amountCents == null || !Number.isInteger(input.amountCents) || input.amountCents <= 0)
  ) {
    return {
      ok: false,
      error:
        input.instruction === "release"
          ? "Release needs a positive integer amount."
          : "Partial refund needs a positive integer amount.",
    };
  }

  const prefix =
    input.instruction === "cancel"
      ? "mkt_cancel"
      : input.instruction === "full_refund"
        ? "mkt_refund_full"
        : input.instruction === "release"
          ? "mkt_release"
          : "mkt_refund";
  const job = await prisma.job.create({
    data: {
      kind: "provider_instruction",
      status: "recorded",
      payload: {
        instruction: input.instruction,
        fundingId,
        amountCents: input.amountCents ?? null,
        milestoneId: input.milestoneId ?? null,
        shares: input.shares ?? null,
        queuedAt: new Date().toISOString(),
        note: "Instruction only — ledger moves on signed payout.refunded / provider webhook.",
      },
    },
  });
  const reference = `${prefix}_${job.id}`;
  await prisma.auditLog
    .create({
      data: {
        actor: input.actor ?? "provider_adapter",
        action: `provider_instruction_${input.instruction}`,
        objectType: "CollaborationFunding",
        objectId: fundingId,
        after: {
          reference,
          jobId: job.id,
          amountCents: input.amountCents ?? null,
          milestoneId: input.milestoneId ?? null,
          shares: input.shares ?? null,
        },
      },
    })
    .catch(() => undefined);
  return { ok: true, reference };
}

/** Picks the rail that speaks to the provider. Collaboration ledger code stays on the webhook. */
export async function adapterForProvider(
  providerCode: string | null | undefined,
  deps: {
    verifySignature: (body: string, secret: string, signature: string | null | undefined) => boolean;
  },
): Promise<PaymentProviderAdapter> {
  const code = (providerCode ?? "").trim().toLowerCase();
  if (!code) return createClosedAdapter("unassigned");
  if (code === "airwallex") {
    const { createAirwallexPaymentAdapter } = await import("@/lib/providers/airwallex-runtime");
    return createAirwallexPaymentAdapter();
  }
  if (code === "stripe") {
    const { createStripePaymentAdapter } = await import("@/lib/stripe-payment-adapter");
    return createStripePaymentAdapter();
  }
  return createMarketplaceSignedWebhookAdapter(deps);
}

/** Marketplace signed-webhook adapter — wraps existing Influrios marketplace confirmation path. */
export function createMarketplaceSignedWebhookAdapter(deps: {
  verifySignature: (body: string, secret: string, signature: string | null | undefined) => boolean;
}): PaymentProviderAdapter {
  return {
    async getCapabilities() {
      return { code: "marketplace_signed", funding: true, release: false, partialRefund: true, webhook: true };
    },
    async createFundingIntent() {
      return { ok: false, error: "Funding intents are created in-app; provider confirms via webhook." };
    },
    async getFundingStatus() {
      return { error: "Use ledger funding status." };
    },
    async cancelFunding(reference) {
      return queueProviderInstruction({
        instruction: "cancel",
        fundingId: reference,
      });
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
      return { ok: true, reference: queued.reference, execution: "external" };
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
      return queueProviderInstruction({
        instruction: "full_refund",
        fundingId: input.fundingId,
      });
    },
    async getPayoutStatus() {
      return { error: "Use ledger payout status." };
    },
    verifyWebhook(body, signature, secret) {
      return deps.verifySignature(body, secret, signature);
    },
    parseWebhook(body, providerHint) {
      try {
        const payload = JSON.parse(body) as {
          id?: string;
          type?: string;
          fundingId?: string;
          amountCents?: number;
          milestoneId?: string;
          provider?: string;
        };
        if (!payload.id || !payload.type || !payload.fundingId || payload.amountCents == null) {
          return { error: "Event id, type, funding, and amount are required." };
        }
        return {
          provider: (payload.provider || providerHint || "primary").trim().toLowerCase(),
          eventId: payload.id,
          eventType: payload.type,
          fundingId: payload.fundingId,
          amountCents: payload.amountCents,
          milestoneId: payload.milestoneId,
        };
      } catch {
        return { error: "Invalid JSON." };
      }
    },
    async reconcileTransaction(reference) {
      if (!reference.trim()) {
        return { ok: false, error: "Reconciliation needs a provider reference. The balance was not treated as zero." };
      }
      return { ok: false, error: "No provider object was retrieved for this reference. Reconciliation stays unknown." };
    },
  };
}

function createClosedAdapter(providerCode: string): PaymentProviderAdapter {
  const error = `${providerCode || "This provider"} cannot move collaboration funds. Nothing was sent.`;
  return {
    async getCapabilities() {
      return { code: providerCode || "closed", funding: false, release: false, partialRefund: false, webhook: false };
    },
    async createFundingIntent() {
      return { ok: false, error };
    },
    async getFundingStatus() {
      return { error };
    },
    async cancelFunding() {
      return { ok: false, error };
    },
    async createReleaseOrTransfer() {
      return { ok: false, error };
    },
    async createPartialRefund() {
      return { ok: false, error };
    },
    async createFullRefund() {
      return { ok: false, error };
    },
    async getPayoutStatus() {
      return { error };
    },
    verifyWebhook() {
      return false;
    },
    parseWebhook() {
      return { error };
    },
    async reconcileTransaction() {
      return { ok: false, error: "Reconciliation stays unknown. Nothing was marked settled." };
    },
  };
}
