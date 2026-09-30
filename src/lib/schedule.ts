export type ScheduleKind = "once" | "staged" | "recurring";

/** Last tranche absorbs rounding so the parts still add up to the gross. */
export function splitTranches(totalCents: number, count: number): number[] | null {
  if (!Number.isInteger(totalCents) || !Number.isInteger(count) || count < 2 || totalCents < count) return null;
  const base = Math.floor(totalCents / count);
  const parts: number[] = [];
  let used = 0;
  for (let index = 0; index < count; index += 1) {
    if (index === count - 1) {
      parts.push(totalCents - used);
      continue;
    }
    parts.push(base);
    used += base;
  }
  if (parts.some((part) => part <= 0)) return null;
  return parts;
}

export function planSchedule(input: {
  kind: string;
  grossCents: number;
  stageCount?: number;
  occurrenceCount?: number;
  stagedEnabled: boolean;
  recurringEnabled: boolean;
  maxStages: number;
  maxRecurrences: number;
  intervalDays: number;
}):
  | { ok: true; kind: ScheduleKind; parts: number[]; trancheCount: number; intervalDays: number }
  | { ok: false; error: string } {
  if (input.kind === "once" || input.kind === "") {
    return { ok: true, kind: "once", parts: [input.grossCents], trancheCount: 1, intervalDays: 0 };
  }
  if (input.kind === "staged") {
    if (!input.stagedEnabled) return { ok: false, error: "Staged funding is turned off." };
    const count = Math.round(input.stageCount ?? 0);
    if (count < 2 || count > input.maxStages) {
      return { ok: false, error: `Use between 2 and ${input.maxStages} stages.` };
    }
    const parts = splitTranches(input.grossCents, count);
    if (!parts) return { ok: false, error: "Each stage needs at least one cent." };
    return { ok: true, kind: "staged", parts, trancheCount: count, intervalDays: 0 };
  }
  if (input.kind === "recurring") {
    if (!input.recurringEnabled) return { ok: false, error: "Recurring funding is turned off." };
    const count = Math.round(input.occurrenceCount ?? 0);
    if (count < 2 || count > input.maxRecurrences) {
      return { ok: false, error: `Use between 2 and ${input.maxRecurrences} occurrences.` };
    }
    if (!Number.isInteger(input.intervalDays) || input.intervalDays < 1) {
      return { ok: false, error: "Set a recurring interval of at least one day." };
    }
    return { ok: true, kind: "recurring", parts: [input.grossCents], trancheCount: count, intervalDays: input.intervalDays };
  }
  return { ok: false, error: "Choose a funding schedule." };
}

export function recurrenceIsDue(input: { holdAt: Date | null; intervalDays: number; now: Date }) {
  if (!input.holdAt || input.intervalDays < 1) return false;
  return input.holdAt.getTime() + input.intervalDays * 24 * 60 * 60 * 1000 <= input.now.getTime();
}

export function scheduleLabel(input: {
  scheduleKind: string;
  trancheIndex: number;
  trancheCount: number;
  intervalDays: number;
}) {
  if (input.scheduleKind === "staged") return `Stage ${input.trancheIndex} of ${input.trancheCount}`;
  if (input.scheduleKind === "recurring") {
    const every = input.intervalDays === 1 ? "every day" : `every ${input.intervalDays} days`;
    return `Recurring ${input.trancheIndex} of ${input.trancheCount} · ${every}`;
  }
  return "";
}
