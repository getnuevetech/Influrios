/**
 * Influrios in-app signing helpers (primary signing channel).
 * Parties attest with a typed legal name; the name-to-signature engine draws
 * cursive ink on the PDF and page-endorsement initials on every page.
 */

import { signatureInitials } from "@/lib/signing/signature-engine";

export const NATIVE_SIGNING_CODES = new Set(["influrios", "native", "in_app", "in-app"]);

export function isNativeSigningCode(code: string | null | undefined): boolean {
  return NATIVE_SIGNING_CODES.has((code ?? "").trim().toLowerCase());
}

export function nativeEnvelopeId(documentId: string): string {
  return `native:${documentId}`;
}

export function isNativeEnvelopeId(envelopeId: string | null | undefined): boolean {
  return (envelopeId ?? "").trim().toLowerCase().startsWith("native:");
}

export function formatNativeAttestation(input: {
  role: string;
  typedName: string;
  email: string;
  signedAt: Date;
}): string {
  const name = input.typedName.trim().slice(0, 160);
  const initials = signatureInitials(name);
  const roleLabel = input.role === "creator" ? "influencer" : input.role;
  const when = input.signedAt.toISOString();
  // Human-readable only — PDF ink/endorsements come from party.attestation via render options.
  return [
    `Signed in Influrios - ${roleLabel}: ${name} <${input.email}> at ${when}`,
    `Page endorsement initials: ${initials || "—"}`,
  ].join("\n");
}

/**
 * Replace /sigN/ (1-based) with the attestation, keep [[SIG_INK:N]] for PDF ink,
 * and flip "Pending Signature" on that party's signature row when present.
 */
export function applyNativeSignatureAnchor(body: string, partyIndex: number, attestation: string): string {
  const anchor = `/sig${partyIndex}/`;
  let next = body.includes(anchor) ? body.split(anchor).join(attestation) : `${body.trimEnd()}\n\n${attestation}`;
  // Status sits on the line immediately before [[SIG_INK:N]] — do not scan past other parties.
  next = next.replace(
    new RegExp(`Pending Signature(\\s*\\r?\\n\\s*\\[\\[SIG_INK:${partyIndex}\\]\\])`, "i"),
    `Signed$1`,
  );
  return next;
}

export function nativeSigningReady(): true {
  return true;
}
