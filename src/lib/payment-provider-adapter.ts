/**
 * Collab OS P4 — PaymentProviderAdapter.
 * Collaboration domain calls capabilities, never provider endpoints directly.
 */

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

export interface PaymentProviderAdapter {
  getCapabilities(): Promise<ProviderCapabilities>;
  createFundingIntent(input: ProviderFundingIntent): Promise<{ ok: true; reference: string } | { ok: false; error: string }>;
  getFundingStatus(reference: string): Promise<{ status: string } | { error: string }>;
  cancelFunding(reference: string): Promise<{ ok: true } | { ok: false; error: string }>;
  createReleaseOrTransfer(input: {
    fundingId: string;
    milestoneId: string;
    amountCents: number;
  }): Promise<{ ok: true; reference: string } | { ok: false; error: string }>;
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

/** Marketplace signed-webhook adapter — wraps existing Influrios marketplace confirmation path. */
export function createMarketplaceSignedWebhookAdapter(deps: {
  verifySignature: (body: string, secret: string, signature: string | null | undefined) => boolean;
}): PaymentProviderAdapter {
  const notReady = async () => ({ ok: false as const, error: "Capability not enabled on this adapter yet." });
  return {
    async getCapabilities() {
      return { code: "marketplace_signed", funding: true, release: true, partialRefund: true, webhook: true };
    },
    async createFundingIntent() {
      return { ok: false, error: "Funding intents are created in-app; provider confirms via webhook." };
    },
    async getFundingStatus() {
      return { error: "Use ledger funding status." };
    },
    async cancelFunding() {
      return notReady();
    },
    async createReleaseOrTransfer() {
      return { ok: false, error: "Releases are authorized in-app; provider confirms via webhook." };
    },
    async createPartialRefund() {
      return notReady();
    },
    async createFullRefund() {
      return notReady();
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
    async reconcileTransaction() {
      return { ok: true };
    },
  };
}
