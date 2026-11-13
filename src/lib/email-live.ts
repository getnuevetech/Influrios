import { prisma } from "@/lib/db";
import { getAppOrigin } from "@/lib/billing";
import {
  emailCatalogTemplate,
  emailCopyProblems,
  type EmailCatalogTemplate,
} from "@/lib/email-catalog";
import { emailCopyFromCatalog, renderEmail, type EmailCopy } from "@/lib/email-render";
import { mailSettingsView, sendMail } from "@/lib/mail";
import { productSwitch, type ProductSwitchKey } from "@/lib/product-switches";

export const EMAIL_CATEGORY_KEYS = [
  "account",
  "invite",
  "contract",
  "funding",
  "milestone",
  "payout",
  "dispute",
  "cancellation",
  "refund",
  "payment",
  "ops",
  "billing",
  "marketing",
] as const;

export type EmailCategoryKey = (typeof EMAIL_CATEGORY_KEYS)[number];

export const ESSENTIAL_EMAIL_TEMPLATES = [
  "account.verify",
  "account.reset",
  "account.card_verify",
  "account.claim",
  "account.admin_setup",
  "invite.collaboration",
  "funding.required",
  "payout.requested",
  "payout.failed",
  "payout.returned",
] as const;

const COLLAB_GROUPS = new Set([
  "invite",
  "contract",
  "funding",
  "milestone",
  "payout",
  "dispute",
  "cancellation",
  "refund",
  "payment",
]);

const categoryOverrides = new Map<string, boolean>();

export function setEmailCategoryForTests(key: string, enabled: boolean | null) {
  if (enabled == null) categoryOverrides.delete(key);
  else categoryOverrides.set(key, enabled);
}

export function templateFeature(templateId: string): ProductSwitchKey | null {
  if (templateId.startsWith("invite.team_")) return "collab_os_v1";
  return null;
}

export function catalogTemplateForCollab(
  kind: string,
  role: "business" | "influencer" | "admin",
): string | null {
  const table: Record<string, Partial<Record<"business" | "influencer" | "admin", string>>> = {
    funding_required: { business: "funding.required" },
    funding_successful: { business: "funding.confirmed_business", influencer: "funding.confirmed_influencer" },
    funding_failed: { business: "funding.failed" },
    milestone_submitted: { business: "milestone.submitted" },
    review_deadline_approaching: { business: "milestone.review_reminder" },
    revision_requested: { influencer: "milestone.revision" },
    milestone_approved: { business: "milestone.approved", influencer: "milestone.approved" },
    milestone_auto_approved: { business: "milestone.auto_approved", influencer: "milestone.auto_approved" },
    payout_completed: { influencer: "payout.confirmed", business: "payout.confirmed_business" },
    payout_failed: { influencer: "payout.failed", admin: "payout.failed_admin" },
    payout_requested: { influencer: "payout.requested", business: "payout.requested_business" },
    payout_retry: { influencer: "payout.retry", business: "payout.retry" },
    payout_returned: {
      influencer: "payout.returned",
      business: "payout.returned_business",
      admin: "payout.returned_admin",
    },
    dispute_opened: { business: "dispute.opened", influencer: "dispute.opened", admin: "dispute.opened_admin" },
    dispute_resolved: { business: "dispute.resolved", influencer: "dispute.resolved" },
    collaboration_cancelled: { business: "cancellation.completed", influencer: "cancellation.completed" },
    refund_completed: { business: "refund.completed_business", influencer: "refund.completed_influencer" },
    payment_risk: { business: "payment.risk", influencer: "payment.risk" },
    change_order_accepted: { business: "contract.change_accepted", influencer: "contract.change_accepted" },
    preexisting_relationship_claimed: { admin: "ops.relationship_claim" },
    provider_jurisdiction_limitation: { business: "ops.route_blocked", influencer: "ops.route_blocked", admin: "ops.route_blocked_admin" },
    dispute_sla_reminder: { business: "dispute.response_reminder", influencer: "dispute.response_reminder", admin: "dispute.overdue_admin" },
    provider_hold_period_warning: { admin: "ops.hold_warning" },
    stale_funding: { admin: "ops.stale_funding" },
    ledger_mismatch: { admin: "ops.ledger_mismatch" },
  };
  return table[kind]?.[role] ?? table[kind]?.business ?? table[kind]?.influencer ?? table[kind]?.admin ?? null;
}

function missingTable(error: unknown) {
  const code = typeof error === "object" && error && "code" in error ? String(error.code) : "";
  return code === "P2021" || code === "P2022";
}

