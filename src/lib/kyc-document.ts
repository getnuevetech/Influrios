import { randomBytes } from "crypto";
import { promises as fs } from "fs";
import path from "path";
import { gatewayIdentitySessionAllowed } from "@/lib/corridor-checkout";
import { prisma } from "@/lib/db";
import { openStripeIdentitySession } from "@/lib/stripe-admin";

const KYC_DIR = path.join(process.cwd(), "data", "kyc");
const MAX_BYTES = 8 * 1024 * 1024;
const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp", "application/pdf"]);

export type KycRequirementKind = "detail" | "document";

export type KycRequirementView = {
  id: string;
  kind: KycRequirementKind;
  label: string;
  required: boolean;
  sortOrder: number;
};

export function kycRequirementKind(value: string | null | undefined): KycRequirementKind | null {
  const kind = (value ?? "").trim();
  return kind === "detail" || kind === "document" ? kind : null;
}

export function kycDetailsRecord(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const details: Record<string, string> = {};
  for (const [key, item] of Object.entries(value)) {
    if (typeof item === "string") details[key] = item;
  }
  return details;
}

/** The first missing required detail or document, if the configured form is incomplete. */
export function missingDocumentKyc(input: {
  requirements: { id: string; kind: KycRequirementKind; label: string; required: boolean }[];
  details: Record<string, string>;
  hasFile: (requirementId: string) => boolean;
}): string | null {
  for (const requirement of input.requirements) {
    if (!requirement.required) continue;
    if (requirement.kind === "detail" && !(input.details[requirement.id] ?? "").trim()) {
      return `Enter ${requirement.label}.`;
    }
    if (requirement.kind === "document" && !input.hasFile(requirement.id)) {
      return `Upload ${requirement.label}.`;
    }
  }
  return null;
}

function extensionFor(type: string) {
  if (type === "image/png") return "png";
  if (type === "image/webp") return "webp";
  if (type === "application/pdf") return "pdf";
  return "jpg";
}

export async function loadKycSettings() {
  return prisma.kycSettings.findUnique({ where: { id: "default" } });
}

export async function saveKycGateway(providerId: string) {
  const id = providerId.trim();
  const provider = await prisma.integrationProvider.findFirst({ where: { id, kind: "payment" } });
  if (!provider) throw new Error("Choose a gateway for KYC.");
  await prisma.kycSettings.upsert({
    where: { id: "default" },
    update: { gatewayProviderId: provider.id },
    create: { id: "default", gatewayProviderId: provider.id },
  });
  return provider;
}

export async function listKycRequirements(): Promise<KycRequirementView[]> {
  const rows = await prisma.kycDocumentRequirement.findMany({ orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] });
  return rows.flatMap((row) => {
    const kind = kycRequirementKind(row.kind);
    if (!kind) return [];
    return [{ id: row.id, kind, label: row.label, required: row.required, sortOrder: row.sortOrder }];
  });
}

export async function addKycRequirement(input: { kind: string; label: string; required: boolean }) {
  const kind = kycRequirementKind(input.kind);
  if (!kind) throw new Error("Choose a detail or a document.");
  const label = input.label.trim().slice(0, 80);
  if (!label) throw new Error("Enter a name for this requirement.");
  const count = await prisma.kycDocumentRequirement.count();
  return prisma.kycDocumentRequirement.create({
    data: { kind, label, required: input.required, sortOrder: count },
  });
}

export async function removeKycRequirement(id: string) {
  const requirementId = id.trim();
  if (!requirementId) throw new Error("Choose a requirement.");
  await prisma.kycDocumentRequirement.delete({ where: { id: requirementId } });
}

function mimeFromName(fileName: string) {
  const ext = path.extname(fileName).toLowerCase();
  if (ext === ".png") return "image/png";
  if (ext === ".webp") return "image/webp";
  if (ext === ".pdf") return "application/pdf";
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  return "";
}

