/** Browser-safe deliverable link normalize / preview (no Prisma/ledger). */

const UNSAFE_SCHEMES = /^(javascript|data|file|ftp|vbscript|blob):/i;
const HTTP_SCHEME = /^http:\/\//i;
const HTTPS_SCHEME = /^https:\/\//i;

/** Trim, reject unsafe/http schemes, and prefix bare domains with https://. */
export function normalizeDeliverableLink(raw: string):
  | { ok: true; url: string; changed: boolean }
  | { ok: false; error: string } {
  const trimmed = raw.trim();
  if (!trimmed) return { ok: true, url: "", changed: false };
  if (UNSAFE_SCHEMES.test(trimmed)) {
    return { ok: false, error: "That link isn’t allowed. Use a normal https web address." };
  }
  if (HTTP_SCHEME.test(trimmed)) {
    return { ok: false, error: "Only secure https links can be submitted." };
  }
  const candidate = HTTPS_SCHEME.test(trimmed) ? trimmed : `https://${trimmed.replace(/^\/+/, "")}`;
  let parsed: URL;
  try {
    parsed = new URL(candidate);
  } catch {
    return { ok: false, error: "That link isn’t allowed. Use a normal https web address." };
  }
  if (parsed.protocol !== "https:") {
    return { ok: false, error: "Only secure https links can be submitted." };
  }
  if (!parsed.hostname || !parsed.hostname.includes(".")) {
    return { ok: false, error: "That link isn’t allowed. Use a normal https web address." };
  }
  if (/\s/.test(candidate)) {
    return { ok: false, error: "That link isn’t allowed. Use a normal https web address." };
  }
  const normalized = `${parsed.protocol}//${parsed.host}${parsed.pathname === "/" ? "" : parsed.pathname}${parsed.search}${parsed.hash}`;
  return { ok: true, url: normalized, changed: normalized !== trimmed };
}

/** Preview copy before persist — empty when the field is blank or already https. */
export function deliverableLinkPreview(raw: string): { kind: "will-save"; text: string } | { kind: "error"; text: string } | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const result = normalizeDeliverableLink(trimmed);
  if (!result.ok) return { kind: "error", text: result.error };
  if (!result.changed && /^https:\/\//i.test(trimmed)) return null;
  return { kind: "will-save", text: `Will save as ${result.url}` };
}

export function submissionIsComplete(input: { note: string; linkUrl: string; fileCount?: number }) {
  const note = input.note.trim();
  const fileCount = input.fileCount ?? 0;
  const normalized = normalizeDeliverableLink(input.linkUrl);
  if (!normalized.ok) return { ok: false as const, error: normalized.error };
  const linkUrl = normalized.url;
  if (fileCount < 0 || !Number.isInteger(fileCount)) {
    return { ok: false as const, error: "Add a note, an https link, or a file so the business can review this version." };
  }
  if (note.length < 8 && !linkUrl && fileCount === 0) {
    return { ok: false as const, error: "Add a note, an https link, or a file so the business can review this version." };
  }
  return { ok: true as const, note, linkUrl };
}
