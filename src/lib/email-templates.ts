import { prisma } from "@/lib/db";
import {
  emailCatalogTemplate,
  emailCopyProblems,
  emailGroupLabel,
  listEmailCatalog,
  type EmailCatalogTemplate,
} from "@/lib/email-catalog";
import { renderCatalogPreview, type EmailCopy } from "@/lib/email-render";

export type EmailTemplateCopy = {
  subject: string;
  preheader: string;
  headline: string;
  body: string[];
  cta: string;
};

const MAIL_LOG_KINDS = [
  "invitation_email",
  "verification_email",
  "claim_verification_email",
  "password_reset_email",
  "mail_test",
  "collab_notification",
  "catalog_email",
] as const;

const SENSITIVE_KINDS = new Set(["verification_email", "claim_verification_email", "password_reset_email"]);

const KIND_SUBJECT: Record<string, string> = {
  invitation_email: "Profile invitation",
  verification_email: "Verification code",
  claim_verification_email: "Claim verification code",
  password_reset_email: "Password reset",
  mail_test: "SMTP test",
  collab_notification: "Collaboration notice",
  catalog_email: "Catalog email",
};

function missingTable(error: unknown) {
  const code = typeof error === "object" && error && "code" in error ? String(error.code) : "";
  return code === "P2021" || code === "P2022";
}

