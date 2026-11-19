/**
 * Verifies collaboration collection access by probing the Stripe account and
 * applying environment-specific routing. Does not claim allocated funds or
 * Treasury when the account lacks them, and never opens live collection from
 * capability flags alone.
 */
import {
  interpretStripeAccountPayload,
  isSandboxLedgerHoldRouteEnabled,
  isTrustedSandboxDeployment,
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
  trustedDeployment: boolean;
  sandboxRouteEnabled: boolean;
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
  const interpreted = interpretStripeAccountPayload(account.payload);
  const accountId = typeof account.payload.id === "string" ? account.payload.id : undefined;

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
 * Live stays closed. Failed probes refuse (not sandbox_ledger_hold).
 * Sandbox ledger-hold requires trusted deployment + explicit enable + host context.
 */
export async function verifyCollaborationCollectionAccess(input?: {
  originOrHost?: string;
  environment?: "sandbox" | "live";
  env?: Record<string, string | undefined>;
}): Promise<CollaborationCollectionAccess> {
  const checkedAt = new Date().toISOString();
  const env = input?.env ?? (process.env as Record<string, string | undefined>);
  const trustedDeployment = isTrustedSandboxDeployment(env);
  const sandboxRouteEnabled = isSandboxLedgerHoldRouteEnabled(env);
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
      trustedDeployment,
      sandboxRouteEnabled,
    });
    return {
      ...refused,
      stripeKeyMode: null,
      environment: input?.environment ?? "sandbox",
      probe,
      checkedAt,
      trustedDeployment,
      sandboxRouteEnabled,
    };
  }

  const environment = input?.environment ?? (creds.mode === "live" ? "live" : "sandbox");
  const probe = await probeCollaborationCapabilities(creds.secret);
  const decision = resolveCollaborationCollectionRoute({
    environment,
    stripeKeyMode: creds.mode,
    originOrHost,
    probe,
    trustedDeployment,
    sandboxRouteEnabled,
  });

  return {
    ...decision,
    stripeKeyMode: creds.mode,
    environment,
    probe,
    checkedAt,
    trustedDeployment,
    sandboxRouteEnabled,
  };
}
