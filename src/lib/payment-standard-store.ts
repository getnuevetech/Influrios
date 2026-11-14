/**
 * Durable payment-standard records. These rows do not mark provider cash as moved.
 */
import { prisma } from "@/lib/db";
import { planRouteDraft, settlementCommandKey } from "@/lib/payment-account-routing";
import { providerOperationKey } from "@/lib/provider-outbox";
import { rightsAfterAcceptance } from "@/lib/content-rights";
import { planCoupledSettlement } from "@/lib/payment-standard-v4";

export async function nextRouteVersion(countryCode: string, environment: string) {
  const latest = await prisma.paymentRouteVersion.findFirst({
    where: { countryCode, environment },
    orderBy: { version: "desc" },
    select: { version: true },
  });
  return (latest?.version ?? 0) + 1;
}

function isUnique(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error && String(error.code) === "P2002";
}

export async function saveRouteDraft(input: {
  countryCode: string;
  environment: "sandbox" | "live";
  currency: string;
  providerCode: string;
  allocatedFundsApproved: boolean;
  newCollectionsEnabled: boolean;
  releasesEnabled: boolean;
  operationsWithdrawalEnabled?: boolean;
  bankPayoutControl?: boolean;
  evidence: string;
  capabilityEvidence?: unknown;
  collaborationProvider?: string;
  operationsProvider?: string;
  transferBridgeApproved?: boolean;
}) {
  const planned = planRouteDraft(input);
  if (!planned.ok) return planned;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const row = await prisma.$transaction(async (tx) => {
        const latest = await tx.paymentRouteVersion.findFirst({
          where: { countryCode: planned.countryCode, environment: planned.environment },
          orderBy: { version: "desc" },
          select: { version: true },
        });
        return tx.paymentRouteVersion.create({
          data: {
            countryCode: planned.countryCode,
            version: (latest?.version ?? 0) + 1,
            currency: planned.currency,
            environment: planned.environment,
            providerCode: planned.providerCode,
            status: "draft",
            newCollectionsEnabled: planned.newCollectionsEnabled,
            releasesEnabled: planned.releasesEnabled,
            operationsWithdrawalEnabled: planned.operationsWithdrawalEnabled,
            bankPayoutControl: planned.bankPayoutControl,
            topology: planned.topology,
            proofState: planned.proofState,
            roleMappingJson: planned.roleMapping,
            capabilitiesJson: planned.capabilities,
            approvalEvidence: planned.approvalEvidence,
            allocatedFundsApproved: planned.allocatedFundsApproved,
            bindings: {
              create: planned.roleMapping.map((role) => ({
                role: role.role,
                providerAccountId: role.externalAccountId,
                financialAccountId: role.financialAccountId,
                operationsJson: role.operations,
                balanceScope: role.verified ? "verified" : "unverified",
              })),
            },
          },
        });
      });
      return { ok: true as const, id: row.id, version: row.version };
    } catch (error) {
      if (isUnique(error) && attempt < 2) continue;
      if (isUnique(error)) return { ok: false as const, error: "That route version was saved by someone else. Open the latest draft. Nothing was enabled." };
      throw error;
    }
  }
  return { ok: false as const, error: "That route version was saved by someone else. Nothing was enabled." };
}