function paragraphs(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

function copyFromCatalog(template: EmailCatalogTemplate): EmailTemplateCopy {
  return {
    subject: template.subject,
    preheader: template.preheader,
    headline: template.title,
    body: template.body,
    cta: template.cta,
  };
}

function copyFromRow(row: {
  subject: string;
  preheader: string;
  headline: string;
  bodyJson: unknown;
  cta: string;
}): EmailTemplateCopy {
  const body = paragraphs(row.bodyJson);
  return {
    subject: row.subject,
    preheader: row.preheader,
    headline: row.headline,
    body: body.length ? body : [""],
    cta: row.cta,
  };
}

export function emailTestRecipient(value: string) {
  const to = value.trim();
  const ok =
    to.length > 0 &&
    to.length <= 200 &&
    !/[\s,;<>]/.test(to) &&
    /^[^@]+@[^@]+\.[^@]+$/.test(to) &&
    !to.startsWith(".") &&
    !to.endsWith(".") &&
    !to.includes("..");
  if (!ok) throw new Error("Enter one email address for the test.");
  return to;
}

export function parseEmailBody(value: string) {
  return value
    .replace(/\r\n/g, "\n")
    .split(/\n+/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
    .slice(0, 12);
}

export async function listEmailTemplateRecords(templateKey?: string) {
  try {
    return await prisma.emailTemplateRecord.findMany({
      where: templateKey ? { templateKey } : undefined,
      orderBy: [{ versionNumber: "desc" }, { updatedAt: "desc" }],
    });
  } catch (error) {
    if (missingTable(error)) return [];
    throw error;
  }
}

export async function listEmailTemplateRows(query: { q?: string; group?: string }) {
  const records = await listEmailTemplateRecords();
  const needle = (query.q ?? "").trim().toLowerCase();
  return listEmailCatalog()
    .filter((template) => !query.group || template.group === query.group)
    .map((template) => {
      const rows = records.filter((row) => row.templateKey === template.id);
      const published = rows.find((row) => row.kind === "published");
      const draft = rows.find((row) => row.kind === "draft");
      const status = published && draft ? "Published · draft" : published ? "Published" : draft ? "Draft" : "Catalog";
      return {
        id: template.id,
        title: template.title,
        audience: template.audience,
        category: template.category,
        group: template.group,
        groupLabel: emailGroupLabel(template.group),
        trigger: template.trigger,
        version: published?.versionNumber ?? template.version,
        status,
        updatedAt: published?.updatedAt ?? null,
      };
    })
    .filter((row) => {
      if (!needle) return true;
      return [row.id, row.title, row.audience, row.trigger, row.category, row.groupLabel].join(" ").toLowerCase().includes(needle);
    });
}

export async function loadEmailTemplateEditor(id: string) {
  const template = emailCatalogTemplate(id);
  if (!template) return null;
  const records = await listEmailTemplateRecords(id);
  const published = records.find((row) => row.kind === "published");
  const draft = records.find((row) => row.kind === "draft");
  const current = draft ?? published;
  const copy = current ? copyFromRow(current) : copyFromCatalog(template);
  return {
    template,
    copy,
    status: published && draft ? "Published · draft" : published ? "Published" : draft ? "Draft" : "Catalog",
    history: records
      .filter((row) => row.kind !== "draft")
      .map((row) => ({
        id: row.id,
        kind: row.kind,
        versionNumber: row.versionNumber,
        actor: row.actor,
        updatedAt: row.updatedAt,
        subject: row.subject,
      })),
  };
}

async function nextVersion(templateKey: string) {
  const rows = await listEmailTemplateRecords(templateKey);
  return Math.max(1, ...rows.map((row) => row.versionNumber)) + 1;
}

export async function saveEmailTemplateDraft(input: {
  templateKey: string;
  copy: EmailTemplateCopy;
  actor: string;
}) {
  const template = emailCatalogTemplate(input.templateKey);
  if (!template) throw new Error("That email template is not in the catalog.");
  const problems = emailCopyProblems({
    template,
    subject: input.copy.subject,
    preheader: input.copy.preheader,
    headline: input.copy.headline,
    body: input.copy.body,
    cta: input.copy.cta,
  });
  if (problems.length) throw new Error(problems[0]);
  const data = {
    subject: input.copy.subject.trim().slice(0, 200),
    preheader: input.copy.preheader.trim().slice(0, 180),
    headline: input.copy.headline.trim().slice(0, 160),
    bodyJson: input.copy.body,
    cta: input.copy.cta.trim().slice(0, 80),
    actor: input.actor,
  };
  const existing = (await listEmailTemplateRecords(input.templateKey)).find((row) => row.kind === "draft");
  if (existing) {
    await prisma.emailTemplateRecord.update({ where: { id: existing.id }, data });
  } else {
    await prisma.emailTemplateRecord.create({
      data: { templateKey: input.templateKey, kind: "draft", versionNumber: 0, ...data },
    });
  }
  await prisma.auditLog.create({
    data: {
      actor: input.actor,
      action: "email_template_draft",
      objectType: "EmailTemplate",
      objectId: input.templateKey,
      after: { subject: data.subject, headline: data.headline },
    },
  });
}

export async function publishEmailTemplate(input: { templateKey: string; actor: string }) {
  const draft = (await listEmailTemplateRecords(input.templateKey)).find((row) => row.kind === "draft");
  if (!draft) throw new Error("Save a draft before publishing.");
  const versionNumber = await nextVersion(input.templateKey);
  await prisma.emailTemplateRecord.updateMany({
    where: { templateKey: input.templateKey, kind: "published" },
    data: { kind: "superseded" },
  });
  await prisma.emailTemplateRecord.update({
    where: { id: draft.id },
    data: { kind: "published", versionNumber, actor: input.actor },
  });
  await prisma.auditLog.create({
    data: {
      actor: input.actor,
      action: "email_template_publish",
      objectType: "EmailTemplate",
      objectId: input.templateKey,
      after: { versionNumber, subject: draft.subject },
    },
  });
}

export async function rollbackEmailTemplate(input: { templateKey: string; recordId: string; actor: string }) {
  const rows = await listEmailTemplateRecords(input.templateKey);
  const source = rows.find((row) => row.id === input.recordId && row.kind === "superseded");
  if (!source) throw new Error("Choose an earlier published version to restore.");
  const versionNumber = Math.max(1, ...rows.map((row) => row.versionNumber)) + 1;
  await prisma.emailTemplateRecord.updateMany({
    where: { templateKey: input.templateKey, kind: "published" },
    data: { kind: "superseded" },
  });
  await prisma.emailTemplateRecord.create({
    data: {
      templateKey: input.templateKey,
      kind: "published",
      versionNumber,
      subject: source.subject,
      preheader: source.preheader,
      headline: source.headline,
      bodyJson: source.bodyJson ?? [],
      cta: source.cta,
      actor: input.actor,
    },
  });
  await prisma.auditLog.create({
    data: {
      actor: input.actor,
      action: "email_template_rollback",
      objectType: "EmailTemplate",
      objectId: input.templateKey,
      after: { versionNumber, restoredFrom: source.versionNumber },
    },
  });
}

export function previewEmailTemplate(templateKey: string, copy: EmailTemplateCopy) {
  const template = emailCatalogTemplate(templateKey);
  if (!template) throw new Error("That email template is not in the catalog.");
  const problems = emailCopyProblems({ template, ...copy, headline: copy.headline });
  if (problems.length) throw new Error(problems[0]);
  const rendered = renderCatalogPreview(template, {
    subject: copy.subject,
    preheader: copy.preheader,
    title: copy.headline,
    body: copy.body,
    cta: copy.cta,
  } satisfies Partial<EmailCopy>);
  return {
    ...rendered,
    text: `${rendered.text}\n\nThis is a design test. The links use influrios.example and do not sign in, approve work, or move money.`,
  };
}

export function publicEmailDelivery(job: {
  id: string;
  kind: string;
  status: string;
  createdAt: Date;
  lastError: string | null;
  payload: unknown;
}) {
  const payload = job.payload && typeof job.payload === "object" && !Array.isArray(job.payload) ? job.payload : {};
  const record = payload as Record<string, unknown>;
  const to = typeof record.to === "string" ? record.to : typeof record.email === "string" ? record.email : "";
  const subject = SENSITIVE_KINDS.has(job.kind)
    ? KIND_SUBJECT[job.kind]
    : typeof record.subject === "string" && record.subject.trim()
      ? record.subject.trim().slice(0, 180)
      : KIND_SUBJECT[job.kind] ?? job.kind;
  return {
    id: job.id,
    kind: job.kind,
    status: job.status,
    at: job.createdAt,
    to,
    subject,
    error: job.lastError?.slice(0, 180) ?? "",
  };
}

export async function listRecentEmailDeliveries() {
  try {
    const jobs = await prisma.job.findMany({
      where: { kind: { in: [...MAIL_LOG_KINDS] } },
      orderBy: { createdAt: "desc" },
      take: 40,
      select: { id: true, kind: true, status: true, createdAt: true, lastError: true, payload: true },
    });
    return jobs.map(publicEmailDelivery);
  } catch (error) {
    if (missingTable(error)) return [];
    throw error;
  }
}
