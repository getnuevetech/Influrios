/**
 * Every collaboration is funded in full up front, once. Milestones then release that budget to the
 * influencer, each with its own platform fee. Staged (instalment) and recurring funding were removed.
 */
export type ScheduleKind = "once";

export function planSchedule(input: { kind?: string | null; grossCents: number }):
  | { ok: true; kind: ScheduleKind; parts: number[]; trancheCount: 1; intervalDays: 0 }
  | { ok: false; error: string } {
  const kind = String(input.kind ?? "").trim().toLowerCase();
  if (kind && kind !== "once") {
    return { ok: false, error: "Collaborations are funded in full up front. Staged and recurring funding are not offered." };
  }
  return { ok: true, kind: "once", parts: [input.grossCents], trancheCount: 1, intervalDays: 0 };
}
