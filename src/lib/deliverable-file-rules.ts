/** Browser-safe deliverable file rules (no Node FS/crypto/Prisma). */

export const DELIVERABLE_FILE_LIMIT = 4;
export const DELIVERABLE_FILE_BYTES = 8 * 1024 * 1024;

export type DeliverableFileKind = "document" | "media" | "file";

export type DeliverableFileRule = { ext: string; kind: DeliverableFileKind; type: string };

const BY_TYPE: Record<string, DeliverableFileRule> = {
  "application/pdf": { ext: "pdf", kind: "document", type: "application/pdf" },
  "application/msword": { ext: "doc", kind: "document", type: "application/msword" },
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": {
    ext: "docx",
    kind: "document",
    type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  },
  "application/vnd.ms-powerpoint": { ext: "ppt", kind: "document", type: "application/vnd.ms-powerpoint" },
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": {
    ext: "pptx",
    kind: "document",
    type: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  },
  "application/vnd.ms-excel": { ext: "xls", kind: "document", type: "application/vnd.ms-excel" },
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": {
    ext: "xlsx",
    kind: "document",
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  },
  "text/plain": { ext: "txt", kind: "document", type: "text/plain" },
  "text/csv": { ext: "csv", kind: "document", type: "text/csv" },
  "image/jpeg": { ext: "jpg", kind: "media", type: "image/jpeg" },
  "image/png": { ext: "png", kind: "media", type: "image/png" },
  "image/webp": { ext: "webp", kind: "media", type: "image/webp" },
  "image/gif": { ext: "gif", kind: "media", type: "image/gif" },
  "video/mp4": { ext: "mp4", kind: "media", type: "video/mp4" },
  "video/webm": { ext: "webm", kind: "media", type: "video/webm" },
  "video/quicktime": { ext: "mov", kind: "media", type: "video/quicktime" },
  "audio/mpeg": { ext: "mp3", kind: "media", type: "audio/mpeg" },
  "audio/wav": { ext: "wav", kind: "media", type: "audio/wav" },
  "audio/mp4": { ext: "m4a", kind: "media", type: "audio/mp4" },
  "application/zip": { ext: "zip", kind: "file", type: "application/zip" },
};

const BY_EXT: Record<string, DeliverableFileRule> = Object.fromEntries(
  Object.values(BY_TYPE).map((rule) => [rule.ext, rule]),
);

/** Browser / OS MIME aliases that still map to an allow-listed rule. */
const TYPE_ALIASES: Record<string, string> = {
  "image/jpg": "image/jpeg",
  "image/pjpeg": "image/jpeg",
  "audio/x-wav": "audio/wav",
  "audio/wave": "audio/wav",
  "audio/x-m4a": "audio/mp4",
  "video/x-quicktime": "video/quicktime",
  "application/x-zip-compressed": "application/zip",
  "application/x-zip": "application/zip",
  "application/x-pdf": "application/pdf",
};

/** Only these non-aliased types may fall back to an allow-listed extension. */
const GENERIC_TYPES = new Set(["", "application/octet-stream"]);

export const DELIVERABLE_ACCEPT =
  ".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt,.csv,.jpg,.jpeg,.png,.webp,.gif,.mp4,.webm,.mov,.mp3,.wav,.m4a,.zip";

function fileExtension(fileName: string) {
  const base = fileName.split(/[/\\]/).pop() || fileName;
  const dot = base.lastIndexOf(".");
  if (dot <= 0) return "";
  return base.slice(dot + 1).toLowerCase();
}

export function deliverableFileRule(type: string, fileName: string): DeliverableFileRule | null {
  const normalized = type.trim().toLowerCase();
  const aliased = TYPE_ALIASES[normalized];
  if (aliased && BY_TYPE[aliased]) return BY_TYPE[aliased];
  if (BY_TYPE[normalized]) return BY_TYPE[normalized];
  const ext = fileExtension(fileName);
  const byExt = BY_EXT[ext];
  if (!byExt) return null;
  // Extension fallback only for empty/generic MIME — never for a specific conflicting type.
  if (GENERIC_TYPES.has(normalized)) return byExt;
  return null;
}

export type DeliverableFileIssue = "unsupported" | "oversize" | "ready";

export function classifyDeliverableFile(file: { name: string; type: string; size: number }): {
  status: DeliverableFileIssue;
  error: string | null;
} {
  if (file.size > DELIVERABLE_FILE_BYTES) {
    return { status: "oversize", error: "File too large (max 8 MB)." };
  }
  if (!deliverableFileRule(file.type || "", file.name || "")) {
    return { status: "unsupported", error: "That file type was not saved. Choose a document, media file, or zip." };
  }
  return { status: "ready", error: null };
}

export function formatDeliverableBytes(size: number) {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

export function validateDeliverableFiles(files: File[]): { ok: true; files: File[] } | { ok: false; error: string } {
  if (files.length > DELIVERABLE_FILE_LIMIT) {
    return { ok: false, error: `Add up to ${DELIVERABLE_FILE_LIMIT} files.` };
  }
  for (const file of files) {
    if (file.size > DELIVERABLE_FILE_BYTES) {
      return { ok: false, error: "Each file must be 8 MB or smaller." };
    }
    if (!deliverableFileRule(file.type || "", file.name || "")) {
      return { ok: false, error: "Upload a document, a media file, or a zip. That file type was not saved." };
    }
  }
  return { ok: true, files };
}
