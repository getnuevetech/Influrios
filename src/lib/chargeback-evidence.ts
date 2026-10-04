/**
 * W3.6 — Durable chargeback / payment-risk evidence pack.
 * Stored on CollaborationFunding.chargebackEvidenceJson; never moves money.
 */

export type ChargebackEvidencePack = {
  providerCaseId: string | null;
  providerReference: string | null;
  amountCents: number | null;
  currency: string;
  reasonCode: string | null;
  receivedAt: string | null;
  notes: string | null;
  attachmentUrls: string[];
  recordedAt: string;
  recordedBy: string;
};

export function parseChargebackEvidence(value: unknown): ChargebackEvidencePack | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  const attachmentUrls = Array.isArray(row.attachmentUrls)
    ? row.attachmentUrls.filter((u): u is string => typeof u === "string" && u.length > 0).slice(0, 10)
    : [];
  return {
    providerCaseId: typeof row.providerCaseId === "string" ? row.providerCaseId.slice(0, 120) : null,
    providerReference:
      typeof row.providerReference === "string" ? row.providerReference.slice(0, 160) : null,
    amountCents:
      typeof row.amountCents === "number" && Number.isInteger(row.amountCents) && row.amountCents >= 0
        ? row.amountCents
        : null,
    currency: typeof row.currency === "string" && row.currency.trim() ? row.currency.trim().toUpperCase().slice(0, 8) : "USD",
    reasonCode: typeof row.reasonCode === "string" ? row.reasonCode.slice(0, 80) : null,
    receivedAt: typeof row.receivedAt === "string" ? row.receivedAt : null,
    notes: typeof row.notes === "string" ? row.notes.slice(0, 1000) : null,
    attachmentUrls,
    recordedAt: typeof row.recordedAt === "string" ? row.recordedAt : new Date().toISOString(),
    recordedBy: typeof row.recordedBy === "string" ? row.recordedBy.slice(0, 120) : "system",
  };
}

export function buildChargebackEvidencePack(input: {
  providerCaseId?: string | null;
  providerReference?: string | null;
  amountCents?: number | null;
  currency?: string | null;
  reasonCode?: string | null;
  receivedAt?: string | null;
  notes?: string | null;
  attachmentUrls?: string[] | null;
  recordedBy: string;
}): ChargebackEvidencePack {
  return parseChargebackEvidence({
    providerCaseId: input.providerCaseId?.trim() || null,
    providerReference: input.providerReference?.trim() || null,
    amountCents: input.amountCents ?? null,
    currency: input.currency || "USD",
    reasonCode: input.reasonCode?.trim() || null,
    receivedAt: input.receivedAt?.trim() || null,
    notes: input.notes?.trim() || null,
    attachmentUrls: input.attachmentUrls ?? [],
    recordedAt: new Date().toISOString(),
    recordedBy: input.recordedBy,
  })!;
}

export function chargebackEvidenceSummary(pack: ChargebackEvidencePack | null): string {
  if (!pack) return "No evidence pack recorded.";
  const parts = [
    pack.providerCaseId ? `case ${pack.providerCaseId}` : null,
    pack.providerReference ? `ref ${pack.providerReference}` : null,
    pack.amountCents != null ? `${pack.amountCents}¢ ${pack.currency}` : null,
    pack.reasonCode ? `code ${pack.reasonCode}` : null,
    pack.attachmentUrls.length ? `${pack.attachmentUrls.length} attachment(s)` : null,
  ].filter(Boolean);
  return parts.length ? parts.join(" · ") : "Evidence pack recorded (empty fields).";
}
