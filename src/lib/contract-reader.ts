/**
 * Presentation helpers for the Contracts reader and popup.
 * Signature status and funding status stay separate. Raw signature tokens stay out of the UI.
 */
import { contractDocumentTypeLabel } from "@/lib/contract-catalog";
import { formatContractDisplayDate } from "@/lib/contract-document";
export { stripSignatureTokens } from "@/lib/contract-signature-text";

/** Prefer a stored agreement reference; otherwise a stable short id for display only. */
export function displayAgreementReference(input: {
  id: string;
  agreementRef?: string | null;
}): string {
  const stored = input.agreementRef?.trim();
  if (stored) return stored;
  const compact = input.id.replace(/[^a-zA-Z0-9]/g, "").slice(-8).toUpperCase();
  return compact ? `IC-${compact}` : `IC-${input.id.slice(0, 8).toUpperCase()}`;
}

export function displayAgreementVersion(versionLabel?: string | null) {
  const value = versionLabel?.trim();
  return value || "v1.0";
}

export function readableSignedAt(value: Date | string | null | undefined): string {
  if (!value) return "—";
  return formatContractDisplayDate(value);
}

export type AgreementActivityEvent = {
  id: string;
  at: Date;
  label: string;
  detail?: string;
};

/** Build Activity tab events from the stored agreement without inventing signatures. */
export function agreementActivityEvents(input: {
  createdAt: Date;
  updatedAt: Date;
  status: string;
  parties: { name: string; status: string; signedAt: Date | null }[];
  voidedAt?: Date | null;
  voidReason?: string | null;
}): AgreementActivityEvent[] {
  const events: AgreementActivityEvent[] = [
    {
      id: "created",
      at: input.createdAt,
      label: input.status === "draft" ? "Draft created" : "Agreement issued",
      detail: "Ready for signature",
    },
  ];
  for (const party of input.parties) {
    if (party.status === "signed" && party.signedAt) {
      events.push({
        id: `signed-${party.name}-${party.signedAt.toISOString()}`,
        at: party.signedAt,
        label: "Signed",
        detail: party.name,
      });
    } else if (party.status === "declined") {
      events.push({
        id: `declined-${party.name}`,
        at: input.updatedAt,
        label: "Declined",
        detail: party.name,
      });
    }
  }
  if (input.status === "signed") {
    const lastSign = input.parties
      .map((party) => party.signedAt)
      .filter((value): value is Date => Boolean(value))
      .sort((a, b) => b.getTime() - a.getTime())[0];
    events.push({
      id: "completed",
      at: lastSign ?? input.updatedAt,
      label: "Fully signed",
      detail: "Every required signature is recorded",
    });
  }
  if (input.status === "voided") {
    events.push({
      id: "voided",
      at: input.voidedAt ?? input.updatedAt,
      label: "Voided",
      detail: input.voidReason?.trim() || undefined,
    });
  }
  return events.sort((a, b) => b.at.getTime() - a.at.getTime());
}

export function counterpartyName(input: {
  viewerIsBusiness: boolean;
  parties: { role: string; name: string; userId?: string | null }[];
  accountId: string;
}): string {
  const want = input.viewerIsBusiness ? ["creator", "influencer"] : ["business"];
  const named = input.parties
    .filter((party) => want.includes(party.role))
    .map((party) => party.name.trim())
    .filter(Boolean);
  if (named.length) return named.join(", ");
  return input.parties.find((party) => party.userId !== input.accountId)?.name?.trim() || "—";
}

export function documentTypeForRow(documentType: string | null | undefined, title: string) {
  if (documentType?.trim()) return contractDocumentTypeLabel(documentType);
  const lower = title.toLowerCase();
  if (lower.includes("nda") || lower.includes("non-disclosure")) return "Mutual NDA";
  if (lower.includes("change order") || lower.includes("amendment")) return "Change Order / Amendment";
  if (lower.includes("statement of work") || lower.includes("sow")) return "Statement of Work";
  return "Collaboration Agreement";
}

/** Signing line shown above the signature action. */
export function signingAsLabel(input: {
  signerName: string;
  entityName: string;
}): string {
  const signer = input.signerName.trim() || "the authorized signer";
  const entity = input.entityName.trim();
  if (!entity || entity.toLowerCase() === signer.toLowerCase()) {
    return `You are signing as ${signer}`;
  }
  return `You are signing as ${signer}, on behalf of ${entity}`;
}
