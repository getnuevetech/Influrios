import { PrismaClient } from "@prisma/client";
import { ensureLaunchEntitlements } from "../src/lib/entitlements-db";
import { ensureMarketplaceListings } from "../src/lib/marketplace-listings";
import { removeUntouchedDemoBusinessWorkspace } from "../src/lib/business";
import {
  clearStoredDemoCmsMedia,
  clearStoredSeedCmsSamples,
  removeUntouchedSeedCreators,
} from "../src/lib/seed-directory";
import { purgeLegacyDemoJsonFiles } from "../src/lib/legacy-teardown";
import { SPECIALTY_TAXONOMY } from "../src/lib/seed-data";

const prisma = new PrismaClient();

async function main() {
  await ensureLaunchEntitlements();

  for (const [index, parent] of SPECIALTY_TAXONOMY.entries()) {
    const created = await prisma.specialty.upsert({
      where: { slug: parent.slug },
      update: { name: parent.name, sortOrder: index },
      create: { slug: parent.slug, name: parent.name, sortOrder: index },
    });

    for (const [childIndex, child] of (parent.children ?? []).entries()) {
      await prisma.specialty.upsert({
        where: { slug: child.slug },
        update: { name: child.name, parentId: created.id, sortOrder: childIndex },
        create: {
          slug: child.slug,
          name: child.name,
          parentId: created.id,
          sortOrder: childIndex,
        },
      });
    }
  }

  const removedCreators = await removeUntouchedSeedCreators();
  const removedWorkspace = await removeUntouchedDemoBusinessWorkspace();
  const clearedCms = await clearStoredSeedCmsSamples();
  const clearedDemoMedia = await clearStoredDemoCmsMedia();
  const purged = await purgeLegacyDemoJsonFiles();

  // Drop leftover sample brands and opportunities. An empty marketplace stays empty.
  await ensureMarketplaceListings();

  console.log(
    `Seeded ${SPECIALTY_TAXONOMY.length} specialty trees. Removed ${removedCreators} untouched sample creators, ${removedWorkspace} sample workspace, cleared ${clearedCms} sample homepage sections, cleared demo art on ${clearedDemoMedia} sections, and purged ${purged.removed.length} leftover payment demo files.`,
  );
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