async function saveKycFile(slug: string, requirementId: string, file: File) {
  // Some runtimes hand a Blob-like upload; require a usable File with bytes.
  if (!file || typeof file !== "object" || typeof file.arrayBuffer !== "function" || file.size <= 0) {
    throw new Error("Choose a file to upload.");
  }
  if (file.size > MAX_BYTES) throw new Error("Each document must be 8 MB or smaller.");
  const type = (file.type || mimeFromName(file.name || "")).trim().toLowerCase();
  if (!ALLOWED.has(type)) throw new Error("Upload a JPG, PNG, WEBP, or PDF.");
  const safeSlug = slug.replace(/[^a-z0-9-]/gi, "").slice(0, 80) || "creator";
  const dir = path.join(KYC_DIR, safeSlug);
  try {
    await fs.mkdir(dir, { recursive: true });
    const name = `${requirementId}-${Date.now()}-${randomBytes(4).toString("hex")}.${extensionFor(type)}`;
    await fs.writeFile(path.join(dir, name), Buffer.from(await file.arrayBuffer()));
    return { storagePath: `${safeSlug}/${name}`, fileName: (file.name || name).slice(0, 180) };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not store the document.";
    if (/EACCES|EROFS|ENOSPC|EPERM/i.test(message)) {
      throw new Error("Document storage is not writable on this host. Ask an admin to check /app/data/kyc.");
    }
    throw error instanceof Error ? error : new Error("Could not store the document.");
  }
}

export async function readKycFile(storagePath: string) {
  const relative = storagePath.replace(/\\/g, "/");
  if (!relative || relative.includes("..")) throw new Error("That document was not found.");
  const full = path.resolve(KYC_DIR, relative);
  if (!full.startsWith(path.resolve(KYC_DIR) + path.sep)) throw new Error("That document was not found.");
  const bytes = await fs.readFile(full);
  const ext = path.extname(full).toLowerCase();
  const type =
    ext === ".png" ? "image/png" : ext === ".webp" ? "image/webp" : ext === ".pdf" ? "application/pdf" : "image/jpeg";
  return { bytes, type };
}

export async function submitDocumentKyc(input: {
  slug: string;
  countryCode: string;
  creatorId: string | null;
  details: Record<string, string>;
  files: { requirementId: string; file: File }[];
}) {
  const requirements = await listKycRequirements();
  if (requirements.length === 0) throw new Error("Document KYC has no required details or documents yet.");
  const existing = await prisma.creatorKycSubmission.findUnique({
    where: { creatorSlug: input.slug },
    include: { documents: true },
  });
  const kept = new Set(
    (existing?.kycModel === "government_id" ? existing.documents : []).map((document) => document.requirementId),
  );
  const uploads = input.files.filter((item) => item.file.size > 0);
  const missing = missingDocumentKyc({
    requirements,
    details: input.details,
    hasFile: (requirementId) => uploads.some((item) => item.requirementId === requirementId) || kept.has(requirementId),
  });
  if (missing) throw new Error(missing);

  const saved: { requirementId: string; label: string; storagePath: string; fileName: string }[] = [];
  for (const item of uploads) {
    const requirement = requirements.find((row) => row.id === item.requirementId && row.kind === "document");
    if (!requirement) continue;
    const stored = await saveKycFile(input.slug, requirement.id, item.file);
    saved.push({ requirementId: requirement.id, label: requirement.label, ...stored });
  }

  const details: Record<string, string> = {};
  for (const requirement of requirements) {
    if (requirement.kind !== "detail") continue;
    details[requirement.id] = (input.details[requirement.id] ?? "").trim();
  }

  const submission = await prisma.creatorKycSubmission.upsert({
    where: { creatorSlug: input.slug },
    update: {
      creatorId: input.creatorId,
      countryCode: input.countryCode,
      kycModel: "government_id",
      gatewayProviderId: null,
      gatewaySessionId: "",
      gatewaySessionUrl: "",
      status: "submitted",
      detailsJson: details,
    },
    create: {
      creatorSlug: input.slug,
      creatorId: input.creatorId,
      countryCode: input.countryCode,
      kycModel: "government_id",
      gatewaySessionId: "",
      gatewaySessionUrl: "",
      status: "submitted",
      detailsJson: details,
    },
  });

  if (saved.length > 0) {
    await prisma.creatorKycDocument.deleteMany({
      where: { submissionId: submission.id, requirementId: { in: saved.map((item) => item.requirementId) } },
    });
    await prisma.creatorKycDocument.createMany({
      data: saved.map((item) => ({ submissionId: submission.id, ...item })),
    });
  }

  if (input.creatorId) {
    await prisma.creator.update({
      where: { id: input.creatorId },
      data: { identityVerified: "PENDING" },
    });
  }
  return submission;
}

