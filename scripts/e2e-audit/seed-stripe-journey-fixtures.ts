/**
 * Seed US jurisdiction, primary marketplace provider, and dual-party awaiting_provider funding
 * for local J13/J15 Stripe journeys. Synthetic @example.com only.
 */
import { readFileSync } from "fs";
import { prisma } from "../../src/lib/db";
import { encryptSecret } from "../../src/lib/provider-secrets";

function loadEnvLocal() {
  try {
    const raw = readFileSync(".env.local", "utf8");
    for (const line of raw.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq <= 0) continue;
      const key = trimmed.slice(0, eq).trim();
      let val = trimmed.slice(eq + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      if (process.env[key] === undefined) process.env[key] = val;
    }
  } catch {
    /* optional */
  }
}

loadEnvLocal();

const MARKETPLACE_WH_SECRET = "audit_local_marketplace_webhook_not_secret";
const PROVIDER_SECRET = "audit_local_provider_secret_not_live";

async function main() {
  const fixtures = JSON.parse(readFileSync("/cursor/stores/self/docs/e2e-audit/local-fixtures.json", "utf8"));
  const biz = await prisma.user.findUnique({ where: { email: fixtures.members.businessA } });
  const inf = await prisma.user.findUnique({ where: { email: fixtures.members.influencerA } });
  if (!biz || !inf) throw new Error("Missing synthetic business/influencer fixtures");
  const creator = await prisma.creator.findFirst({ where: { userId: inf.id } });
  if (!creator) throw new Error("Missing creator for influencer A");
  const workspace = await prisma.businessWorkspace.findFirst({
    where: { ownerUserId: biz.id },
    select: { id: true },
  });

  await prisma.collaborationJurisdiction.upsert({
    where: { code: "US" },
    create: {
      code: "US",
      label: "United States",
      protectedPaymentsEnabled: true,
      legalReviewStatus: "APPROVED",
      providerCode: "primary",
      currency: "USD",
      minorDigits: 2,
    },
    update: {
      protectedPaymentsEnabled: true,
      legalReviewStatus: "APPROVED",
      providerCode: "primary",
    },
  });

  await prisma.collaborationLaunchGate.upsert({
    where: { id: "default" },
    create: {
      id: "default",
      feeSchedulesApproved: true,
      taxTreatmentApproved: true,
      earningRefundPolicyApproved: true,
      providerRouteApproved: true,
      providerTraceReady: true,
    },
    update: {
      feeSchedulesApproved: true,
      taxTreatmentApproved: true,
      earningRefundPolicyApproved: true,
      providerRouteApproved: true,
      providerTraceReady: true,
    },
  });

  const primary = await prisma.integrationProvider.upsert({
    where: { kind_code: { kind: "marketplace", code: "primary" } },
    create: {
      kind: "marketplace",
      code: "primary",
      name: "Primary (audit local)",
      enabled: true,
      secretCipher: encryptSecret(PROVIDER_SECRET),
      webhookCipher: encryptSecret(MARKETPLACE_WH_SECRET),
    },
    update: {
      enabled: true,
      name: "Primary (audit local)",
      secretCipher: encryptSecret(PROVIDER_SECRET),
      webhookCipher: encryptSecret(MARKETPLACE_WH_SECRET),
    },
  });

  await prisma.paymentCountryRoute.upsert({
    where: { countryCode: "US" },
    create: { countryCode: "US", providerId: primary.id, active: true },
    update: { providerId: primary.id, active: true },
  });

  const grossCents = 5000;
  const feeSnapshot = {
    feeType: "",
    feeCents: 0,
    explanation: "AUDIT local J13 fee snapshot",
    capturedAt: new Date().toISOString(),
    financialPlan: {
      currency: "USD",
      milestoneCount: 1,
      signedQuote: {
        businessPaysCents: grossCents,
        influencerReceivesCents: 4500,
        businessPlatformFeeCents: 500,
        influencerPlatformFeeCents: 0,
        businessTaxCents: 0,
        influencerTaxCents: 0,
      },
    },
  };

  const funding = await prisma.collaborationFunding.create({
    data: {
      jurisdictionCode: "US",
      businessName: biz.name || "AUDIT Business A",
      creatorSlug: creator.slug,
      title: "AUDIT J13 Stripe funding",
      currency: "USD",
      grossCents,
      feeCents: 0,
      feeSnapshotJson: feeSnapshot,
      serviceLevel: "managed_campaign",
      status: "awaiting_provider",
      providerCode: "primary",
      fundingMode: "FULL",
      scheduleKind: "once",
      trancheIndex: 1,
      trancheCount: 1,
      workspaceId: workspace?.id,
      milestones: {
        create: {
          title: "AUDIT Kickoff",
          amountCents: grossCents,
          sortOrder: 0,
          status: "pending",
          reviewWindowHours: 72,
          revisionLimit: 2,
        },
      },
    },
    include: { milestones: true },
  });

  console.log(
    JSON.stringify({
      ok: true,
      fundingId: funding.id,
      milestoneId: funding.milestones[0]?.id,
      grossCents,
      businessEmail: biz.email,
      influencerEmail: inf.email,
      creatorSlug: creator.slug,
      workspaceId: workspace?.id ?? null,
      marketplaceWebhookSecretName: "audit_local_marketplace_webhook_not_secret",
    }),
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => prisma.$disconnect());
