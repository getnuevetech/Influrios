import path from "path";

/** Files dropped here are served at /myfiles/<filename>. */
export function myfilesDirectory() {
  return path.join(process.cwd(), "src", "app", "myfiles");
}

const TYPES: Record<string, string> = {
  ".pdf": "application/pdf",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8",
  ".csv": "text/csv; charset=utf-8",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".mp3": "audio/mpeg",
};

/** A single file name in src/app/myfiles. Rejects folders and path tricks. */
export function resolveMyFile(name: string): string | null {
  let decoded = name;
  try {
    decoded = decodeURIComponent(name);
  } catch {
    return null;
  }
  const base = path.basename(decoded);
  if (!base || base !== decoded || base.startsWith(".")) return null;
  if (!/^[\w.-]+$/.test(base)) return null;
  const dir = myfilesDirectory();
  const full = path.join(dir, base);
  if (path.dirname(full) !== dir) return null;
  return full;
}

/** TikTok domain checks request this file at the site root, not under /myfiles. */
export function isTikTokRootFile(name: string) {
  return /^tiktok[A-Za-z0-9-]+\.txt$/.test(name);
}

export function myFileContentType(filename: string) {
  return TYPES[path.extname(filename).toLowerCase()] || "application/octet-stream";
}
