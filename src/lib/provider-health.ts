import { prisma } from "@/lib/db";
import { getBillingStore, isStripeConfigured } from "@/lib/billing";
import { mailReady } from "@/lib/mail";

export type HealthLine = { key: string; title: string; label: string; detail?: string };

/** Admin-only status. A disabled AI provider does not take profiles down. */
export async function providerHealth(): Promise<HealthLine[]> {
  const [mail, lastWebhook, lastAi, billing] = await Promise.all([
    mailReady().catch(() => false),
    prisma.job.findFirst({ where: { kind: "provider_webhook", status: "failed" }, orderBy: { createdAt: "desc" } }).catch(() => null),
    prisma.job.findFirst({ where: { kind: "ai_provider", status: "failed" }, orderBy: { createdAt: "desc" } }).catch(() => null),
    getBillingStore().catch(() => null),
  ]);
  const stripe = isStripeConfigured();
  const paymentDetail = lastWebhook?.lastError
    ? lastWebhook.lastError
    : billing?.lastWebhookAt
      ? `Last webhook ${billing.lastWebhookAt}`
      : undefined;
  return [
    {
      key: "payment",
      title: "Payments",
      label: stripe ? "Stripe secret is set" : "Stripe secret is not set. Demo checkout still completes locally.",
      detail: paymentDetail,
    },
    {
      key: "email",
      title: "Email",
      label: mail ? "SMTP ready" : "SMTP is not configured. Nothing is sent.",
    },
    {
      key: "ai",
      title: "AI",
      label: "Profiles and published match explanations stay up on the keyword fallback.",
      detail: lastAi?.lastError ? `Last provider error: ${lastAi.lastError}` : undefined,
    },
  ];
}
