import { prisma } from "@/lib/db";
import { getBillingStore } from "@/lib/billing";
import { stripeBillingMode } from "@/lib/stripe-admin";
import { mailReady } from "@/lib/mail";

export type HealthLine = { key: string; title: string; label: string; detail?: string };

/** Admin-only status. A disabled AI provider does not take profiles down. */
export async function providerHealth(): Promise<HealthLine[]> {
  const [mail, lastWebhook, lastAi, billing, stripeMode] = await Promise.all([
    mailReady().catch(() => false),
    prisma.job.findFirst({ where: { kind: "provider_webhook", status: "failed" }, orderBy: { createdAt: "desc" } }).catch(() => null),
    prisma.job.findFirst({ where: { kind: "ai_provider", status: "failed" }, orderBy: { createdAt: "desc" } }).catch(() => null),
    getBillingStore().catch(() => null),
    stripeBillingMode().catch(() => "demo" as const),
  ]);
  const paymentDetail = lastWebhook?.lastError
    ? lastWebhook.lastError
    : billing?.lastWebhookAt
      ? `Last webhook ${billing.lastWebhookAt}`
      : undefined;
  return [
    {
      key: "payment",
      title: "Payments",
      label:
        stripeMode === "sandbox"
          ? "Stripe sandbox is ready. A plan stays unpaid until Stripe confirms it."
          : stripeMode === "live"
            ? "Stripe live secret is set."
            : stripeMode === "rejected"
              ? "The saved Stripe key is not a sandbox key. Nothing is charged."
              : "Stripe secret is not set. Demo checkout still completes locally.",
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
