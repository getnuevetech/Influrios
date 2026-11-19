/**
 * Verifies collaboration collection access by probing the Stripe account and
 * applying environment-specific routing. Does not claim allocated funds or
 * Treasury when the account lacks them.
 */
import {
  interpretStripeAccountPayload,
  resolveCollaborationCollectionRoute,
  type CollaborationCapabilityProbe,
  type CollaborationCollectionDecision,
} from "@/lib/payment-account-routing";
import { stripeCredentials, stripeCredentialError, stripeRetrievePayload } from "@/lib/stripe-admin";

export type CollaborationCollectionAccess = CollaborationCollectionDecision & {
  stripeKeyMode: "sandbox" | "live" | null;
  environment: "sandbox" | "live";
  probe: CollaborationCapabilityProbe;
};

async function probeCollaborationCapabilities(secret: string): Promise<CollaborationCapabilityProbe> {
  const payload = await stripeRetrievePayload({ method: "GET", path: "/v1/account", secret });
  if (!payload) {
    return {
      allocatedFunds: false,
      treasury: false,
      reason: "Stripe account could not be retrieved. Nothing was enabled.",
    };
  }
  const interpreted = interpretStripeAccountPayload(payload);
  const accountId = typeof payload.id === "string" ? payload.id : undefined;

  // Treasury needs an onboarded financial account, not only a capability flag.
  let treasury = interpreted.treasury;
  if (!treasury) {
    const caps =
      payload.capabilities && typeof payload.capabilities === "object"
        ? (payload.capabilities as Record<string, unknown>)
        : {};
    const treasuryFlag = caps.treasury === "active" || caps.treasury_payments === "active";
    if (treasuryFlag) {
      const fa = await stripeRetrievePayload({
        method: "GET",
        path: "/v1/treasury/financial_accounts?limit=1",
        secret,
      });
      treasury = Boolean(fa && Array.isArray(fa.data) && fa.data.length > 0);
    }
  }

  return {
    allocatedFunds: interpreted.allocatedFunds,
    treasury,
    reason: interpreted.reason,
    accountId,
  };
}

/**
 * Probe Stripe and resolve sandbox vs live collaboration collection.
 * Live without allocated funds / Treasury stays closed.
 * Sandbox without those capabilities may open labelled `sandbox_ledger_hold` only.
 */
export async function verifyCollaborationCollectionAccess(input?: {
  originOrHost?: string;
  environment?: "sandbox" | "live";
}): Promise<CollaborationCollectionAccess> {
  const creds = await stripeCredentials();
  if (!creds.ok) {
    const probe: CollaborationCapabilityProbe = {
      allocatedFunds: false,
      treasury: false,
      reason: stripeCredentialError(creds.reason, "charged"),
    };
    const refused = resolveCollaborationCollectionRoute({
      environment: input?.environment ?? "sandbox",
      stripeKeyMode: null,
      originOrHost: input?.originOrHost ?? "",
      probe,
    });
    return {
      ...refused,
      stripeKeyMode: null,
      environment: input?.environment ?? "sandbox",
      probe,
    };
  }

  const environment = input?.environment ?? creds.mode;
  const probe = await probeCollaborationCapabilities(creds.secret);
  const decision = resolveCollaborationCollectionRoute({
    environment,
    stripeKeyMode: creds.mode,
    originOrHost: input?.originOrHost ?? "",
    probe,
  });

  return {
    ...decision,
    stripeKeyMode: creds.mode,
    environment,
    probe,
  };
}
