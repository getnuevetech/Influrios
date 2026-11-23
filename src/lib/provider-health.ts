import { prisma } from "@/lib/db";
import { getBillingStore } from "@/lib/billing";
import { stripeBillingMode } from "@/lib/stripe-admin";
import { mailReady } from "@/lib/mail";

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
    releaseConfig,
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
    import("@/lib/stripe-release").then((mod) => mod.stripeReleaseConfig()).catch(() => ({ ok: false as const, reason: "" })),
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
  // Stripe collects into the Collaborations balance and pays out to influencers and Operations.
  const collabPaymentsReady = releaseConfig.ok === true;
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
              ? "The Stripe secret is invalid or could not be read. Re-save it on Payment gateways."
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
      title: "Collaboration payments",
      label: collabPaymentsReady
        ? "Ready: Stripe collection and milestone payouts to influencers and Operations."
        : "Not ready: connect Stripe and set the Operations account under Payment settings.",
      detail: [
        paymentRiskCount > 0 ? `${paymentRiskCount} funding(s) at payment risk` : null,
        lastProviderInstruction?.lastError ? `Last payout error: ${lastProviderInstruction.lastError}` : null,
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