export async function saveTaxPolicyDraft(input: {
  name: string;
  liableEntity: string;
  treatment: string;
  customerRole: string;
  jurisdiction: string;
  classification: string;
  filingOwner: string;
  inclusive: boolean;
  rateBps: number | null;
  notes: string;
}) {
  const allowed = ["taxable", "exempt", "non_taxable", "no_collection_obligation", "unresolved"];
  if (!allowed.includes(input.treatment)) return { ok: false as const, error: "Choose an explicit tax treatment." };
  if (input.treatment === "taxable") {
    if (!input.jurisdiction.trim()) return { ok: false as const, error: "A taxable policy needs a jurisdiction." };
    if (input.rateBps == null || !Number.isInteger(input.rateBps) || input.rateBps < 0) {
      return { ok: false as const, error: "A taxable policy needs a jurisdiction rate in basis points, not a flat amount." };
    }
  }
  const name = input.name.trim();
  if (name.length < 3) return { ok: false as const, error: "Name the tax policy." };
  const latest = await prisma.taxPolicyVersion.findFirst({ where: { name }, orderBy: { version: "desc" } });
  const row = await prisma.taxPolicyVersion.create({
    data: {
      name,
      version: (latest?.version ?? 0) + 1,
      liableEntity: input.liableEntity.trim() || "Unresolved",
      treatment: input.treatment,
      customerRole: input.customerRole,
      jurisdiction: input.jurisdiction.trim(),
      classification: input.classification.trim(),
      filingOwner: input.filingOwner.trim(),
      inclusive: input.inclusive,
      rateBps: input.treatment === "taxable" ? input.rateBps : null,
      notes: input.notes.trim(),
      status: "draft",
    },
  });
  return { ok: true as const, id: row.id, version: row.version };
}

export async function recordMilestoneSettlement(input: {
  fundingId: string;
  milestoneId: string;
  agreementVersion: number;
  currency: string;
  grossCents: number;
  businessFeeCents: number;
  influencerFeeCents: number;
}) {
  const plan = planCoupledSettlement({
    grossCents: input.grossCents,
    businessFeeCents: input.businessFeeCents,
    influencerFeeCents: input.influencerFeeCents,
    alreadySettled: false,
    transferConfirmed: false,
    existingTransferRef: "",
    payoutState: "queued",
  });
  if (!plan.ok) return plan;
  const idempotencyKey = settlementCommandKey({ milestoneId: input.milestoneId, agreementVersion: input.agreementVersion });
  const existing = await prisma.milestoneSettlementV4.findUnique({ where: { idempotencyKey } });
  if (existing) return { ok: true as const, id: existing.id, reused: true };
  try {
    const row = await prisma.milestoneSettlementV4.create({
      data: {
        fundingId: input.fundingId,
        milestoneId: input.milestoneId,
        agreementVersion: input.agreementVersion,
        currency: input.currency,
        grossCents: input.grossCents,
        businessFeeCents: input.businessFeeCents,
        influencerFeeCents: input.influencerFeeCents,
        influencerNetCents: plan.influencerNetCents,
        operationsFeeCents: plan.operationsFeeCents,
        idempotencyKey,
        commandKey: idempotencyKey,
        status: "planned",
        payoutState: "queued",
        legs: {
          create: [
            { leg: "influencer_net", amountCents: plan.influencerNetCents, status: "planned" },
            { leg: "operations_fees", amountCents: plan.operationsFeeCents, status: "planned" },
          ],
        },
      },
    });
    return { ok: true as const, id: row.id, reused: false };
  } catch (error) {
    if (!isUnique(error)) throw error;
    const raced = await prisma.milestoneSettlementV4.findUnique({ where: { idempotencyKey } });
    if (!raced) return { ok: false as const, error: "The settlement could not be stored. Nothing was released." };
    return { ok: true as const, id: raced.id, reused: true };
  }
}

