import { prisma } from "@/lib/db";
import { deliverMail, loadMailConfig } from "@/lib/mail";
import { SMS_BODY_MAX, SMS_NOT_SENT_MESSAGE, smsProviderLabel } from "@/lib/sms";

export { SMS_BODY_MAX, SMS_NOT_SENT_MESSAGE, smsProviderLabel };

export const COMM_AUDIENCES = ["all", "user", "business", "influencer", "admin"] as const;
export type CommAudience = (typeof COMM_AUDIENCES)[number];

export const COMM_MODES = ["auto", "manual"] as const;
export type CommMode = (typeof COMM_MODES)[number];

export const COMM_TRIGGERS = [
  { key: "welcome", label: "Welcome (account created)", mode: "auto" as const },
  { key: "password_reset", label: "Password reset", mode: "auto" as const },
  { key: "email_verify", label: "Verify email", mode: "auto" as const },
  { key: "collaboration_invite", label: "Collaboration invite", mode: "auto" as const },
  { key: "collaboration_accepted", label: "Collaboration accepted", mode: "auto" as const },
  { key: "payout_ready", label: "Payout ready", mode: "auto" as const },
  { key: "manual_broadcast", label: "Manual broadcast", mode: "manual" as const },
  { key: "custom", label: "Custom", mode: "manual" as const },
] as const;

export type CommTriggerKey = (typeof COMM_TRIGGERS)[number]["key"];

/** Placeholders admins can use in subject / email / SMS bodies. */
export const COMM_TEMPLATE_VARIABLES = [
  { key: "name", hint: "Recipient display name" },
  { key: "email", hint: "Recipient email" },
  { key: "phone", hint: "Recipient phone" },
  { key: "link", hint: "Primary action URL" },
  { key: "expiry", hint: "Expiry window text" },
  { key: "profile", hint: "Creator / profile slug" },
  { key: "business", hint: "Business / workspace name" },
  { key: "collaboration", hint: "Collaboration title" },
  { key: "amount", hint: "Money amount (formatted)" },
  { key: "code", hint: "One-time code" },
] as const;

export type CommVars = Partial<Record<(typeof COMM_TEMPLATE_VARIABLES)[number]["key"], string>>;

const DEFAULT_TEMPLATES: {
  key: string;
  name: string;
  audience: CommAudience;
  mode: CommMode;
  triggerKey: CommTriggerKey;
  subject: string;
  bodyEmail: string;
  bodySms: string;
  sortOrder: number;
}[] = [
  {
    key: "welcome",
    name: "Welcome",
    audience: "all",
    mode: "auto",
    triggerKey: "welcome",
    subject: "Welcome to Influrios, {{name}}",
    bodyEmail:
      "Hi {{name}},\n\nYour Influrios account is ready. Open your hub: {{link}}\n\n— Influrios",
    bodySms: "Welcome to Influrios, {{name}}. Open: {{link}}",
    sortOrder: 10,
  },
  {
    key: "password_reset",
    name: "Password reset",
    audience: "user",
    mode: "auto",
    triggerKey: "password_reset",
    subject: "Reset your Influrios password",
    bodyEmail:
      "Hi {{name}},\n\nReset your password with this link (expires {{expiry}}):\n{{link}}\n\nIf you did not ask for this, ignore this email.",
    bodySms: "Influrios password reset ({{expiry}}): {{link}}",
    sortOrder: 20,
  },
  {
    key: "email_verify",
    name: "Verify email",
    audience: "user",
    mode: "auto",
    triggerKey: "email_verify",
    subject: "Confirm your Influrios email",
    bodyEmail: "Hi {{name}},\n\nConfirm your email: {{link}}\n\nCode: {{code}}",
    bodySms: "Influrios code {{code}}. Or open {{link}}",
    sortOrder: 30,
  },
  {
    key: "collaboration_invite",
    name: "Collaboration invite",
    audience: "influencer",
    mode: "auto",
    triggerKey: "collaboration_invite",
    subject: "{{business}} invited you to collaborate",
    bodyEmail:
      "Hi {{name}},\n\n{{business}} invited you to “{{collaboration}}”. Review: {{link}}",
    bodySms: "{{business}} collab invite: {{link}}",
    sortOrder: 40,
  },
  {
    key: "manual_broadcast",
    name: "Manual broadcast",
    audience: "all",
    mode: "manual",
    triggerKey: "manual_broadcast",
    subject: "A message from Influrios",
    bodyEmail: "Hi {{name}},\n\n{{link}}",
    bodySms: "Influrios: see {{link}}",
    sortOrder: 100,
  },
];

export function renderCommCopy(template: string, vars: CommVars) {
  return template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key: string) => {
    const value = vars[key as keyof CommVars];
    return value != null && value !== "" ? String(value) : "";
  });
}

export function clampSmsBody(value: string) {
  return value.replace(/\r\n/g, "\n").trim().slice(0, SMS_BODY_MAX);
}

