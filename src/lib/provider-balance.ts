import { prisma } from "@/lib/db";
import { ledgerMovements, reconcileLedger } from "@/lib/ledger";

export function compareProviderBalances(input: {
  internalHeldCents: number;
  internalReleasedCents: number;
  internalRefundedCents: number;
  providerHeldCents: number;
  providerReleasedCents: number;
  providerRefundedCents: number;
}):
  | {
      ok: true;
      matched: boolean;
      heldDifferenceCents: number;
      releasedDifferenceCents: number;
      refundedDifferenceCents: number;
    }
  | { ok: false; error: string } {
  const amounts = [
    input.internalHeldCents,
    input.internalReleasedCents,
    input.internalRefundedCents,
    input.providerHeldCents,
    input.providerReleasedCents,
    input.providerRefundedCents,
  ];
  if (amounts.some((amount) => !Number.isInteger(amount) || amount < 0)) {
    return { ok: false, error: "Provider balances must be whole minor units." };
  }
  const heldDifferenceCents = input.providerHeldCents - input.internalHeldCents;
  const releasedDifferenceCents = input.providerReleasedCents - input.internalReleasedCents;
  const refundedDifferenceCents = input.providerRefundedCents - input.internalRefundedCents;
  return {
    ok: true,
    matched: heldDifferenceCents === 0 && releasedDifferenceCents === 0 && refundedDifferenceCents === 0,
    heldDifferenceCents,
    releasedDifferenceCents,
    refundedDifferenceCents,
  };
}

/** Writes the comparison. It does not create ledger rows or change the funding status. */
export async function recordProviderBalanceComparison(input: {
  fundingId: string;
  actor: string;
  providerHeldCents: number;
  providerReleasedCents: number;
  providerRefundedCents: number;
}) {
  const funding = await prisma.collaborationFunding.findUnique({
    where: { id: input.fundingId },
    include: { entries: true },
  });
  if (!funding) return { ok: false as const, error: "Funding was not found." };
  const ledger = reconcileLedger(ledgerMovements(funding.entries), funding.grossCents);
  const comparison = compareProviderBalances({
    internalHeldCents: ledger.heldCents,
    internalReleasedCents: ledger.releasedCents,
    internalRefundedCents: ledger.refundedCents,
    providerHeldCents: input.providerHeldCents,
    providerReleasedCents: input.providerReleasedCents,
    providerRefundedCents: input.providerRefundedCents,
  });
  if (!comparison.ok) return comparison;
  await prisma.auditLog.create({
    data: {
      actor: input.actor.slice(0, 120),
      action: "provider_balance.compared",
      objectType: "CollaborationFunding",
      objectId: funding.id,
      after: comparison,
    },
  });
  return comparison;
}
