import { createHash } from "crypto";
import { readFile } from "fs/promises";
import path from "path";
import { prisma } from "@/lib/db";
import { LEGAL_CATALOG } from "@/lib/legal-catalog";

export function hashLegalBody(body: string) {
  return createHash("sha256").update(body).digest("hex");
}

let ensured: Promise<void> | null = null;

export async function ensureLegalCatalog() {
  if (!ensured) {
    ensured = seedLegalCatalog().catch((error) => {
      ensured = null;
      throw error;
    });
  }
  return ensured;
}

async function seedLegalCatalog() {
  for (const entry of LEGAL_CATALOG) {
    const existing = await prisma.legalDocument.findUnique({
      where: { documentKey_version: { documentKey: entry.key, version: entry.version } },
    });
    if (existing) continue;
    const body = await readFile(path.join(process.cwd(), "content/legal", entry.file), "utf8");
    try {
      await prisma.legalDocument.create({
        data: {
          documentKey: entry.key,
          title: entry.title,
          version: entry.version,
          effectiveDate: new Date(`${entry.effectiveDate}T00:00:00.000Z`),
          jurisdiction: entry.jurisdiction,
          roleScope: entry.roleScope,
          featureTrigger: entry.featureTrigger,
          requiresAcceptance: entry.requiresAcceptance,
          acknowledgementOnly: entry.acknowledgementOnly,
          requiresReacceptance: false,
          publishedStatus: "published",
          bodyText: body,
          documentHash: hashLegalBody(body),
          category: entry.category,
          publishedAt: new Date(),
          createdBy: "legal-pack-v1.1",
        },
      });
    } catch (error) {
      if (!(typeof error === "object" && error && "code" in error && error.code === "P2002")) throw error;
    }
  }
}

type LegalRow = Awaited<ReturnType<typeof prisma.legalDocument.findMany>>[number];

function latestPublished(rows: LegalRow[]) {
  const now = Date.now();
  const map = new Map<string, LegalRow>();
  for (const row of rows) {
    if (row.publishedStatus !== "published" || row.effectiveDate.getTime() > now) continue;
    const prev = map.get(row.documentKey);
    if (!prev || row.effectiveDate > prev.effectiveDate) map.set(row.documentKey, row);
  }
  return map;
}

export async function currentLegalDocuments() {
  await ensureLegalCatalog();
  const rows = await prisma.legalDocument.findMany();
  return latestPublished(rows);
}

export async function currentLegalDocument(key: string) {
  const docs = await currentLegalDocuments();
  return docs.get(key) ?? null;
}

export async function recordLegalEvent(input: {
  trigger: string;
  context: string;
  userId?: string | null;
  subjectKey?: string | null;
  userRole?: string | null;
  ip?: string | null;
  country?: string | null;
  extraKeys?: string[];
}) {
  const current = await currentLegalDocuments();
  const wanted = new Map<string, LegalRow>();
  for (const doc of current.values()) {
    if (doc.featureTrigger !== input.trigger) continue;
    if (doc.requiresAcceptance || doc.acknowledgementOnly) wanted.set(doc.documentKey, doc);
  }
  for (const key of input.extraKeys ?? []) {
    const doc = current.get(key);
    if (doc) wanted.set(key, doc);
  }
  for (const doc of wanted.values()) {
    await prisma.legalAcceptance.create({
      data: {
        userId: input.userId || null,
        subjectKey: input.subjectKey || null,
        documentId: doc.id,
        documentKey: doc.documentKey,
        documentVersion: doc.version,
        documentHash: doc.documentHash,
        acceptanceType: doc.requiresAcceptance && !doc.acknowledgementOnly ? "acceptance" : "acknowledgement",
        acceptanceContext: input.context,
        userRole: input.userRole || null,
        ip: input.ip || null,
        country: input.country || null,
      },
    });
  }
  return [...wanted.keys()];
}

export async function hasCurrentLegalRecord(input: {
  documentKey: string;
  userId?: string | null;
  subjectKey?: string | null;
}) {
  const doc = await currentLegalDocument(input.documentKey);
  if (!doc || (!doc.requiresAcceptance && !doc.acknowledgementOnly)) return true;
  if (!input.userId && !input.subjectKey) return false;
  const row = await prisma.legalAcceptance.findFirst({
    where: {
      documentKey: doc.documentKey,
      documentHash: doc.documentHash,
      OR: [
        ...(input.userId ? [{ userId: input.userId }] : []),
        ...(input.subjectKey ? [{ subjectKey: input.subjectKey }] : []),
      ],
    },
  });
  return Boolean(row);
}

/** Re-acceptance gates the feature trigger only. Missing catalog rows do not block the site. */
export async function legalFeatureBlock(input: {
  trigger: string;
  userId?: string | null;
  subjectKey?: string | null;
}) {
  if (!input.userId && !input.subjectKey) return null;
  const current = await currentLegalDocuments();
  for (const doc of current.values()) {
    if (doc.featureTrigger !== input.trigger || !doc.requiresReacceptance) continue;
    const row = await prisma.legalAcceptance.findFirst({
      where: {
        documentKey: doc.documentKey,
        documentHash: doc.documentHash,
        OR: [
          ...(input.userId ? [{ userId: input.userId }] : []),
          ...(input.subjectKey ? [{ subjectKey: input.subjectKey }] : []),
        ],
      },
    });
    if (!row) return `Accept the updated ${doc.title} before using this feature.`;
  }
  return null;
}