export async function ensureCommCatalog() {
  for (const seed of DEFAULT_TEMPLATES) {
    await prisma.commTemplate.upsert({
      where: { key: seed.key },
      update: {},
      create: seed,
    });
  }
  await prisma.commChannelSettings.upsert({
    where: { id: "default" },
    update: {},
    create: { id: "default", emailEnabled: true, smsEnabled: false },
  });
}

export async function getCommChannelSettings() {
  await ensureCommCatalog();
  const row = await prisma.commChannelSettings.findUnique({ where: { id: "default" } });
  return {
    emailEnabled: row?.emailEnabled ?? true,
    smsEnabled: false,
  };
}

export async function saveCommChannelSettings(input: { emailEnabled: boolean; smsEnabled?: boolean }) {
  await prisma.commChannelSettings.upsert({
    where: { id: "default" },
    create: {
      id: "default",
      emailEnabled: input.emailEnabled,
      smsEnabled: false,
    },
    update: {
      emailEnabled: input.emailEnabled,
      smsEnabled: false,
    },
  });
}

export async function listCommTemplates() {
  await ensureCommCatalog();
  return prisma.commTemplate.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }] });
}

export async function saveCommTemplate(input: {
  id?: string;
  key: string;
  name: string;
  audience: string;
  mode: string;
  triggerKey: string;
  subject: string;
  bodyEmail: string;
  bodySms: string;
  active: boolean;
  sortOrder?: number;
}) {
  const key = input.key
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 60);
  if (!key) throw new Error("A template key is required.");
  const name = input.name.trim().slice(0, 120);
  if (!name) throw new Error("A template name is required.");
  const audience = (COMM_AUDIENCES as readonly string[]).includes(input.audience) ? input.audience : "all";
  const mode = (COMM_MODES as readonly string[]).includes(input.mode) ? input.mode : "manual";
  const bodySms = clampSmsBody(input.bodySms);
  const data = {
    name,
    audience,
    mode,
    triggerKey: input.triggerKey.trim().slice(0, 60) || "custom",
    subject: input.subject.trim().slice(0, 200),
    bodyEmail: input.bodyEmail.trim().slice(0, 20_000),
    bodySms,
    active: input.active,
    sortOrder: input.sortOrder ?? 100,
  };
  if (input.id) {
    return prisma.commTemplate.update({ where: { id: input.id }, data });
  }
  return prisma.commTemplate.create({ data: { key, ...data } });
}

export async function deleteCommTemplate(id: string) {
  const row = await prisma.commTemplate.findUnique({ where: { id } });
  if (!row) throw new Error("Template not found.");
  if (DEFAULT_TEMPLATES.some((seed) => seed.key === row.key)) {
    throw new Error("Built-in templates cannot be deleted. Deactivate them instead.");
  }
  await prisma.commTemplate.delete({ where: { id } });
}

const SAMPLE_VARS: CommVars = {
  name: "Sofia Martinez",
  email: "sofia@example.com",
  phone: "+15555550100",
  link: "https://influrios.com/example",
  expiry: "14 days",
  profile: "sofia-martinez",
  business: "Harbor Brand",
  collaboration: "Summer launch",
  amount: "$250.00",
  code: "482913",
};

export async function sendCommTemplateTest(input: {
  templateId: string;
  toEmail: string;
  toPhone?: string;
  channel: "email" | "sms";
}): Promise<{ ok: boolean; message: string }> {
  const channels = await getCommChannelSettings();
  const template = await prisma.commTemplate.findUnique({ where: { id: input.templateId } });
  if (!template || !template.active) return { ok: false, message: "Choose an active template." };
  if (input.channel === "sms") return { ok: false, message: SMS_NOT_SENT_MESSAGE };

  if (input.channel === "email") {
    if (!channels.emailEnabled) return { ok: false, message: "Email channel is turned off." };
    const config = await loadMailConfig();
    if (!config) return { ok: false, message: "SMTP is not configured. Nothing was sent." };
    const result = await deliverMail(config, {
      to: input.toEmail,
      subject: renderCommCopy(template.subject, SAMPLE_VARS),
      text: renderCommCopy(template.bodyEmail, SAMPLE_VARS),
    });
    try {
      await prisma.job.create({
        data: {
          kind: "mail_test",
          status: result.ok ? "succeeded" : "failed",
          lastError: result.ok ? null : result.error,
          payload: { to: input.toEmail, templateKey: template.key, channel: "email" },
        },
      });
    } catch {
      /* SMTP result still stands */
    }
    if (result.ok) return { ok: true, message: `SMTP accepted “${template.name}”.` };
    return { ok: false, message: result.error };
  }

  return { ok: false, message: SMS_NOT_SENT_MESSAGE };
}

export async function setUserCommPreference(input: { userId: string; phone?: string }) {
  const phone = (input.phone ?? "").trim().slice(0, 40);
  return prisma.user.update({
    where: { id: input.userId },
    data: {
      preferredCommChannel: "email",
      phone: phone || null,
    },
  });
}