export async function emailCategoryEnabled(group: string) {
  if (categoryOverrides.has(group)) return categoryOverrides.get(group)!;
  try {
    const row = await prisma.emailCategorySwitch.findUnique({ where: { key: group } });
    return row?.enabled ?? true;
  } catch (error) {
    if (missingTable(error)) return true;
    throw error;
  }
}

export async function listEmailCategorySwitches() {
  const rows = await Promise.all(
    EMAIL_CATEGORY_KEYS.map(async (key) => ({ key, enabled: await emailCategoryEnabled(key) })),
  );
  return rows;
}

export async function saveEmailCategorySwitch(key: string, enabled: boolean, actor: string) {
  if (!EMAIL_CATEGORY_KEYS.includes(key as EmailCategoryKey)) throw new Error("Unknown email category.");
  await prisma.emailCategorySwitch.upsert({
    where: { key },
    create: { key, enabled },
    update: { enabled },
  });
  await prisma.auditLog.create({
    data: {
      actor,
      action: enabled ? "email_category_on" : "email_category_off",
      objectType: "EmailCategory",
      objectId: key,
      after: { enabled },
    },
  });
}

export function pauseReasonProblem(templateId: string, reason: string) {
  const cleaned = reason.replace(/\s+/g, " ").trim();
  const minimum = ESSENTIAL_EMAIL_TEMPLATES.includes(templateId as (typeof ESSENTIAL_EMAIL_TEMPLATES)[number]) ? 8 : 3;
  if (cleaned.length < minimum) return `A pause reason of at least ${minimum} characters is required.`;
  return "";
}

export async function listEmailPauses() {
  try {
    return await prisma.emailTemplatePause.findMany({ orderBy: { templateKey: "asc" } });
  } catch (error) {
    if (missingTable(error)) return [];
    throw error;
  }
}

export async function emailTemplatePause(templateId: string) {
  try {
    return await prisma.emailTemplatePause.findUnique({ where: { templateKey: templateId } });
  } catch (error) {
    if (missingTable(error)) return null;
    throw error;
  }
}

export async function pauseEmailTemplate(input: { templateId: string; reason: string; actor: string }) {
  const problem = pauseReasonProblem(input.templateId, input.reason);
  if (problem) throw new Error(problem);
  const reason = input.reason.replace(/\s+/g, " ").trim().slice(0, 240);
  await prisma.emailTemplatePause.upsert({
    where: { templateKey: input.templateId },
    create: { templateKey: input.templateId, reason, actor: input.actor },
    update: { reason, actor: input.actor },
  });
  await prisma.auditLog.create({
    data: {
      actor: input.actor,
      action: "email_template_pause",
      objectType: "EmailTemplate",
      objectId: input.templateId,
      after: { reason },
    },
  });
}

export async function resumeEmailTemplate(input: { templateId: string; actor: string }) {
  await prisma.emailTemplatePause.deleteMany({ where: { templateKey: input.templateId } });
  await prisma.auditLog.create({
    data: {
      actor: input.actor,
      action: "email_template_resume",
      objectType: "EmailTemplate",
      objectId: input.templateId,
    },
  });
}

export async function emailPreference(email: string) {
  const key = email.trim().toLowerCase();
  try {
    const row = await prisma.emailPreference.findUnique({ where: { email: key } });
    return {
      email: key,
      collaborations: row?.collaborations ?? true,
      billing: row?.billing ?? true,
      outreach: row?.outreach ?? true,
      productNews: row?.productNews ?? false,
    };
  } catch (error) {
    if (missingTable(error)) {
      return { email: key, collaborations: true, billing: true, outreach: true, productNews: false };
    }
    throw error;
  }
}

export async function saveEmailPreference(input: {
  email: string;
  collaborations: boolean;
  billing: boolean;
  outreach: boolean;
  productNews: boolean;
}) {
  const email = input.email.trim().toLowerCase();
  await prisma.emailPreference.upsert({
    where: { email },
    create: {
      email,
      collaborations: input.collaborations,
      billing: input.billing,
      outreach: input.outreach,
      productNews: input.productNews,
    },
    update: {
      collaborations: input.collaborations,
      billing: input.billing,
      outreach: input.outreach,
      productNews: input.productNews,
    },
  });
}

export function preferenceAllows(
  template: Pick<EmailCatalogTemplate, "group" | "category">,
  preference: { collaborations: boolean; billing: boolean; outreach: boolean; productNews: boolean },
) {
  if (template.category === "outreach" || template.group === "marketing") {
    return template.group === "marketing" ? preference.productNews : preference.outreach;
  }
  if (template.category === "internal" || template.group === "account" || template.group === "ops") return true;
  if (template.group === "billing") return preference.billing;
  if (COLLAB_GROUPS.has(template.group)) return preference.collaborations;
  return true;
}

