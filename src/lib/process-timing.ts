import { prisma } from "@/lib/db";

/** Starting clocks. Admin can replace them. Security timeouts stay fixed. */
export const DEFAULT_PROCESS_TIMING = {
  reviewWindowHours: 72,
  quoteValidHours: 168,
  unknownCommandMinutes: 15,
  providerCommandMaxAttempts: 3,
  disputeSlaHours: 72,
  providerHoldWarnHours: 168,
  failedPayoutBackoffHours: [1, 6, 24, 72] as number[],
  failedPayoutMaxAttempts: 4,
  staleFundingHours: 48,
  reviewDeadlineLeadHours: 12,
  teamProposalLifeDays: 14,
};

export type ProcessTiming = typeof DEFAULT_PROCESS_TIMING;

export function parseBackoffHours(value: string): number[] | null {
  const parts = value
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length < 1 || parts.length > 8) return null;
  const hours = parts.map((part) => Number(part));
  if (hours.some((hour) => !Number.isInteger(hour) || hour < 1 || hour > 720)) return null;
  return hours;
}

function bounded(value: number | null | undefined, fallback: number, min: number, max: number) {
  if (!Number.isInteger(value) || value == null || value < min || value > max) return fallback;
  return value;
}

export function processTimingFromRow(row: {
  reviewWindowHours?: number | null;
  quoteValidHours?: number | null;
  unknownCommandMinutes?: number | null;
  providerCommandMaxAttempts?: number | null;
  disputeSlaHours?: number | null;
  providerHoldWarnHours?: number | null;
  failedPayoutBackoffHours?: string | null;
  failedPayoutMaxAttempts?: number | null;
  staleFundingHours?: number | null;
  reviewDeadlineLeadHours?: number | null;
  teamProposalLifeDays?: number | null;
} | null): ProcessTiming {
  const backoff = parseBackoffHours(row?.failedPayoutBackoffHours ?? "");
  return {
    reviewWindowHours: bounded(row?.reviewWindowHours, DEFAULT_PROCESS_TIMING.reviewWindowHours, 1, 720),
    quoteValidHours: bounded(row?.quoteValidHours, DEFAULT_PROCESS_TIMING.quoteValidHours, 1, 2160),
    unknownCommandMinutes: bounded(row?.unknownCommandMinutes, DEFAULT_PROCESS_TIMING.unknownCommandMinutes, 1, 1440),
    providerCommandMaxAttempts: bounded(
      row?.providerCommandMaxAttempts,
      DEFAULT_PROCESS_TIMING.providerCommandMaxAttempts,
      1,
      10,
    ),
    disputeSlaHours: bounded(row?.disputeSlaHours, DEFAULT_PROCESS_TIMING.disputeSlaHours, 1, 720),
    providerHoldWarnHours: bounded(row?.providerHoldWarnHours, DEFAULT_PROCESS_TIMING.providerHoldWarnHours, 1, 2160),
    failedPayoutBackoffHours: backoff ?? DEFAULT_PROCESS_TIMING.failedPayoutBackoffHours,
    failedPayoutMaxAttempts: bounded(
      row?.failedPayoutMaxAttempts,
      DEFAULT_PROCESS_TIMING.failedPayoutMaxAttempts,
      1,
      10,
    ),
    staleFundingHours: bounded(row?.staleFundingHours, DEFAULT_PROCESS_TIMING.staleFundingHours, 1, 720),
    reviewDeadlineLeadHours: bounded(
      row?.reviewDeadlineLeadHours,
      DEFAULT_PROCESS_TIMING.reviewDeadlineLeadHours,
      1,
      168,
    ),
    teamProposalLifeDays: bounded(row?.teamProposalLifeDays, DEFAULT_PROCESS_TIMING.teamProposalLifeDays, 1, 90),
  };
}

export async function loadProcessTimings(): Promise<ProcessTiming> {
  const row = await prisma.marketplaceSettings.findUnique({ where: { id: "default" } }).catch(() => null);
  return processTimingFromRow(row);
}

export async function saveProcessTimings(input: ProcessTiming, actor = "admin") {
  const timing = processTimingFromRow({
    ...input,
    failedPayoutBackoffHours: input.failedPayoutBackoffHours.join(","),
  });
  if (timing.failedPayoutBackoffHours.join(",") !== input.failedPayoutBackoffHours.join(",")) {
    throw new Error("Failed payout waits must be 1 to 8 whole hours, each from 1 to 720, separated by commas.");
  }
  const mismatches = (Object.keys(DEFAULT_PROCESS_TIMING) as (keyof ProcessTiming)[]).filter((key) => {
    if (key === "failedPayoutBackoffHours") return false;
    return timing[key] !== input[key];
  });
  if (mismatches.length > 0) {
    throw new Error("A process clock is outside its allowed range. Nothing was changed.");
  }
  const before = await loadProcessTimings();
  await prisma.marketplaceSettings.upsert({
    where: { id: "default" },
    update: {
      reviewWindowHours: timing.reviewWindowHours,
      quoteValidHours: timing.quoteValidHours,
      unknownCommandMinutes: timing.unknownCommandMinutes,
      providerCommandMaxAttempts: timing.providerCommandMaxAttempts,
      disputeSlaHours: timing.disputeSlaHours,
      providerHoldWarnHours: timing.providerHoldWarnHours,
      failedPayoutBackoffHours: timing.failedPayoutBackoffHours.join(","),
      failedPayoutMaxAttempts: timing.failedPayoutMaxAttempts,
      staleFundingHours: timing.staleFundingHours,
      reviewDeadlineLeadHours: timing.reviewDeadlineLeadHours,
      teamProposalLifeDays: timing.teamProposalLifeDays,
    },
    create: {
      id: "default",
      reviewWindowHours: timing.reviewWindowHours,
      quoteValidHours: timing.quoteValidHours,
      unknownCommandMinutes: timing.unknownCommandMinutes,
      providerCommandMaxAttempts: timing.providerCommandMaxAttempts,
      disputeSlaHours: timing.disputeSlaHours,
      providerHoldWarnHours: timing.providerHoldWarnHours,
      failedPayoutBackoffHours: timing.failedPayoutBackoffHours.join(","),
      failedPayoutMaxAttempts: timing.failedPayoutMaxAttempts,
      staleFundingHours: timing.staleFundingHours,
      reviewDeadlineLeadHours: timing.reviewDeadlineLeadHours,
      teamProposalLifeDays: timing.teamProposalLifeDays,
    },
  });
  await prisma.auditLog.create({
    data: {
      actor: actor.slice(0, 120),
      action: "process_timing.saved",
      objectType: "MarketplaceSettings",
      objectId: "default",
      before,
      after: timing,
    },
  });
  return timing;
}
