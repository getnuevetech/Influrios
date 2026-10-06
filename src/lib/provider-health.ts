import { prisma } from "@/lib/db";
import { getBillingStore } from "@/lib/billing";
import { marketplaceWebhookSecret } from "@/lib/marketplace-ledger";
import { stripeBillingMode } from "@/lib/stripe-admin";
import { mailReady } from "@/lib/mail";
import { productSwitch } from "@/lib/product-switches";

export type HealthLine = { key: string; title: string; label: string; detail?: string };

/** Admin-only status. A disabled AI provider does not take profiles down. */
export async function providerHealth(): Promise<HealthLine[]> {
  const [
    mail,
    lastWebhook,
    lastAi,
    lastProviderInstruction,
    billing,
    stripeMode,
    marketplace,
    collabOs,
    shortDomain,
    paymentRiskCount,
  ] = await Promise.all([
    mailReady().catch(() => false),
    prisma.job
      .findFirst({ where: { kind: "provider_webhook", status: "failed" }, orderBy: { createdAt: "desc" } })
      .catch(() => null),
    prisma.job
      .findFirst({ where: { kind: "ai_provider", status: "failed" }, orderBy: { createdAt: "desc" } })
      .catch(() => null),
    prisma.job
      .findFirst({
        where: { kind: "provider_instruction", status: "failed" },
        orderBy: { createdAt: "desc" },
      })
      .catch(() => null),
    getBillingStore().catch(() => null),
    stripeBillingMode().catch(() => "demo" as const),
    marketplaceWebhookSecret("primary").catch(() => ({ error: "not_ready" as const })),
    productSwitch("collab_os_v1").catch(() => true),
    prisma.shortLinkDomain
      .findFirst({ where: { isPrimary: true }, select: { hostname: true, verified: true, active: true } })
      .catch(() => null),
    prisma.collaborationFunding.count({ where: { status: "payment_risk" } }).catch(() => 0),
  ]);
  const paymentDetail = lastWebhook?.lastError
    ? lastWebhook.lastError
    : billing?.lastWebhookAt
      ? `Last webhook ${billing.lastWebhookAt}`
      : undefined;
  const marketplaceReady = !("error" in marketplace);
  const shortLabel = !shortDomain
    ? "No primary short-link domain configured."
    : shortDomain.verified && shortDomain.active
      ? `Primary ${shortDomain.hostname} verified and active.`
      : `Primary ${shortDomain.hostname} needs ops verification${shortDomain.active ? "" : " (inactive)"}.`;
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
              : "Stripe secret is not set. Checkout stays closed until a key is saved.",
      detail: paymentDetail,
    },
    {
      key: "email",
      title: "Email",
      label: mail ? "SMTP ready" : "SMTP is not configured. Nothing is sent.",
    },
    {
      key: "marketplace",
      title: "Marketplace webhook",
      label: marketplaceReady
        ? "Primary marketplace provider has a webhook secret."
        : "Primary marketplace provider is not ready for signed webhooks.",
      detail: [
        `collab_os_v1 is ${collabOs ? "on" : "off"}`,
        paymentRiskCount > 0 ? `${paymentRiskCount} payment-risk funding(s)` : null,
        lastProviderInstruction?.lastError
          ? `Last provider instruction error: ${lastProviderInstruction.lastError}`
          : null,
      ]
        .filter(Boolean)
        .join(" · "),
    },
    {
      key: "shortlinks",
      title: "INFLR.me domain",
      label: shortLabel,
    },
    {
      key: "ai",
      title: "AI",
      label: "Profiles and published match explanations stay up on the keyword fallback.",
      detail: lastAi?.lastError ? `Last provider error: ${lastAi.lastError}` : undefined,
    },
  ];
}
