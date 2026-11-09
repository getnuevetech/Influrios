import { prisma } from "@/lib/db";

export type ProviderOperation = "collection" | "release" | "refund";

export function providerOperationKey(input: {
  agreementVersion: number;
  fundingId: string;
  milestoneId?: string | null;
  operation: ProviderOperation;
}) {
  const version = Number.isInteger(input.agreementVersion) && input.agreementVersion > 0 ? input.agreementVersion : 1;
  const fundingId = input.fundingId.trim();
  const milestoneId = input.milestoneId?.trim() || "funding";
  return `v${version}:${fundingId}:${milestoneId}:${input.operation}`;
}

/** A signed deal releases the influencer amount. Any other amount is not sent. */
export function releaseInstructionAmount(input: {
  releasableCents: number;
  signedInfluencerReceivesCents?: number | null;
}): { ok: true; amountCents: number } | { ok: false; error: string } {
  if (!Number.isInteger(input.releasableCents) || input.releasableCents <= 0) {
    return { ok: false, error: "Release needs a positive integer amount." };
  }
  if (input.signedInfluencerReceivesCents == null) return { ok: true, amountCents: input.releasableCents };
  if (input.releasableCents !== input.signedInfluencerReceivesCents) {
    return { ok: false, error: "The release instruction does not match the signed influencer amount." };
  }
  return { ok: true, amountCents: input.signedInfluencerReceivesCents };
}

/** A signed deal collects the business total. Any other amount is not sent. */
export function collectionInstructionAmount(input: {
  fundingGrossCents: number;
  signedBusinessPaysCents?: number | null;
}): { ok: true; amountCents: number } | { ok: false; error: string } {
  if (!Number.isInteger(input.fundingGrossCents) || input.fundingGrossCents <= 0) {
    return { ok: false, error: "Collection needs a positive integer amount." };
  }
  if (input.signedBusinessPaysCents == null) return { ok: true, amountCents: input.fundingGrossCents };
  if (input.fundingGrossCents !== input.signedBusinessPaysCents) {
    return { ok: false, error: "The collection instruction does not match the signed business payment." };
  }
  return { ok: true, amountCents: input.signedBusinessPaysCents };
}

/** A claimed or completed command is not sent again. A failed command can be tried three times. */
export function commandMayDispatch(status: string, attemptCount: number) {
  if (status === "dispatched" || status === "confirmed") return false;
  if (status === "pending" && attemptCount > 0) return false;
  if (status === "failed" && attemptCount < 3) return true;
  if (status === "pending" && attemptCount === 0) return true;
  return false;
}

function isUnique(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error && String(error.code) === "P2002";
}

/** Insert or claim the command before the provider is called. */
export async function claimProviderCommand(input: {
  agreementVersion: number;
  fundingId: string;
  milestoneId?: string | null;
  operation: ProviderOperation;
  amountCents: number;
  currency: string;
}): Promise<
  | { dispatch: true; commandId: string }
  | { dispatch: false; reason: string; providerRef?: string }
> {
  const operationKey = providerOperationKey(input);
  const currency = input.currency.trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(currency)) return { dispatch: false, reason: "The command currency is missing." };
  if (!Number.isInteger(input.amountCents) || input.amountCents <= 0) {
    return { dispatch: false, reason: "The command amount is missing." };
  }
  const existing = await prisma.providerCommand.findUnique({ where: { operationKey } });
  if (!existing) {
    try {
      const created = await prisma.providerCommand.create({
        data: {
          operationKey,
          fundingId: input.fundingId.trim(),
          milestoneId: input.milestoneId?.trim() || null,
          agreementVersion: input.agreementVersion > 0 ? input.agreementVersion : 1,
          operation: input.operation,
          amountCents: input.amountCents,
          currency,
          status: "pending",
          attemptCount: 1,
        },
      });
      return { dispatch: true, commandId: created.id };
    } catch (error) {
      if (!isUnique(error)) throw error;
    }
  }
  const row = existing ?? (await prisma.providerCommand.findUnique({ where: { operationKey } }));
  if (!row || !commandMayDispatch(row.status, row.attemptCount)) {
    return {
      dispatch: false,
      reason: "This provider command was already sent.",
      providerRef: row?.providerRef || undefined,
    };
  }
  if (row.amountCents !== input.amountCents || row.currency !== currency) {
    return { dispatch: false, reason: "The stored command amount does not match this instruction." };
  }
  const claimed = await prisma.providerCommand.updateMany({
    where: { id: row.id, status: row.status, attemptCount: row.attemptCount },
    data: { status: "pending", attemptCount: row.attemptCount + 1 },
  });
  if (claimed.count !== 1) return { dispatch: false, reason: "Another worker claimed this command." };
  return { dispatch: true, commandId: row.id };
}

export async function recordProviderCommandResult(input: {
  commandId: string;
  ok: boolean;
  providerRef?: string;
}) {
  if (!input.ok) {
    await prisma.providerCommand.updateMany({
      where: { id: input.commandId, status: "pending" },
      data: { status: "failed" },
    });
    return;
  }
  await prisma.providerCommand.updateMany({
    where: { id: input.commandId, status: "pending" },
    data: {
      status: "dispatched",
      providerRef: (input.providerRef ?? "").slice(0, 180),
      dispatchedAt: new Date(),
    },
  });
}
