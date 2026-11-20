import { randomBytes } from "crypto";
import { promises as fs } from "fs";
import path from "path";
import { prisma } from "@/lib/db";
import { deliverableFileRule, validateDeliverableFiles } from "@/lib/deliverable-file-rules";

export {
  DELIVERABLE_ACCEPT,
  DELIVERABLE_FILE_BYTES,
  DELIVERABLE_FILE_LIMIT,
  classifyDeliverableFile,
  deliverableFileRule,
  formatDeliverableBytes,
  validateDeliverableFiles,
  type DeliverableFileIssue,
  type DeliverableFileKind,
  type DeliverableFileRule,
} from "@/lib/deliverable-file-rules";

const DIR = path.join(process.cwd(), "data", "deliverables");

export function filesFromForm(formData: FormData) {
  return formData
    .getAll("files")
    .filter((item): item is File => typeof item === "object" && item !== null && "arrayBuffer" in item && "size" in item && (item as File).size > 0);
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
