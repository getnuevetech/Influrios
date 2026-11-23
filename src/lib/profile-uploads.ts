import { randomBytes } from "crypto";
import { promises as fs } from "fs";
import path from "path";

const AVATAR_DIR = path.join(process.cwd(), "public", "uploads", "avatars");
const COVER_DIR = path.join(process.cwd(), "public", "uploads", "covers");
const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

const EXTENSION: Record<string, string> = { "image/png": "png", "image/webp": "webp", "image/gif": "gif", "image/jpeg": "jpg" };

/** The image type from the file's first bytes. The browser's declared type is not trusted. */
export function sniffImageType(bytes: Uint8Array): string | null {
  const at = (i: number) => bytes[i];
  if (bytes.length >= 3 && at(0) === 0xff && at(1) === 0xd8 && at(2) === 0xff) return "image/jpeg";
  if (bytes.length >= 8 && [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((b, i) => at(i) === b)) return "image/png";
  const ascii = (from: number, to: number) => String.fromCharCode(...bytes.slice(from, to));
  if (bytes.length >= 6 && (ascii(0, 6) === "GIF87a" || ascii(0, 6) === "GIF89a")) return "image/gif";
  if (bytes.length >= 12 && ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP") return "image/webp";
  return null;
}

/** Delete a file this module saved earlier. Anything outside the upload folders is ignored. */
export async function removeProfileUpload(publicUrl: string | null | undefined) {
  const url = (publicUrl ?? "").trim();
  const match = /^\/uploads\/(avatars|covers)\/([A-Za-z0-9-]+\.(?:png|jpg|webp|gif))$/.exec(url);
  if (!match) return;
  const dir = match[1] === "avatars" ? AVATAR_DIR : COVER_DIR;
  await fs.unlink(path.join(dir, match[2])).catch(() => undefined);
}

async function saveUpload(dir: string, publicPrefix: string, file: File) {
  if (!file || typeof file.arrayBuffer !== "function" || file.size <= 0) {
    throw new Error("Choose an image to upload.");
  }
  if (file.size > MAX_BYTES) throw new Error("Images must be 5MB or smaller.");
  const bytes = Buffer.from(await file.arrayBuffer());
  const type = sniffImageType(bytes);
  if (!type || !ALLOWED.has(type)) throw new Error("Use a JPG, PNG, WEBP, or GIF image.");
  await fs.mkdir(dir, { recursive: true });
  const unique = `${Date.now()}-${randomBytes(4).toString("hex")}.${EXTENSION[type]}`;
  await fs.writeFile(path.join(dir, unique), bytes);
  return `${publicPrefix}/${unique}`;
}

export async function saveAvatarUpload(file: File) {
  return saveUpload(AVATAR_DIR, "/uploads/avatars", file);
}

export async function saveCoverUpload(file: File) {
  return saveUpload(COVER_DIR, "/uploads/covers", file);
}