function appHost() {
  try {
    return new URL(getAppOrigin());
  } catch {
    return null;
  }
}

export function liveMailLinks() {
  const origin = getAppOrigin().replace(/\/$/, "");
  const host = appHost();
  return {
    origin,
    hosts: [host?.hostname, "influrios.example"].filter((item): item is string => Boolean(item)),
    allowHttpHosts: host?.protocol === "http:" ? [host.hostname] : [],
    support_url: `${origin}/account`,
    preference_url: `${origin}/account/notifications`,
    unsubscribe_url: `${origin}/account/notifications`,
    sender_legal_name: "Influrios",
    sender_postal_address: "Contact Influrios support for the mailing address.",
  };
}

function chicago(date: Date) {
  return `${new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago",
    dateStyle: "long",
    timeStyle: "short",
  }).format(date)} CT`;
}

export function displayMoney(cents: number | null | undefined, currency = "USD") {
  if (cents == null || !Number.isInteger(cents)) return "—";
  const abs = Math.abs(cents);
  const major = Math.floor(abs / 100).toLocaleString("en-US");
  const minor = String(abs % 100).padStart(2, "0");
  return `${cents < 0 ? "-" : ""}${currency} ${major}.${minor}`;
}

async function publishedCopy(template: EmailCatalogTemplate): Promise<EmailCopy> {
  const base = emailCopyFromCatalog(template);
  try {
    const row = await prisma.emailTemplateRecord.findFirst({
      where: { templateKey: template.id, kind: "published" },
      orderBy: { versionNumber: "desc" },
    });
    if (!row) return base;
    const body = Array.isArray(row.bodyJson) ? row.bodyJson.filter((item): item is string => typeof item === "string") : base.body;
    const copy: EmailCopy = {
      ...base,
      subject: row.subject,
      preheader: row.preheader,
      title: row.headline,
      body: body.length ? body : base.body,
      cta: row.cta,
    };
    const problems = emailCopyProblems({
      template,
      subject: copy.subject,
      preheader: copy.preheader,
      headline: copy.title,
      body: copy.body,
      cta: copy.cta,
    });
    return problems.length ? base : copy;
  } catch (error) {
    if (missingTable(error)) return base;
    throw error;
  }
}

export async function renderLiveCatalog(templateId: string, vars: Record<string, string>) {
  const template = emailCatalogTemplate(templateId);
  if (!template) throw new Error("That email template is not in the catalog.");
  const links = liveMailLinks();
  const context: Record<string, string> = {
    first_name: "",
    support_url: links.support_url,
    preference_url: links.preference_url,
    unsubscribe_url: links.unsubscribe_url,
    sender_legal_name: links.sender_legal_name,
    sender_postal_address: links.sender_postal_address,
    action_url: `${links.origin}/account`,
    ...vars,
  };
  for (const name of template.variables) {
    if (!context[name]?.trim()) context[name] = "—";
  }
  const copy = await publishedCopy(template);
  return renderEmail({
    copy,
    context,
    hosts: links.hosts,
    allowHttpHosts: links.allowHttpHosts,
  });
}

export type CatalogDelivery =
  | { sent: true; subject: string }
  | { sent: false; reason: "switch_off" | "paused" | "preference" | "feature_off" | "render" | "smtp"; error?: string };

export async function deliverCatalogEmail(input: {
  templateId: string;
  to: string;
  vars: Record<string, string>;
  log?: boolean;
}): Promise<CatalogDelivery> {
  const template = emailCatalogTemplate(input.templateId);
  if (!template) return { sent: false, reason: "render", error: "Unknown template." };
  if (!(await emailCategoryEnabled(template.group))) return { sent: false, reason: "switch_off" };
  const feature = templateFeature(template.id);
  if (feature && !(await productSwitch(feature))) return { sent: false, reason: "feature_off" };
  if (await emailTemplatePause(template.id)) return { sent: false, reason: "paused" };
  const preference = await emailPreference(input.to);
  if (!preferenceAllows(template, preference)) return { sent: false, reason: "preference" };
  let rendered: { subject: string; text: string; html: string };
  try {
    rendered = await renderLiveCatalog(template.id, input.vars);
  } catch (error) {
    return { sent: false, reason: "render", error: error instanceof Error ? error.message : "Could not render." };
  }
  const fromName = (await mailSettingsView().catch(() => null))?.fromName ?? "";
  const sent = await sendMail({
    to: input.to,
    subject: rendered.subject,
    text: rendered.text,
    html: rendered.html,
    fromName,
  });
  if (input.log !== false) {
    await recordCatalogDelivery({
      to: input.to,
      subject: rendered.subject,
      templateId: template.id,
      status: sent.ok ? "succeeded" : "failed",
      error: sent.ok ? "" : sent.error,
    }).catch(() => undefined);
  }
  if (!sent.ok) return { sent: false, reason: "smtp", error: sent.error };
  return { sent: true, subject: rendered.subject };
}

