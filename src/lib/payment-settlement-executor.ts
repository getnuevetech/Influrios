/**
 * One executor for a v5 settlement. It does not run inside the approval transaction
 * and it does not call the legacy release sweep for the same milestone.
 * Without a proven topology it records the blocker and does not transfer or pay.
 * Sandbox ledger-hold may record a labelled simulation transfer ref — not provider E2E.
 * Simulation requires trusted deployment + explicit route enable + persisted funding provenance.
 */
import {
  isSandboxLedgerHoldRouteEnabled,
  isSandboxLedgerHoldTransferRef,
  isTrustedSandboxDeployment,
  readSandboxCollectionProvenance,
  sandboxLedgerHoldReleaseSimulation,
} from "@/lib/payment-account-routing";
import { prisma } from "@/lib/db";

export async function executeOwnedSettlement(
  settlementId: string,
  context?: { originOrHost?: string; env?: Record<string, string | undefined> },
) {
  const settlement = await prisma.milestoneSettlementV4.findUnique({
    where: { id: settlementId },
    include: { legs: true },
  });
  if (!settlement) return { ok: false as const, state: "unknown" as const, error: "The settlement was not found." };
  if (settlement.payoutState === "paid") return { ok: true as const, state: "paid" as const };

  const existingRef = settlement.transferRef.trim();
  if (existingRef) {
    if (isSandboxLedgerHoldTransferRef(existingRef)) {
      return {
        ok: true as const,
        state: "sandbox_simulation" as const,
        simulation: true as const,
        providerE2eComplete: false as const,
        transferRef: existingRef,
      };
    }
    return { ok: true as const, state: "transfer_recorded" as const };
  }

  const env = context?.env ?? (process.env as Record<string, string | undefined>);
  if (!isTrustedSandboxDeployment(env)) {
    return {
      ok: false as const,
      state: "blocked" as const,
      error: "Sandbox settlement simulation is only allowed on a trusted non-production deployment. Nothing was transferred.",
    };
  }
  if (!isSandboxLedgerHoldRouteEnabled(env)) {
    return {
      ok: false as const,
      state: "blocked" as const,
      error: "Sandbox settlement simulation requires COLLABORATION_SANDBOX_LEDGER_HOLD=1. Nothing was transferred.",
    };
  }

  const funding = await prisma.collaborationFunding.findUnique({
    where: { id: settlement.fundingId },
    select: { id: true, routeSnapshotJson: true },
  });
  if (!funding) {
    return { ok: false as const, state: "unknown" as const, error: "The funding for this settlement was not found." };
  }

  // Provenance is frozen on the funding at deposit open — do not reclassify from the current Stripe key.
  const provenance = readSandboxCollectionProvenance(funding.routeSnapshotJson);
  if (!provenance) {
    const reason =
      "Sandbox settlement simulation needs persisted sandbox_ledger_hold provenance on the funding. Live distribution stays blocked. Nothing was transferred.";
    await openCapabilityCase(settlement.fundingId, settlement.id, reason);
    return { ok: false as const, state: "blocked" as const, error: reason };
  }

  const host = (context?.originOrHost ?? provenance.originHost).trim();
  if (!host) {
    return {
      ok: false as const,
      state: "blocked" as const,
      error: "Sandbox settlement simulation needs a request host. Nothing was transferred.",
    };
  }

  const sim = sandboxLedgerHoldReleaseSimulation({
    settlementId: settlement.id,
    fundingId: settlement.fundingId,
  });
  if (!sim.ok) return { ok: false as const, state: "blocked" as const, error: sim.error };

  try {
    await prisma.$transaction([
      prisma.milestoneSettlementV4.update({
        where: { id: settlement.id },
        data: {
          transferRef: sim.transferRef,
          status: "dispatched",
          payoutState: "unknown",
          taxReason: sim.simulationLabel,
          sourceAccountId: `sandbox_ledger_hold:${provenance.originHost}`,
        },
      }),
      prisma.reconciliationCaseV4.create({
        data: {
          fundingId: settlement.fundingId,
          settlementId: settlement.id,
          kind: "capability",
          status: "open",
          reason: `${sim.simulationLabel}: ${sim.note} ${sim.limitation}`,
        },
      }),
      prisma.auditLog.create({
        data: {
          actor: "system",
          action: "settlement.sandbox_simulation",
          objectType: "MilestoneSettlementV4",
          objectId: settlement.id,
          after: {
            fundingId: settlement.fundingId,
            transferRef: sim.transferRef,
            simulation: true,
            providerE2eComplete: false,
            provenance,
            originOrHost: host,
          },
        },
      }),
    ]);
  } catch {
    return {
      ok: false as const,
      state: "blocked" as const,
      error: "Sandbox settlement simulation could not be persisted. Nothing was transferred.",
    };
  }

  return {
    ok: true as const,
    state: "sandbox_simulation" as const,
    simulation: true as const,
    providerE2eComplete: false as const,
    transferRef: sim.transferRef,
  };
}

async function openCapabilityCase(fundingId: string, settlementId: string, reason: string) {
  const existing = await prisma.reconciliationCaseV4.findFirst({
    where: { settlementId, kind: "capability", status: "open" },
  });
  if (existing) return;
  await prisma.reconciliationCaseV4
    .create({
      data: {
        fundingId,
        settlementId,
        kind: "capability",
        status: "open",
        reason,
      },
    })
    .catch(() => undefined);
}