export async function startGatewayKyc(input: {
  slug: string;
  countryCode: string;
  creatorId: string | null;
  returnUrl: string;
}) {
  const settings = await loadKycSettings();
  const providerId = settings?.gatewayProviderId ?? "";
  const provider = providerId
    ? await prisma.integrationProvider.findFirst({ where: { id: providerId, kind: "payment" } })
    : null;
  if (!provider) throw new Error("A KYC gateway has not been selected.");
  if (!gatewayIdentitySessionAllowed(provider)) {
    throw new Error("That KYC gateway is not enabled. No identity session was opened.");
  }
  if (provider.code !== "stripe") {
    throw new Error(`${provider.name} has no identity session. Nothing was opened.`);
  }
  const opened = await openStripeIdentitySession({
    slug: input.slug,
    countryCode: input.countryCode,
    returnUrl: input.returnUrl,
  });
  if (!opened.ok) throw new Error(opened.error);
  const submission = await prisma.creatorKycSubmission.upsert({
    where: { creatorSlug: input.slug },
    update: {
      creatorId: input.creatorId,
      countryCode: input.countryCode,
      kycModel: "gateway",
      gatewayProviderId: provider.id,
      gatewaySessionId: opened.id,
      gatewaySessionUrl: opened.url,
      status: "pending_gateway",
      detailsJson: {},
    },
    create: {
      creatorSlug: input.slug,
      creatorId: input.creatorId,
      countryCode: input.countryCode,
      kycModel: "gateway",
      gatewayProviderId: provider.id,
      gatewaySessionId: opened.id,
      gatewaySessionUrl: opened.url,
      status: "pending_gateway",
      detailsJson: {},
    },
  });
  await prisma.creatorKycDocument.deleteMany({ where: { submissionId: submission.id } });
  if (input.creatorId) {
    await prisma.creator.update({
      where: { id: input.creatorId },
      data: { identityVerified: "PENDING" },
    });
  }
  return submission;
}

async function applyIdentityDecision(input: {
  creatorId: string | null | undefined;
  creatorSlug: string;
  decision: "verified" | "rejected";
}) {
  const creator =
    (input.creatorId
      ? await prisma.creator.findUnique({ where: { id: input.creatorId } })
      : null) ?? (await prisma.creator.findUnique({ where: { slug: input.creatorSlug } }));
  if (!creator) return null;
  await prisma.creator.update({
    where: { id: creator.id },
    data: { identityVerified: input.decision === "verified" ? "VERIFIED" : "REJECTED" },
  });
  try {
    const { computePayoutReadiness } = await import("@/lib/payout-readiness");
    await computePayoutReadiness({
      creatorId: creator.id,
      identityVerified: input.decision === "verified",
      locationCountry: creator.locationCountry,
    });
  } catch {
    /* payout refresh is best-effort after KYC */
  }
  return creator;
}

/**
 * Admin (or gateway webhook) marks KYC complete on the submission and mirrors
 * Creator.identityVerified so payout readiness can clear the identity blocker.
 */