/** Approval, one settlement, and one outbox command. No provider call runs inside this transaction. */
export async function commitMilestoneReleasePlan(input: {
  fundingId: string;
  milestoneId: string;
  submissionVersion: number;
  agreementVersion: number;
  currency: string;
  grossCents: number;
  businessFeeCents: number;
  influencerFeeCents: number;
  rightsActivateOn: string;
  rightsStatus: string;
  releaseApproved: boolean;
}) {
  const plan = planCoupledSettlement({
    grossCents: input.grossCents,
    businessFeeCents: input.businessFeeCents,
    influencerFeeCents: input.influencerFeeCents,
    alreadySettled: false,
    transferConfirmed: false,
    existingTransferRef: "",
    payoutState: "queued",
  });
  if (!plan.ok) return plan;
  const idempotencyKey = settlementCommandKey({ milestoneId: input.milestoneId, agreementVersion: input.agreementVersion });
  const operationKey = providerOperationKey({
    agreementVersion: input.agreementVersion,
    fundingId: input.fundingId,
    milestoneId: input.milestoneId,
    operation: "release",
  });
  const now = new Date();
  const rights = rightsAfterAcceptance({ activateOn: input.rightsActivateOn, currentStatus: input.rightsStatus });
  try {
    return await prisma.$transaction(async (tx) => {
      const existing = await tx.milestoneSettlementV4.findUnique({ where: { idempotencyKey } });
      if (existing) return { ok: true as const, id: existing.id, reused: true, commandKey: operationKey };
      const claimed = await tx.fundingMilestone.updateMany({
        where: { id: input.milestoneId, fundingId: input.fundingId, status: "submitted" },
        data: {
          status: "release_scheduled",
          approvedAt: now,
          releaseScheduledAt: now,
          releaseApprovedAt: input.releaseApproved ? now : null,
          ...(rights.status !== "pending" ? { rightsStatus: rights.status, rightsActivatedAt: now } : {}),
        },
      });
      if (claimed.count !== 1) {
        return { ok: false as const, error: "That milestone cannot take this step. Nothing was released." };
      }
      const row = await tx.milestoneSettlementV4.create({
        data: {
          fundingId: input.fundingId,
          milestoneId: input.milestoneId,
          agreementVersion: input.agreementVersion,
          currency: input.currency,
          grossCents: input.grossCents,
          businessFeeCents: input.businessFeeCents,
          influencerFeeCents: input.influencerFeeCents,
          influencerNetCents: plan.influencerNetCents,
          operationsFeeCents: plan.operationsFeeCents,
          idempotencyKey,
          commandKey: operationKey,
          status: "planned",
          payoutState: "queued",
          legs: {
            create: [
              { leg: "influencer_net", amountCents: plan.influencerNetCents, status: "planned", instructionKey: `${operationKey}:influencer_net` },
              { leg: "operations_fees", amountCents: plan.operationsFeeCents, status: "planned", instructionKey: `${operationKey}:operations_fees` },
            ],
          },
        },
      });
      await tx.providerCommand.create({
        data: {
          operationKey,
          fundingId: input.fundingId,
          milestoneId: input.milestoneId,
          agreementVersion: input.agreementVersion,
          operation: "release",
          amountCents: plan.influencerNetCents + plan.operationsFeeCents,
          currency: input.currency,
          status: "pending",
          attemptCount: 0,
        },
      });
      await tx.milestoneSubmission.updateMany({
        where: { milestoneId: input.milestoneId, version: input.submissionVersion },
        data: { status: "approved" },
      });
      return { ok: true as const, id: row.id, reused: false, commandKey: operationKey };
    });
  } catch (error) {
    if (!isUnique(error)) throw error;
    const raced = await prisma.milestoneSettlementV4.findUnique({ where: { idempotencyKey } });
    if (!raced) return { ok: false as const, error: "This approval collided with another. Nothing else was released." };
    return { ok: true as const, id: raced.id, reused: true, commandKey: operationKey };
  }
}

export async function recordProviderEvent(input: {
  providerCode: string;
  environment: string;
  accountContext: string;
  eventId: string;
  eventType: string;
  livemode: boolean;
  payloadHash: string;
  fundingId?: string;
}) {
  try {
    await prisma.providerEventInbox.create({
      data: {
        providerCode: input.providerCode,
        environment: input.environment,
        accountContext: input.accountContext,
        eventId: input.eventId,
        eventType: input.eventType,
        livemode: input.livemode,
        payloadHash: input.payloadHash,
        fundingId: input.fundingId ?? "",
        status: "received",
      },
    });
    return { ok: true as const, duplicate: false };
  } catch (error) {
    if (isUnique(error)) return { ok: true as const, duplicate: true };
    return { ok: false as const, reason: "unavailable" as const };
  }
}
