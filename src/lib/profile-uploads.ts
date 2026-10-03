import { randomBytes } from "crypto";
import { promises as fs } from "fs";
import path from "path";

const AVATAR_DIR = path.join(process.cwd(), "public", "uploads", "avatars");
const COVER_DIR = path.join(process.cwd(), "public", "uploads", "covers");
const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

function extensionFor(type: string, filename: string) {
  if (type === "image/png") return "png";
  if (type === "image/webp") return "webp";
  if (type === "image/gif") return "gif";
  if (type === "image/jpeg") return "jpg";
  const fromName = path.extname(filename).replace(".", "").toLowerCase();
  if (["png", "jpg", "jpeg", "webp", "gif"].includes(fromName)) {
    return fromName === "jpeg" ? "jpg" : fromName;
  }
  return "jpg";
}

async function saveUpload(dir: string, publicPrefix: string, file: File) {
  if (!file || typeof file.arrayBuffer !== "function" || file.size <= 0) {
    throw new Error("Choose an image to upload.");
  }
  if (file.size > MAX_BYTES) throw new Error("Images must be 5MB or smaller.");
  const type = file.type || "application/octet-stream";
  if (!ALLOWED.has(type)) throw new Error("Use a JPG, PNG, WEBP, or GIF image.");
  await fs.mkdir(dir, { recursive: true });
  const bytes = Buffer.from(await file.arrayBuffer());
  const unique = `${Date.now()}-${randomBytes(4).toString("hex")}.${extensionFor(type, file.name || "upload")}`;
  await fs.writeFile(path.join(dir, unique), bytes);
  return `${publicPrefix}/${unique}`;
}

export async function saveAvatarUpload(file: File) {
  return saveUpload(AVATAR_DIR, "/uploads/avatars", file);
}

export async function saveCoverUpload(file: File) {
  return saveUpload(COVER_DIR, "/uploads/covers", file);
}
