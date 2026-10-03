import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const row = await prisma.cmsSection.findUnique({ where: { key: "collaboration" } });
  const payload = (row?.payload ?? {}) as Record<string, unknown>;
  const matches = Array.isArray(payload.matches) ? payload.matches : null;
  if (matches) {
    payload.matches = matches.map((item) => {
      const match = item as Record<string, unknown>;
      return {
        ...match,
        title: String(match.title ?? "").replace(/\bCreator\b/g, "Influencer"),
      };
    });
    payload.subtitle = String(payload.subtitle ?? "")
      .replace(/\bcreators\b/g, "influencers")
      .replace(/\bCreators\b/g, "Influencers");
    await prisma.cmsSection.update({
      where: { key: "collaboration" },
      data: { payload },
    });
    console.log(
      "cms matches",
      (payload.matches as { title: string }[]).map((m) => m.title),
    );
  } else {
    console.log("no matches payload", Object.keys(payload));
  }

  const creators = await prisma.creator.findMany({ select: { id: true, slug: true, title: true } });
  for (const creator of creators) {
    if (!creator.title) continue;
    const next = creator.title
      .replace(/\bCreator\b/g, "Influencer")
      .replace(/\bcreators\b/g, "influencers");
    if (next !== creator.title) {
      await prisma.creator.update({ where: { id: creator.id }, data: { title: next } });
      console.log(creator.slug, creator.title, "->", next);
    }
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
