/**
 * Pure signature-token helpers safe for client and server bundles.
 * Keep this file free of next/headers, Prisma, mail, and other server-only imports.
 */

const SIG_INK = /\[\[SIG_INK:\d+\]\]/gi;
const SIG_ANCHOR = /\/sig\d+\//gi;
const SIG_MARK = /\[\[SIG:[^\]]*\]\]/gi;

/** Strip internal signature markers from text shown in the web reader. */
export function stripSignatureTokens(body: string): string {
  return body
    .replace(SIG_INK, "")
    .replace(SIG_ANCHOR, "")
    .replace(SIG_MARK, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