export async function recordCatalogDelivery(input: {
  to: string;
  subject: string;
  templateId: string;
  status: "succeeded" | "failed";
  error?: string;
}) {
  const sensitive = /verify|reset|card_verify/.test(input.templateId);
  await prisma.job.create({
    data: {
      kind: "catalog_email",
      status: input.status,
      lastError: input.error?.slice(0, 180) || null,
      payload: {
        to: input.to,
        subject: sensitive ? "Account security email" : input.subject.slice(0, 180),
        templateKey: input.templateId,
      },
    },
  });
}

export async function catalogCollabMessage(input: {
  kind: string;
  role: "business" | "influencer" | "admin";
  to: string;
  vars: Record<string, string>;
}) {
  const templateId = catalogTemplateForCollab(input.kind, input.role);
  if (!templateId) return null;
  const template = emailCatalogTemplate(templateId);
  if (!template) return null;
  if (!(await emailCategoryEnabled(template.group))) return null;
  if (await emailTemplatePause(templateId)) return { paused: true as const };
  const preference = await emailPreference(input.to);
  if (!preferenceAllows(template, preference)) return { skipped: true as const };
  try {
    const rendered = await renderLiveCatalog(templateId, input.vars);
    return { paused: false as const, skipped: false as const, templateId, ...rendered };
  } catch {
    return null;
  }
}

export function collabCatalogVars(input: {
  business?: string;
  influencer?: string;
  title?: string;
  milestone?: string;
  detail?: string;
  fundingId?: string;
  amounts?: { expected?: string; observed?: string; payout?: string; returned?: string };
}) {
  const links = liveMailLinks();
  const title = input.title?.trim() || "your collaboration";
  const milestone = input.milestone?.trim() || "the milestone";
  const path = input.fundingId ? `/payments` : "/account";
  return {
    first_name: "",
    collaboration_name: title,
    milestone_name: milestone,
    business_name: input.business?.trim() || "the business",
    influencer_name: input.influencer?.trim() || "the Influencer",
    action_url: `${links.origin}${path}`,
    public_reference: input.detail?.slice(0, 120) || "—",
    case_reference: input.fundingId || "—",
    case_owner: "Finance",
    provider_name: "the payment provider",
    expected_amount: input.amounts?.expected || "—",
    observed_amount: input.amounts?.observed || "—",
    payout_net: input.amounts?.payout || "—",
    returned_amount: input.amounts?.returned || "—",
    created_at: chicago(new Date()),
    requested_at: chicago(new Date()),
    returned_at: chicago(new Date()),
    masked_destination: "payout account on file",
    safe_failure_summary: input.detail?.slice(0, 180) || "—",
    resolution_summary: input.detail?.slice(0, 180) || "—",
  };
}

export async function sendWelcome(user: { email: string; name: string; role: string }) {
  const links = liveMailLinks();
  const first = user.name.trim().split(/\s+/)[0] || "";
  const templateId = user.role === "BUSINESS" ? "account.welcome_business" : "account.welcome_influencer";
  return deliverCatalogEmail({
    templateId,
    to: user.email,
    vars: { first_name: first, action_url: `${links.origin}${user.role === "BUSINESS" ? "/collaboration" : "/creator"}` },
  });
}

export async function sendPayoutReady(input: { email: string; countryName: string }) {
  const links = liveMailLinks();
  return deliverCatalogEmail({
    templateId: "payout.ready",
    to: input.email,
    vars: { country_name: input.countryName || "your country", action_url: `${links.origin}/account` },
  });
}

export async function sendBillingNotice(input: {
  email: string;
  templateId: "billing.paid" | "billing.failed" | "billing.ended" | "billing.cancel_scheduled";
  planName: string;
}) {
  const links = liveMailLinks();
  return deliverCatalogEmail({
    templateId: input.templateId,
    to: input.email,
    vars: {
      plan_name: input.planName || "Influrios",
      invoice_number: "—",
      invoice_paid: "—",
      invoice_due: "—",
      billing_period: "current period",
      billing_next_step: "Open Billing and update the payment method.",
      subscription_access_text: "Open Billing to see whether access is still available.",
      current_plan_text: "Open your account to see the current plan.",
      plan_end_at: "—",
      action_url: `${links.origin}/account`,
      failure_reason: "The subscription payment did not complete.",
      next_attempt_date: "—",
      period_end: "—",
    },
  });
}

export { chicago };
