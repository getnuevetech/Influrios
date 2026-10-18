/**
 * Influrios in-app signing helpers (primary signing channel).
 * Parties attest with a typed legal name; the agreement completes when every party has signed.
 */

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
  return `Signed in Influrios — ${input.role}: ${name} <${input.email}> at ${input.signedAt.toISOString()}`;
}

/** Replace /sigN/ (1-based) with the attestation, or append when the anchor is missing. */
export function applyNativeSignatureAnchor(body: string, partyIndex: number, attestation: string): string {
  const anchor = `/sig${partyIndex}/`;
  if (body.includes(anchor)) return body.split(anchor).join(attestation);
  return `${body.trimEnd()}\n\n${attestation}`;
}

export function nativeSigningReady(): true {
  return true;
}
