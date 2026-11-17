/**
 * Shared milestone schedule for collaboration agreements.
 * Gross, influencer fee, and net must reconcile to the signed snapshot —
 * never repeat gross values under an "Influencer Amount" label.
 */
import { allocateByLargestRemainder } from "@/lib/largest-remainder";
import { formatMoney } from "@/lib/money";

export type MilestoneScheduleInput = {
  title: string;
  shareBps: number;
};

export type MilestoneScheduleRow = {
  title: string;
  shareBps: number;
  shareLabel: string;
  grossCents: number;
  feeCents: number;
  netCents: number;
  grossLabel: string;
  feeLabel: string;
  netLabel: string;
};

export type MilestoneSchedule = {
  currency: string;
  rows: MilestoneScheduleRow[];
  totals: {
    shareBps: number;
    grossCents: number;
    feeCents: number;
    netCents: number;
    shareLabel: string;
    grossLabel: string;
    feeLabel: string;
    netLabel: string;
  };
};

/** Split gross and fee by milestone share using largest-remainder so cents reconcile. */
export function buildMilestoneSchedule(input: {
  currency: string;
  grossCents: number;
  influencerFeeCents: number;
  milestones: MilestoneScheduleInput[];
}): MilestoneSchedule {
  const currency = input.currency.trim().toUpperCase() || "USD";
  const milestones = input.milestones.filter((row) => row.shareBps > 0);
  const weights = milestones.map((row) => row.shareBps);
  const grossParts =
    weights.length === 0 ? ([] as number[]) : allocateByLargestRemainder(Math.max(0, input.grossCents), weights) ?? [];
  const feeParts =
    weights.length === 0
      ? ([] as number[])
      : allocateByLargestRemainder(Math.max(0, input.influencerFeeCents), weights) ?? [];
  const rows: MilestoneScheduleRow[] = milestones.map((row, index) => {
    const grossCents = grossParts[index] ?? 0;
    const feeCents = feeParts[index] ?? 0;
    const netCents = Math.max(0, grossCents - feeCents);
    return {
      title: row.title.trim() || `Milestone ${index + 1}`,
      shareBps: row.shareBps,
      shareLabel: `${(row.shareBps / 100).toFixed(0)}%`,
      grossCents,
      feeCents,
      netCents,
      grossLabel: formatMoney(grossCents, currency),
      feeLabel: formatMoney(feeCents, currency),
      netLabel: formatMoney(netCents, currency),
    };
  });
  const grossCents = rows.reduce((sum, row) => sum + row.grossCents, 0);
  const feeCents = rows.reduce((sum, row) => sum + row.feeCents, 0);
  const netCents = rows.reduce((sum, row) => sum + row.netCents, 0);
  const shareBps = rows.reduce((sum, row) => sum + row.shareBps, 0);
  return {
    currency,
    rows,
    totals: {
      shareBps,
      grossCents,
      feeCents,
      netCents,
      shareLabel: `${(shareBps / 100).toFixed(0)}%`,
      grossLabel: formatMoney(grossCents, currency),
      feeLabel: formatMoney(feeCents, currency),
      netLabel: formatMoney(netCents, currency),
    },
  };
}

/** Tabular block for the stored agreement / PDF (shared by both parties). */
export function formatMilestoneScheduleBlock(schedule: MilestoneSchedule): string {
  if (schedule.rows.length === 0) {
    return [
      "Milestone  Share  Gross compensation  Influencer fee  Net compensation",
      "(None scheduled.)",
    ].join("\n");
  }
  return [
    "Milestone  Share  Gross compensation  Influencer fee  Net compensation",
    ...schedule.rows.map(
      (row, index) =>
        `${index + 1}. ${row.title}  ${row.shareLabel}  ${row.grossLabel}  ${row.feeLabel}  ${row.netLabel}`,
    ),
    `Total  ${schedule.totals.shareLabel}  ${schedule.totals.grossLabel}  ${schedule.totals.feeLabel}  ${schedule.totals.netLabel}`,
  ].join("\n");
}

/** Map wizard milestones into schedule rows used by sendCollaborationContract. */
export function milestoneRenderRows(schedule: MilestoneSchedule): {
  title: string;
  shareLabel: string;
  grossLabel: string;
  feeLabel: string;
  creatorShares: string;
  netLabel: string;
}[] {
  return schedule.rows.map((row) => ({
    title: row.title,
    shareLabel: row.shareLabel,
    grossLabel: row.grossLabel,
    feeLabel: row.feeLabel,
    creatorShares: row.netLabel,
    netLabel: row.netLabel,
  }));
}
