/**
 * Release execution planning for Payment Standard v2.
 * Commit reservations and legs before any provider call. Amounts are dollars.
 */
import type { Dollar } from "@/lib/payment-money";
import { addDollars, dollarsEqual, subDollars, zeroDollar } from "@/lib/payment-money";
import type { GatewayAdapterV2 } from "@/lib/payment-standard-v2-adapter";
import {
  assertUniqueReleaseAuthorization,
  buildReleaseAuthorization,
  type ReleaseAuthorizationPlan,
  type ReleaseLegPlan,
} from "@/lib/payment-standard-v2";

export type ReleaseBatchStatus = "pending" | "processing" | "partially_completed" | "completed" | "blocked";

export type ReleaseLegRecord = ReleaseLegPlan & {
  legId: string;
  status: "queued" | "submitted" | "settled" | "failed" | "unknown_outcome";
  providerId: string | null;
};

export type ReleaseBatchRecord = {
  batchId: string;
  authorization: ReleaseAuthorizationPlan;
  status: ReleaseBatchStatus;
  legs: ReleaseLegRecord[];
  availableBefore: Dollar;
  reserved: Dollar;
};

export type FundingAvailability = {
  available: Dollar;
  currency: string;
};

export function planReleaseBatch(input: {
  batchId: string;
  agreementId: string;
  agreementVersion: number;
  milestoneName: string;
  currency: string;
  influencerNet: Dollar;
  operationsFee: Dollar;
  influencerBeneficiaryRef: string;
  operationsAccountRef: string;
  available: FundingAvailability;
  existingAuthorizationKeys: ReadonlySet<string>;
  influencerMethod?: ReleaseLegPlan["movementMethod"];
  operationsMethod?: ReleaseLegPlan["movementMethod"];
}): { ok: true; batch: ReleaseBatchRecord } | { ok: false; error: string; status: ReleaseBatchStatus } {
  if (input.available.currency !== input.currency) {
    return { ok: false, error: "Funding currency does not match the release currency.", status: "blocked" };
  }
  const authorization = buildReleaseAuthorization({
    agreementId: input.agreementId,
    agreementVersion: input.agreementVersion,
    milestoneName: input.milestoneName,
    currency: input.currency,
    influencerNet: input.influencerNet,
    operationsFee: input.operationsFee,
    influencerBeneficiaryRef: input.influencerBeneficiaryRef,
    operationsAccountRef: input.operationsAccountRef,
    influencerMethod: input.influencerMethod,
    operationsMethod: input.operationsMethod,
  });
  const unique = assertUniqueReleaseAuthorization(input.existingAuthorizationKeys, authorization);
  if (!unique.ok) {
    return { ok: false, error: unique.error, status: "blocked" };
  }
  const reserved = authorization.total;
  if (subDollars(input.available.available, reserved).startsWith("-")) {
    return {
      ok: false,
      error: `Release pending: available ${input.available.available} is less than reserved ${reserved}.`,
      status: "blocked",
    };
  }
  const legs: ReleaseLegRecord[] = authorization.legs.map((leg, index) => ({
    ...leg,
    legId: `${input.batchId}:leg${index + 1}`,
    status: "queued",
    providerId: null,
  }));
  return {
    ok: true,
    batch: {
      batchId: input.batchId,
      authorization,
      status: "pending",
      legs,
      availableBefore: input.available.available,
      reserved,
    },
  };
}

/**
 * Execute only unfinished legs. A settled influencer leg is never recreated
 * because Operations failed (REL03).
 */
export async function executeReleaseBatch(input: {
  batch: ReleaseBatchRecord;
  adapter: GatewayAdapterV2;
  integrationId: string;
  environment: "sandbox" | "live";
  collaborationAccountId: string;
  failLegIds?: ReadonlySet<string>;
}): Promise<ReleaseBatchRecord> {
  const legs: ReleaseLegRecord[] = [];
  for (const leg of input.batch.legs) {
    if (leg.status === "settled") {
      legs.push(leg);
      continue;
    }
    if (input.failLegIds?.has(leg.legId)) {
      legs.push({ ...leg, status: "failed", providerId: null });
      continue;
    }
    const idempotencyKey = `${input.batch.authorization.authorizationKey}:${leg.legId}`;
    const ctx = {
      integrationId: input.integrationId,
      environment: input.environment,
      sourceAccountId: input.collaborationAccountId,
      destinationAccountId: leg.beneficiaryRef,
      obligationId: input.batch.authorization.authorizationKey,
      amount: leg.amount,
      currency: input.batch.authorization.currency,
      idempotencyKey,
      businessReference: input.batch.batchId,
    };
    const result =
      leg.movementMethod === "direct_external_payout"
        ? await input.adapter.createExternalPayout({ ...ctx, destinationAccountId: leg.beneficiaryRef })
        : await input.adapter.transferBetweenAccounts({ ...ctx, destinationAccountId: leg.beneficiaryRef });

    if (result.status === "settled") {
      legs.push({ ...leg, status: "settled", providerId: result.providerId });
    } else if (result.status === "unknown_outcome" || result.status === "pending" || result.status === "submitted") {
      legs.push({ ...leg, status: "unknown_outcome", providerId: result.providerId });
    } else {
      legs.push({ ...leg, status: "failed", providerId: result.providerId });
    }
  }

  const settled = legs.filter((leg) => leg.status === "settled");
  const failed = legs.filter((leg) => leg.status === "failed" || leg.status === "unknown_outcome");
  let status: ReleaseBatchRecord["status"] = "processing";
  if (settled.length === legs.length) status = "completed";
  else if (settled.length > 0 && failed.length > 0) status = "partially_completed";
  else if (settled.length === 0 && failed.length === legs.length) status = "blocked";

  return { ...input.batch, legs, status };
}

export function retryIncompleteLegsOnly(batch: ReleaseBatchRecord): ReleaseLegRecord[] {
  return batch.legs.filter((leg) => leg.status !== "settled");
}

export function operationsSweepEligible(input: {
  earnedOperations: Dollar;
  alreadySwept: Dollar;
  reserves: Dollar;
  refunds: Dollar;
  pendingSweep: Dollar;
  collaborationCompleted: boolean;
}): { ok: true; sweepable: Dollar } | { ok: false; reason: string } {
  if (!input.collaborationCompleted) {
    return { ok: false, reason: "Operations bank sweep waits until collaboration completion." };
  }
  const sweepable = subDollars(
    subDollars(subDollars(subDollars(input.earnedOperations, input.alreadySwept), input.reserves), input.refunds),
    input.pendingSweep,
  );
  if (sweepable.startsWith("-") || dollarsEqual(sweepable, zeroDollar())) {
    return { ok: false, reason: "No eligible Operations cash to sweep for this campaign." };
  }
  return { ok: true, sweepable };
}

export function reservedAfterPartial(batch: ReleaseBatchRecord): Dollar {
  return batch.legs
    .filter((leg) => leg.status === "settled")
    .reduce((sum, leg) => addDollars(sum, leg.amount), zeroDollar());
}
