import { PrismaClient, PlanTier, SocialPlatform } from "@prisma/client";
import { ensureLaunchEntitlements } from "../src/lib/entitlements-db";
import { ensureMarketplaceListings } from "../src/lib/marketplace-listings";
import { SEED_CREATORS, SPECIALTY_TAXONOMY } from "../src/lib/seed-data";

const prisma = new PrismaClient();

async function main() {
  await ensureLaunchEntitlements();

  const specialtyIds = new Map<string, string>();

  for (const [index, parent] of SPECIALTY_TAXONOMY.entries()) {
    const created = await prisma.specialty.upsert({
      where: { slug: parent.slug },
      update: { name: parent.name, sortOrder: index },
      create: { slug: parent.slug, name: parent.name, sortOrder: index },
    });
    specialtyIds.set(parent.slug, created.id);

    for (const [childIndex, child] of (parent.children ?? []).entries()) {
      const childRow = await prisma.specialty.upsert({
        where: { slug: child.slug },
        update: { name: child.name, parentId: created.id, sortOrder: childIndex },
        create: {
          slug: child.slug,
          name: child.name,
          parentId: created.id,
          sortOrder: childIndex,
        },
      });
      specialtyIds.set(child.slug, childRow.id);
    }
  }

  for (const creator of SEED_CREATORS) {
    const row = await prisma.creator.upsert({
      where: { slug: creator.slug },
      update: {
        displayName: creator.displayName,
        title: creator.title,
        bio: creator.bio,
        locationCity: creator.locationCity,
        locationCountry: creator.locationCountry,
        languages: creator.languages,
        avatarUrl: creator.image,
        planTier: creator.planTier as PlanTier,
        openToCollab: creator.openToCollab,
      },
      create: {
        slug: creator.slug,
        displayName: creator.displayName,
        title: creator.title,
        bio: creator.bio,
        locationCity: creator.locationCity,
        locationCountry: creator.locationCountry,
        languages: creator.languages,
        avatarUrl: creator.image,
        coverUrl: creator.coverImage,
        planTier: creator.planTier as PlanTier,
        openToCollab: creator.openToCollab,
        claimed: false,
        profileState: "UNCLAIMED",
      },
    });

    await prisma.creatorSpecialty.deleteMany({ where: { creatorId: row.id } });
    for (const [i, slug] of creator.specialties.entries()) {
      const specialtyId = specialtyIds.get(slug);
      if (!specialtyId) continue;
      await prisma.creatorSpecialty.create({
        data: {
          creatorId: row.id,
          specialtyId,
          isPrimary: i === 0,
        },
      });
    }

    await prisma.socialAccount.deleteMany({ where: { creatorId: row.id } });
    for (const social of creator.socials) {
      await prisma.socialAccount.create({
        data: {
          creatorId: row.id,
          platform: social.platform as SocialPlatform,
          handle: social.handle,
          url: social.url,
          followers: social.followers,
        },
      });
    }

    await prisma.influenceCard.upsert({
      where: { creatorId: row.id },
      update: {
        slug: creator.slug,
        shortAlias: creator.planTier === "STARTER" ? null : creator.slug.split("-")[0],
        published: true,
        theme: creator.planTier.toLowerCase(),
      },
      create: {
        creatorId: row.id,
        slug: creator.slug,
        shortAlias: creator.planTier === "STARTER" ? null : creator.slug.split("-")[0],
        published: true,
        theme: creator.planTier.toLowerCase(),
      },
    });

    await prisma.collaborationOffer.deleteMany({ where: { creatorId: row.id } });
    await prisma.collaborationNeed.deleteMany({ where: { creatorId: row.id } });
    if (creator.offer) {
      await prisma.collaborationOffer.create({
        data: { creatorId: row.id, summary: creator.offer },
      });
    }
    if (creator.need) {
      await prisma.collaborationNeed.create({
        data: { creatorId: row.id, summary: creator.need },
      });
    }
  }

  await ensureMarketplaceListings();

  console.log(`Seeded ${SPECIALTY_TAXONOMY.length} specialty trees and ${SEED_CREATORS.length} creators.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    const { prisma: appPrisma } = await import("../src/lib/db");
    await prisma.$disconnect();
    await appPrisma.$disconnect();
  });
