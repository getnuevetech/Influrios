/**
 * A reviewer acts on one submitted version. Earlier versions stay on the record.
 * Approving work does not confirm a payout.
 */

export type ReviewVersion = { version: number; status: string };

export function currentSubmittedVersion(versions: ReviewVersion[]) {
  const submitted = versions.filter((row) => row.status === "submitted");
  if (submitted.length === 0) return null;
  return submitted.reduce((latest, row) => (row.version > latest.version ? row : latest));
}

export function reviewVersionDecision(input: {
  versions: ReviewVersion[];
  requestedVersion: number;
  intent: "approve" | "revise";
  note?: string;
}): { ok: true; version: number } | { ok: false; error: string } {
  const current = currentSubmittedVersion(input.versions);
  if (!current) return { ok: false, error: "There is no submitted version to review. Nothing was paid." };
  if (!Number.isInteger(input.requestedVersion) || input.requestedVersion !== current.version) {
    return { ok: false, error: "This version is no longer current. Refresh and review the latest version. Nothing was paid." };
  }
  if (input.intent === "revise" && (input.note ?? "").trim().length < 8) {
    return { ok: false, error: "Say what should change. Nothing was paid." };
  }
  return { ok: true, version: current.version };
}

export function reviewActorAllowed(audience: "business" | "creator", intent: "submit" | "approve" | "revise") {
  if (intent === "submit") return audience === "creator";
  return audience === "business";
}
