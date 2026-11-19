/**
 * One executor for a v5 settlement. It does not run inside the approval transaction
 * and it does not call the legacy release sweep for the same milestone.
 * Without a proven topology it records the blocker and does not transfer or pay.
 * Sandbox ledger-hold may record a labelled simulation transfer ref — not provider E2E.
 * Simulation requires trusted deployment + explicit route enable + persisted funding provenance.
 */
import {
  authorizeSandboxLedgerHoldRelease,
  isSandboxLedgerHoldTransferRef,
  sandboxLedgerHoldReleaseSimulation,
  type SandboxCollectionProvenance,
} from "@/lib/payment-account-routing";
import { prisma } from "@/lib/db";

export type SettlementExecutorDeps = {
  findSettlement: (id: string) => Promise<{
    id: string;
    fundingId: string;
    payoutState: string;
    transferRef: string;
    taxReason: string;
  } | null>;
  findFundingRouteSnapshot: (fundingId: string) => Promise<unknown>;
  persistSandboxSimulation: (input: {
    settlementId: string;
    fundingId: string;
    transferRef: string;
    simulationLabel: string;
    note: string;
    limitation: string;
    provenance: SandboxCollectionProvenance;
    host: string;
    existingTaxReason: string;
  }) => Promise<void>;
  openCapabilityCase: (fundingId: string, settlementId: string, reason: string) => Promise<void>;
};

const defaultDeps: SettlementExecutorDeps = {
  async findSettlement(id) {
    return prisma.milestoneSettlementV4.findUnique({
      where: { id },
      select: { id: true, fundingId: true, payoutState: true, transferRef: true, taxReason: true },
    });
  },
  async findFundingRouteSnapshot(fundingId) {
    const funding = await prisma.collaborationFunding.findUnique({
      where: { id: fundingId },
      select: { routeSnapshotJson: true },
    });
    if (!funding) throw new Error("funding_missing");
    return funding.routeSnapshotJson;
  },
  async persistSandboxSimulation(input) {
    await prisma.$transaction([
      prisma.milestoneSettlementV4.update({
        where: { id: input.settlementId },
        data: {
          transferRef: input.transferRef,
          status: "dispatched",
          payoutState: "unknown",
          // Preserve taxReason / tax fields — simulation metadata lives on sourceAccountId + audit.
          sourceAccountId: `sandbox_ledger_hold:${input.provenance.originHost}`,
          commandKey: input.simulationLabel.slice(0, 190),
        },
      }),
      prisma.reconciliationCaseV4.create({
        data: {
          fundingId: input.fundingId,
          settlementId: input.settlementId,
          kind: "capability",
          status: "open",
          reason: `${input.simulationLabel}: ${input.note} ${input.limitation}`,
        },
      }),
      prisma.auditLog.create({
        data: {
          actor: "system",
          action: "settlement.sandbox_simulation",
          objectType: "MilestoneSettlementV4",
          objectId: input.settlementId,
          after: {
            fundingId: input.fundingId,
            transferRef: input.transferRef,
            simulation: true,
            providerE2eComplete: false,
            simulationLabel: input.simulationLabel,
            taxReasonPreserved: input.existingTaxReason,
            provenance: input.provenance,
            originOrHost: input.host,
          },
        },
      }),
    ]);
  },
  async openCapabilityCase(fundingId, settlementId, reason) {
    const existing = await prisma.reconciliationCaseV4.findFirst({
      where: { settlementId, kind: "capability", status: "open" },
    });
    if (existing) return;
    await prisma.reconciliationCaseV4
      .create({
        data: { fundingId, settlementId, kind: "capability", status: "open", reason },
      })
      .catch(() => undefined);
  },
};

export async function executeOwnedSettlement(
  settlementId: string,
  context?: { originOrHost?: string; env?: Record<string, string | undefined> },
  deps: SettlementExecutorDeps = defaultDeps,
) {
  const settlement = await deps.findSettlement(settlementId);
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

  let routeSnapshotJson: unknown;
  try {
    routeSnapshotJson = await deps.findFundingRouteSnapshot(settlement.fundingId);
  } catch {
    return { ok: false as const, state: "unknown" as const, error: "The funding for this settlement was not found." };
  }

  const auth = authorizeSandboxLedgerHoldRelease({
    env: context?.env,
    originOrHost: context?.originOrHost,
    routeSnapshotJson,
  });
  if (!auth.ok) {
    await deps.openCapabilityCase(settlement.fundingId, settlement.id, auth.error);
    return { ok: false as const, state: "blocked" as const, error: auth.error };
  }

  const sim = sandboxLedgerHoldReleaseSimulation({
    settlementId: settlement.id,
    fundingId: settlement.fundingId,
  });
  if (!sim.ok) return { ok: false as const, state: "blocked" as const, error: sim.error };

  try {
    await deps.persistSandboxSimulation({
      settlementId: settlement.id,
      fundingId: settlement.fundingId,
      transferRef: sim.transferRef,
      simulationLabel: sim.simulationLabel,
      note: sim.note,
      limitation: sim.limitation,
      provenance: auth.provenance,
      host: auth.host,
      existingTaxReason: settlement.taxReason,
    });
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
