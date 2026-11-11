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

/**
 * A signed deal releases this milestone's influencer amount.
 * One milestone may be a share of the signed total. The running total cannot pass it.
 */
export function releaseInstructionAmount(input: {
  releasableCents: number;
  signedInfluencerReceivesCents?: number | null;
  alreadyReleasedCents?: number;
}): { ok: true; amountCents: number } | { ok: false; error: string } {
  if (!Number.isInteger(input.releasableCents) || input.releasableCents <= 0) {
    return { ok: false, error: "Release needs a positive integer amount." };
  }
  if (input.signedInfluencerReceivesCents == null) return { ok: true, amountCents: input.releasableCents };
  const signed = input.signedInfluencerReceivesCents;
  const already = input.alreadyReleasedCents ?? 0;
  if (!Number.isInteger(signed) || signed <= 0 || !Number.isInteger(already) || already < 0) {
    return { ok: false, error: "The release instruction does not match the signed influencer amount." };
  }
  if (input.releasableCents > signed || already + input.releasableCents > signed) {
    return { ok: false, error: "The release instruction does not match the signed influencer amount." };
  }
  return { ok: true, amountCents: input.releasableCents };
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

/** A pending command with no provider reference is unknown after this long. It is not sent again. */
export const UNKNOWN_COMMAND_AFTER_MS = 15 * 60 * 1000;

export function commandNeedsReconciliation(input: {
  status: string;
  attemptCount: number;
  providerRef: string;
  ageMs: number;
}) {
  return (
    input.status === "pending" &&
    input.attemptCount > 0 &&
    !input.providerRef.trim() &&
    input.ageMs >= UNKNOWN_COMMAND_AFTER_MS
  );
}

/** A claimed or completed command is not sent again. A failed command can be tried until the admin attempt limit. */
export function commandMayDispatch(status: string, attemptCount: number, maxAttempts = 3) {
  const limit = Number.isInteger(maxAttempts) && maxAttempts > 0 ? maxAttempts : 3;
  if (status === "dispatched" || status === "confirmed") return false;
  if (status === "pending" && attemptCount > 0) return false;
  if (status === "failed" && attemptCount < limit) return true;
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
  const { loadProcessTimings } = await import("@/lib/process-timing");
  const maxAttempts = (await loadProcessTimings().catch(() => null))?.providerCommandMaxAttempts ?? 3;
  if (!row || !commandMayDispatch(row.status, row.attemptCount, maxAttempts)) {
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

/** Marks a claimed command with no provider result as unknown. It does not send the command again. */
export async function markUnknownProviderCommands(now = new Date(), afterMs?: number) {
  const { loadProcessTimings } = await import("@/lib/process-timing");
  const minutes = (await loadProcessTimings().catch(() => null))?.unknownCommandMinutes;
  const windowMs = afterMs ?? (minutes ? minutes * 60 * 1000 : UNKNOWN_COMMAND_AFTER_MS);
  const cutoff = new Date(now.getTime() - windowMs);
  const result = await prisma.providerCommand.updateMany({
    where: {
      status: "pending",
      attemptCount: { gt: 0 },
      providerRef: "",
      updatedAt: { lt: cutoff },
    },
    data: { status: "unknown" },
  });
  return result.count;
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
