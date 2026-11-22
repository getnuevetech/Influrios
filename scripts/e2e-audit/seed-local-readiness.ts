/**
 * Prepares local dedicated payment/signing readiness fixtures (synthetic only).
 * Run after seed-local-fixtures.ts against influrios_audit.
 */
import { prisma } from "@/lib/db";
import { encryptSecret } from "@/lib/provider-secrets";

async function main() {
  const run = process.env.AUDIT_LOCAL_RUN || "r3mrvlgh";
  await prisma.businessProfile.updateMany({
    where: { name: { contains: run } },
    data: { verifiedCountryCode: "US", geography: "United States" },
  });
  const creators = await prisma.creator.findMany({ where: { slug: { startsWith: `audit-${run}` } } });
  for (const c of creators) {
    await prisma.creator.update({
      where: { id: c.id },
      data: { identityVerified: "VERIFIED", locationCountry: "United States", locationCity: "San Francisco", locationState: "CA" },
    });
    await prisma.creatorKycSubmission.upsert({
      where: { creatorSlug: c.slug },
      create: { creatorSlug: c.slug, creatorId: c.id, countryCode: "US", kycModel: "government_id", status: "verified", detailsJson: { audit: true } },
      update: { creatorId: c.id, countryCode: "US", status: "verified", kycModel: "government_id" },
    });
    await prisma.influencerPayoutProfile.upsert({
      where: { creatorId: c.id },
      create: {
        creatorId: c.id,
        primaryMethod: "local_bank",
        primaryLabel: "Local bank",
        primaryStatus: "VERIFIED",
        primaryCountryCode: "US",
        primaryCurrency: "USD",
        globalPayoutReady: true,
        providerConnectedAccountId: `audit_acct_${c.slug}`,
      },
      update: {
        primaryStatus: "VERIFIED",
        primaryCountryCode: "US",
        primaryCurrency: "USD",
        globalPayoutReady: true,
        providerConnectedAccountId: `audit_acct_${c.slug}`,
      },
    });
  }
  await prisma.countryActivationCorridor.upsert({
    where: { countryCode: "US" },
    create: {
      countryCode: "US",
      active: true,
      currency: "USD",
      collectionProviderCode: "primary",
      payoutMethodsJson: ["local_bank", "usd_bank"],
      kycModel: "government_id",
      notes: "AUDIT local synthetic corridor",
    },
    update: {
      active: true,
      collectionProviderCode: "primary",
      payoutMethodsJson: ["local_bank", "usd_bank"],
      kycModel: "government_id",
    },
  });
  const secret = encryptSecret("audit_local_provider_secret_not_live");
  const webhook = encryptSecret("audit_local_marketplace_webhook_not_secret");
  const primary = await prisma.integrationProvider.findFirst({ where: { kind: "marketplace", code: "primary" } });
  if (primary) {
    await prisma.integrationProvider.update({
      where: { id: primary.id },
      data: { enabled: true, secretCipher: secret, webhookCipher: webhook, name: "Primary (audit local)" },
    });
    await prisma.paymentCountryRoute.upsert({
      where: { countryCode: "US" },
      create: { countryCode: "US", providerId: primary.id, active: true },
      update: { providerId: primary.id, active: true },
    });
  }
  // Prefer two 50/50 milestones
  const templates = await prisma.milestoneTemplate.findMany({ orderBy: { sortOrder: "asc" } });
  if (templates.length >= 2) {
    await prisma.milestoneTemplate.update({ where: { id: templates[0]!.id }, data: { active: true, shareBps: 5000, title: "Kickoff" } });
    await prisma.milestoneTemplate.update({ where: { id: templates[templates.length - 1]!.id }, data: { active: true, shareBps: 5000, title: "Final delivery" } });
    for (const mid of templates.slice(1, -1)) {
      await prisma.milestoneTemplate.update({ where: { id: mid.id }, data: { active: false } });
    }
  }
  console.log(JSON.stringify({ ok: true, creators: creators.length, primary: Boolean(primary) }));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => prisma.$disconnect());
