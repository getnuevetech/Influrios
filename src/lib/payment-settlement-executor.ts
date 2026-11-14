/**
 * One executor for a v5 settlement. It does not run inside the approval transaction
 * and it does not call the legacy release sweep for the same milestone.
 * Without a proven topology it records the blocker and does not transfer or pay.
 */
import { prisma } from "@/lib/db";
import { collaborationCollectionGate } from "@/lib/payment-account-routing";

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
  const gate = collaborationCollectionGate({ allocatedFunds: false, treasury: false });
  const reason = gate.ok ? "Distribution is not proven. Nothing was transferred." : gate.error;
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
