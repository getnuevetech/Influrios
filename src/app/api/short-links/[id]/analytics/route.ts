import { NextRequest, NextResponse } from "next/server";
import { getAccountSession } from "@/lib/accounts";
import { prisma } from "@/lib/db";
import { isPlanCode } from "@/lib/entitlements";
import { entitlementsForPlan } from "@/lib/entitlements-db";
import { getAdminSession } from "@/lib/admin-auth";
import { summarizeShortLinkAnalytics } from "@/lib/short-link-analytics";

export const dynamic = "force-dynamic";

/**
 * Entitlement-aware short-link analytics (INFLR.me Spec §10 / GET /api/short-links/{id}/analytics).
 * Creators only see their own link; admins may read any link.
 */
export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const link = await prisma.shortLink.findUnique({
    where: { id },
    include: { creator: true },
  });
  if (!link) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const admin = await getAdminSession().catch(() => null);
  const account = await getAccountSession().catch(() => null);
  let allowed = Boolean(admin);
  let level: "views" | "standard" | "advanced" = "views";

  if (admin) {
    level = "advanced";
  } else if (account && link.creatorId) {
    const owned = await prisma.creator.findFirst({
      where: { id: link.creatorId, userId: account.id },
    });
    if (owned) {
      allowed = true;
      const plan = isPlanCode(owned.planTier) ? owned.planTier : "STARTER";
      const entitlements = await entitlementsForPlan(plan);
      level = entitlements.analytics;
    }
  }

  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const events = await prisma.shortLinkEvent.findMany({
    where: { shortLinkId: link.id },
    orderBy: { createdAt: "desc" },
    take: 2_000,
    select: { eventType: true, metaJson: true, createdAt: true },
  });

  return NextResponse.json({
    shortLinkId: link.id,
    analytics: summarizeShortLinkAnalytics(events, level),
  });
}