export async function reviewDocumentKyc(input: {
  submissionId: string;
  decision: "verified" | "rejected";
  /** When true, allow verifying gateway submissions manually from admin. */
  allowGateway?: boolean;
}) {
  const submission = await prisma.creatorKycSubmission.findUnique({ where: { id: input.submissionId } });
  if (!submission) throw new Error("That KYC submission was not found.");
  if (submission.kycModel !== "government_id" && !input.allowGateway) {
    throw new Error("Gateway KYC is completed by the selected gateway.");
  }
  const creator = await applyIdentityDecision({
    creatorId: submission.creatorId,
    creatorSlug: submission.creatorSlug,
    decision: input.decision,
  });
  await prisma.creatorKycSubmission.update({
    where: { id: submission.id },
    data: { status: input.decision, creatorId: creator?.id ?? submission.creatorId },
  });
}

/** Stripe Identity (or admin) completion for gateway KYC sessions. */
export async function completeGatewayKyc(input: {
  sessionId?: string | null;
  creatorSlug?: string | null;
  decision: "verified" | "rejected";
}) {
  const sessionId = (input.sessionId ?? "").trim();
  const slug = (input.creatorSlug ?? "").trim();
  const submission = sessionId
    ? await prisma.creatorKycSubmission.findFirst({ where: { gatewaySessionId: sessionId } })
    : slug
      ? await prisma.creatorKycSubmission.findUnique({ where: { creatorSlug: slug } })
      : null;
  if (!submission) throw new Error("That gateway KYC submission was not found.");
  const creator = await applyIdentityDecision({
    creatorId: submission.creatorId,
    creatorSlug: submission.creatorSlug,
    decision: input.decision,
  });
  await prisma.creatorKycSubmission.update({
    where: { id: submission.id },
    data: { status: input.decision, creatorId: creator?.id ?? submission.creatorId },
  });
  return submission;
}

/**
 * Identity for payouts / contract gates: Creator.identityVerified, with a heal from a
 * verified KYC submission when the account flag was never written.
 */
export async function resolveCreatorIdentityVerified(input: {
  creatorId?: string | null;
  creatorSlug?: string | null;
  identityVerified?: string | null;
}): Promise<boolean> {
  if (input.identityVerified === "VERIFIED") return true;
  const slug = (input.creatorSlug ?? "").trim();
  const submission = input.creatorId
    ? await prisma.creatorKycSubmission.findFirst({
        where: {
          OR: [
            { creatorId: input.creatorId },
            ...(slug ? [{ creatorSlug: slug }] : []),
          ],
        },
        orderBy: { updatedAt: "desc" },
      })
    : slug
      ? await prisma.creatorKycSubmission.findUnique({ where: { creatorSlug: slug } })
      : null;
  if (!submission || submission.status !== "verified") return false;
  await applyIdentityDecision({
    creatorId: input.creatorId ?? submission.creatorId,
    creatorSlug: submission.creatorSlug,
    decision: "verified",
  });
  return true;
}

/** Admin can mark any creator's account KYC-complete without a pending submission row. */
export async function adminSetCreatorKyc(input: {
  creatorSlug: string;
  decision: "verified" | "rejected";
}) {
  const slug = input.creatorSlug.trim();
  if (!slug) throw new Error("Choose a creator.");
  const creator = await applyIdentityDecision({
    creatorId: null,
    creatorSlug: slug,
    decision: input.decision,
  });
  if (!creator) throw new Error("That creator was not found.");
  await prisma.creatorKycSubmission.upsert({
    where: { creatorSlug: slug },
    update: {
      creatorId: creator.id,
      status: input.decision,
      kycModel: "government_id",
    },
    create: {
      creatorSlug: slug,
      creatorId: creator.id,
      countryCode: "",
      kycModel: "government_id",
      gatewaySessionId: "",
      gatewaySessionUrl: "",
      status: input.decision,
      detailsJson: { admin: "Manual admin KYC decision" },
    },
  });
  return creator;
}
