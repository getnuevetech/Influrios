import { randomBytes } from "crypto";
import { promises as fs } from "fs";
import path from "path";
import { prisma } from "@/lib/db";

const DIR = path.join(process.cwd(), "data", "deliverables");
export const DELIVERABLE_FILE_LIMIT = 4;
export const DELIVERABLE_FILE_BYTES = 8 * 1024 * 1024;

export type DeliverableFileKind = "document" | "media" | "file";

type FileRule = { ext: string; kind: DeliverableFileKind; type: string };

const BY_TYPE: Record<string, FileRule> = {
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

const BY_EXT: Record<string, FileRule> = Object.fromEntries(Object.values(BY_TYPE).map((rule) => [rule.ext, rule]));

export function deliverableFileRule(type: string, fileName: string): FileRule | null {
  const normalized = type.trim().toLowerCase();
  if (BY_TYPE[normalized]) return BY_TYPE[normalized];
  const ext = path.extname(fileName).replace(".", "").toLowerCase();
  if ((normalized === "" || normalized === "application/octet-stream") && BY_EXT[ext]) return BY_EXT[ext];
  return null;
}

export function filesFromForm(formData: FormData) {
  return formData
    .getAll("files")
    .filter((item): item is File => typeof item === "object" && item !== null && "arrayBuffer" in item && "size" in item && (item as File).size > 0);
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

function safeName(name: string) {
  const base = path.basename(name).replace(/[^\w.\- ]+/g, "").trim();
  return (base || "file").slice(0, 160);
}

export async function saveDeliverableFiles(input: {
  fundingId: string;
  milestoneId: string;
  submissionId?: string | null;
  audience: "creator" | "business";
  files: File[];
}) {
  const checked = validateDeliverableFiles(input.files);
  if (!checked.ok) return checked;
  if (checked.files.length === 0) return { ok: true as const, ids: [] as string[] };
  const milestone = await prisma.fundingMilestone.findFirst({
    where: { id: input.milestoneId, fundingId: input.fundingId },
    select: { id: true },
  });
  if (!milestone) return { ok: false as const, error: "Milestone not found." };
  const dir = path.join(DIR, input.fundingId);
  const written: string[] = [];
  const created: string[] = [];
  try {
    await fs.mkdir(dir, { recursive: true });
    for (const file of checked.files) {
      const rule = deliverableFileRule(file.type || "", file.name || "");
      if (!rule) return { ok: false as const, error: "Upload a document, a media file, or a zip. That file type was not saved." };
      const stored = `${Date.now()}-${randomBytes(4).toString("hex")}.${rule.ext}`;
      const full = path.join(dir, stored);
      await fs.writeFile(full, Buffer.from(await file.arrayBuffer()));
      written.push(full);
      const row = await prisma.milestoneFile.create({
        data: {
          fundingId: input.fundingId,
          milestoneId: input.milestoneId,
          submissionId: input.submissionId || null,
          audience: input.audience,
          kind: rule.kind,
          fileName: safeName(file.name || stored),
          contentType: rule.type,
          sizeBytes: file.size,
          storagePath: `${input.fundingId}/${stored}`,
        },
      });
      created.push(row.id);
    }
    return { ok: true as const, ids: created };
  } catch {
    await Promise.all(written.map((full) => fs.unlink(full).catch(() => undefined)));
    if (created.length) await prisma.milestoneFile.deleteMany({ where: { id: { in: created } } }).catch(() => undefined);
    return { ok: false as const, error: "The file could not be stored. Nothing was saved." };
  }
}

export async function readDeliverableFile(storagePath: string) {
  const relative = storagePath.replace(/\\/g, "/");
  if (!relative || relative.includes("..")) throw new Error("That file was not found.");
  const root = path.resolve(DIR);
  const full = path.resolve(DIR, relative);
  if (!full.startsWith(root + path.sep)) throw new Error("That file was not found.");
  const bytes = await fs.readFile(full);
  return { bytes };
}
