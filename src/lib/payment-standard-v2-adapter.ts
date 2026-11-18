/**
 * Gateway adapter contract for Payment Standard v2.
 * Adapters execute movements; they do not decide fees or milestone approval.
 * All amounts are dollars with two decimals.
 */
import type { Dollar } from "@/lib/payment-money";
import { dollarToProviderMinorUnits } from "@/lib/payment-money";
import type { GatewayCapability } from "@/lib/payment-standard-v2-accounts";

export type AdapterEnvironment = "sandbox" | "live";

export type NormalizedMovementStatus =
  | "authorized"
  | "queued"
  | "submitted"
  | "pending"
  | "settled"
  | "failed"
  | "unknown_outcome"
  | "returned"
  | "reversed"
  | "unsupported";

export type AdapterCommandContext = {
  integrationId: string;
  environment: AdapterEnvironment;
  sourceAccountId: string;
  destinationAccountId?: string;
  obligationId: string;
  amount: Dollar;
  currency: string;
  idempotencyKey: string;
  businessReference: string;
};

export type AdapterCommandResult = {
  providerId: string | null;
  status: NormalizedMovementStatus;
  rawStatus: string;
  nextAction?: string;
  /** Provider minor-unit echo for rails that require it — not a domain field. */
  providerMinorUnits?: number;
};

export type GatewayAdapterV2 = {
  code: string;
  getCapabilities(): Promise<GatewayCapability[]>;
  validateAccountMapping(input: {
    sourceAccountId: string;
    destinationAccountId: string;
    capability: GatewayCapability;
  }): Promise<{ ok: true } | { ok: false; reason: string }>;
  createCollection(ctx: AdapterCommandContext): Promise<AdapterCommandResult>;
  retrieveCollection(ctx: Pick<AdapterCommandContext, "integrationId" | "environment" | "idempotencyKey" | "businessReference"> & {
    providerId?: string;
  }): Promise<AdapterCommandResult>;
  transferBetweenAccounts(ctx: AdapterCommandContext & { destinationAccountId: string }): Promise<AdapterCommandResult>;
  createExternalPayout(ctx: AdapterCommandContext & { destinationAccountId: string }): Promise<AdapterCommandResult>;
  retrieveMovement(ctx: {
    integrationId: string;
    environment: AdapterEnvironment;
    providerId: string;
    idempotencyKey: string;
  }): Promise<AdapterCommandResult>;
  refundCollection(ctx: AdapterCommandContext): Promise<AdapterCommandResult>;
};

export type UnsupportedAdapterResult = AdapterCommandResult & { status: "unsupported" };

export function unsupportedOperation(operation: string): UnsupportedAdapterResult {
  return {
    providerId: null,
    status: "unsupported",
    rawStatus: "unsupported",
    nextAction: `Provider does not support ${operation} on this route.`,
  };
}

/** Prepare provider payload amounts without leaking cents into domain records. */
export function providerAmountPayload(amount: Dollar, currency: string) {
  return {
    currency,
    amount: amount,
    /** Only for APIs that require minor units. */
    minorUnits: dollarToProviderMinorUnits(amount),
  };
}

/**
 * In-memory mock adapter for architecture tests (STD01–03 arrangements).
 * Mock evidence is not sandbox or live evidence.
 */
export function createMockGatewayAdapter(code = "mock"): GatewayAdapterV2 {
  const store = new Map<string, AdapterCommandResult>();

  function remember(key: string, result: AdapterCommandResult) {
    store.set(key, result);
    return result;
  }

  return {
    code,
    async getCapabilities() {
      return [
        "collect_payment",
        "retain_funding",
        "move_between_accounts",
        "pay_beneficiary",
        "control_bank_payout",
        "refund_and_recover",
        "observe_outcomes",
        "recurring_billing",
      ];
    },
    async validateAccountMapping() {
      return { ok: true as const };
    },
    async createCollection(ctx) {
      const existing = store.get(ctx.idempotencyKey);
      if (existing) return existing;
      return remember(ctx.idempotencyKey, {
        providerId: `mock_col_${ctx.idempotencyKey}`,
        status: "settled",
        rawStatus: "succeeded",
        providerMinorUnits: dollarToProviderMinorUnits(ctx.amount),
      });
    },
    async retrieveCollection(ctx) {
      const existing = store.get(ctx.idempotencyKey);
      if (existing) return existing;
      return {
        providerId: ctx.providerId ?? null,
        status: "unknown_outcome",
        rawStatus: "missing",
        nextAction: "Query provider before retrying.",
      };
    },
    async transferBetweenAccounts(ctx) {
      const existing = store.get(ctx.idempotencyKey);
      if (existing) return existing;
      return remember(ctx.idempotencyKey, {
        providerId: `mock_xfer_${ctx.idempotencyKey}`,
        status: "settled",
        rawStatus: "succeeded",
        providerMinorUnits: dollarToProviderMinorUnits(ctx.amount),
      });
    },
    async createExternalPayout(ctx) {
      const existing = store.get(ctx.idempotencyKey);
      if (existing) return existing;
      return remember(ctx.idempotencyKey, {
        providerId: `mock_payout_${ctx.idempotencyKey}`,
        status: "settled",
        rawStatus: "succeeded",
        providerMinorUnits: dollarToProviderMinorUnits(ctx.amount),
      });
    },
    async retrieveMovement(ctx) {
      const existing = store.get(ctx.idempotencyKey);
      if (existing) return existing;
      return {
        providerId: ctx.providerId,
        status: "unknown_outcome",
        rawStatus: "missing",
        nextAction: "Reconcile before creating a new movement.",
      };
    },
    async refundCollection(ctx) {
      const existing = store.get(ctx.idempotencyKey);
      if (existing) return existing;
      return remember(ctx.idempotencyKey, {
        providerId: `mock_refund_${ctx.idempotencyKey}`,
        status: "settled",
        rawStatus: "succeeded",
        providerMinorUnits: dollarToProviderMinorUnits(ctx.amount),
      });
    },
  };
}
