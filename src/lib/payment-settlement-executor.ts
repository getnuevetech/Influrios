/**
 * One executor for a v5 settlement. It does not run inside the approval transaction
 * and it does not call the legacy release sweep for the same milestone.
 * Without a proven topology it records the blocker and does not transfer or pay.
 * Sandbox ledger-hold may record a labelled simulation transfer ref — not provider E2E.
 */
import { verifyCollaborationCollectionAccess } from "@/lib/collaboration-collection-access";
import { sandboxLedgerHoldReleaseSimulation } from "@/lib/payment-account-routing";
import { prisma } from "@/lib/db";

export async function executeOwnedSettlement(settlementId: string) {
  const settlement = await prisma.milestoneSettlementV4.findUnique({
    where: { id: settlementId },
    include: { legs: true },
  });
  if (!settlement) return { ok: false as const, state: "unknown" as const, error: "The settlement was not found." };
  if (settlement.payoutState === "paid") return { ok: true as const, state: "paid" as const };
  if (settlement.transferRef.trim()) {
    return { ok: true as const, state: "transfer_recorded" as const };
  }

  const access = await verifyCollaborationCollectionAccess();
  if (access.ok && access.topology === "sandbox_ledger_hold") {
    const sim = sandboxLedgerHoldReleaseSimulation({
      settlementId: settlement.id,
      fundingId: settlement.fundingId,
    });
    if (!sim.ok) return { ok: false as const, state: "blocked" as const, error: sim.error };
    await prisma.milestoneSettlementV4
      .update({
        where: { id: settlement.id },
        data: {
          transferRef: sim.transferRef,
          status: "dispatched",
          payoutState: "unknown",
        },
      })
      .catch(() => undefined);
    await prisma.reconciliationCaseV4
      .create({
        data: {
          fundingId: settlement.fundingId,
          settlementId: settlement.id,
          kind: "capability",
          status: "open",
          reason: `${sim.simulationLabel}: ${sim.note} ${sim.limitation}`,
        },
      })
      .catch(() => undefined);
    return {
      ok: true as const,
      state: "sandbox_simulation" as const,
      simulation: true as const,
      providerE2eComplete: false as const,
      transferRef: sim.transferRef,
    };
  }

  const reason = access.ok
    ? "Distribution is not proven. Nothing was transferred."
    : access.error;
  const existing = await prisma.reconciliationCaseV4.findFirst({
    where: { settlementId: settlement.id, kind: "capability", status: "open" },
  });
  if (!existing) {
    await prisma.reconciliationCaseV4
      .create({
        data: {
          fundingId: settlement.fundingId,
          settlementId: settlement.id,
          kind: "capability",
          status: "open",
          reason,
        },
      })
      .catch(() => undefined);
  }
  return { ok: false as const, state: "blocked" as const, error: reason };
}
