import { prisma } from "@/lib/db";
import { getDirectoryCreator } from "@/lib/directory";
import { newQrToken } from "@/lib/claim-persist";

/** Resolve an opaque QR token. Falls back to a creator slug for cards minted before tokens existed. */
export async function resolveQrPath(token: string): Promise<string | null> {
  try {
    const card = await prisma.influenceCard.findUnique({
      where: { qrToken: token },
      include: { creator: true },
    });
    if (card?.published && card.creator.profileState !== "RESTRICTED") {
      void prisma.analyticsEvent
        .create({
          data: {
            eventType: "qr_scan",
            creatorId: card.creatorId,
            cardId: card.id,
            metaJson: { token },
          },
        })
        .catch(() => undefined);
      return `/c/${card.creator.slug}`;
    }
    const redirect = await prisma.qrRedirect.findUnique({ where: { token } });
    if (redirect?.active) {
      void prisma.analyticsEvent
        .create({ data: { eventType: "qr_scan", metaJson: { token } } })
        .catch(() => undefined);
      return redirect.targetUrl.startsWith("/") ? redirect.targetUrl : `/c/${redirect.targetUrl}`;
    }
  } catch {
    /* database unavailable — slug fallback below */
  }

  const creator = await getDirectoryCreator(token);
  return creator ? `/c/${creator.slug}` : null;
}

/** Dynamic QR encodes /q/{opaque}. Existing cards receive a token the first time one is rendered. */
export async function dynamicQrTokenForSlug(slug: string): Promise<string> {
  try {
    const card = await prisma.influenceCard.findUnique({ where: { slug } });
    if (!card) return slug;
    if (card.qrToken) return card.qrToken;
    const token = newQrToken();
    await prisma.influenceCard.update({ where: { id: card.id }, data: { qrToken: token } });
    await prisma.qrRedirect.upsert({
      where: { token },
      create: { token, targetUrl: `/c/${slug}`, creatorId: card.creatorId, active: true },
      update: {},
    });
    return token;
  } catch {
    return slug;
  }
}
