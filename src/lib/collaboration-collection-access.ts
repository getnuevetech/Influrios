/**
 * Verifies collaboration collection access by probing the Stripe account and
 * applying environment-specific routing. Does not claim allocated funds or
 * Treasury when the account lacks them, and never opens live collection from
 * capability flags alone.
 */
import {
  interpretStripeAccountPayload,
  isStripeAccountRetrievePayload,
  resolveCollaborationCollectionRoute,
  type CollaborationCapabilityProbe,
  type CollaborationCollectionDecision,
} from "@/lib/payment-account-routing";
import { stripeCredentials, stripeCredentialError, stripeRetrieveResult } from "@/lib/stripe-admin";

export type CollaborationCollectionAccess = CollaborationCollectionDecision & {
  stripeKeyMode: "sandbox" | "live" | null;
  environment: "sandbox" | "live";
  probe: CollaborationCapabilityProbe;
  checkedAt: string;
};

async function probeCollaborationCapabilities(secret: string): Promise<CollaborationCapabilityProbe> {
  const account = await stripeRetrieveResult({ method: "GET", path: "/v1/account", secret });
  if (!account.ok) {
    return {
      status: "failed",
      allocatedFunds: false,
      treasury: false,
      reason: account.error,
      httpStatus: account.httpStatus,
    };
  }
  if (!isStripeAccountRetrievePayload(account.payload)) {
    return {
      status: "failed",
      allocatedFunds: false,
      treasury: false,
      reason:
        "Stripe account probe returned an invalid account payload. Verification stays unknown. Nothing was enabled.",
      httpStatus: account.httpStatus,
    };
  }
  const interpreted = interpretStripeAccountPayload(account.payload);
  const accountId = account.payload.id;

  let treasury = interpreted.treasury;
  if (!treasury) {
    const caps =
      account.payload.capabilities && typeof account.payload.capabilities === "object"
        ? (account.payload.capabilities as Record<string, unknown>)
        : {};
    const treasuryFlag = caps.treasury === "active" || caps.treasury_payments === "active";
    if (treasuryFlag) {
      const fa = await stripeRetrieveResult({
        method: "GET",
        path: "/v1/treasury/financial_accounts?limit=1",
        secret,
      });
      // FA list failure after a treasury capability flag is still a verification failure for treasury proof.
      if (!fa.ok) {
        return {
          status: "failed",
          allocatedFunds: interpreted.allocatedFunds,
          treasury: false,
          reason: fa.error,
          accountId,
          httpStatus: fa.httpStatus,
        };
      }
      treasury = Array.isArray(fa.payload.data) && fa.payload.data.length > 0;
    }
  }

  return {
    status: "checked",
    allocatedFunds: interpreted.allocatedFunds,
    treasury,
    reason: interpreted.reason,
    accountId,
    httpStatus: account.httpStatus,
  };
}

/**
 * Probe Stripe and resolve sandbox vs live collaboration collection.
 * Failed probes refuse.
 */
export async function verifyCollaborationCollectionAccess(input?: {
  originOrHost?: string;
  environment?: "sandbox" | "live";
  env?: Record<string, string | undefined>;
}): Promise<CollaborationCollectionAccess> {
  const checkedAt = new Date().toISOString();
  const originOrHost = input?.originOrHost ?? "";

  const creds = await stripeCredentials();
  if (!creds.ok) {
    const probe: CollaborationCapabilityProbe = {
      status: "failed",
      allocatedFunds: false,
      treasury: false,
      reason: stripeCredentialError(creds.reason, "charged"),
    };
    const refused = resolveCollaborationCollectionRoute({
      environment: input?.environment ?? "sandbox",
      stripeKeyMode: null,
      originOrHost,
      probe,
    });
    return {
      ...refused,
      stripeKeyMode: null,
      environment: input?.environment ?? "sandbox",
      probe,
      checkedAt,
    };
  }

  const environment = input?.environment ?? (creds.mode === "live" ? "live" : "sandbox");
  const probe = await probeCollaborationCapabilities(creds.secret);
  const decision = resolveCollaborationCollectionRoute({
    environment,
    stripeKeyMode: creds.mode,
    originOrHost,
    probe,
  });

  return {
    ...decision,
    stripeKeyMode: creds.mode,
    environment,
    probe,
    checkedAt,
  };
}
