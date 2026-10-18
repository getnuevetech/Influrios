import { redirect } from "next/navigation";
import { getAccountSession, homePathForRole, type AccountSession } from "@/lib/accounts";
import { prisma } from "@/lib/db";

export type AccountAudience = "creator" | "business";

/** Business / agency roles only. Creators and admins never resolve as business chrome. */
export function isBusinessRole(role: string | null | undefined): boolean {
  return role === "BUSINESS" || role === "AGENCY";
}

/** Influencer / creator role (default membership). */
export function isCreatorRole(role: string | null | undefined): boolean {
  return role === "CREATOR";
}

/**
 * Source of truth for MemberFrame chrome and shared account shells.
 * Role wins — never infer business from a missing creator profile / claim draft.
 */
export function accountAudienceFromRole(role: string | null | undefined): AccountAudience {
  return isBusinessRole(role) ? "business" : "creator";
}

export function accountAudience(account: Pick<AccountSession, "role"> | null | undefined): AccountAudience {
  return accountAudienceFromRole(account?.role);
}

/** Signed-in business or agency only. Creators are bounced to the influencer home. */
export async function requireBusinessSession(nextPath = "/business/home"): Promise<AccountSession> {
  const account = await getAccountSession().catch(() => null);
  if (!account) redirect(`/login?next=${encodeURIComponent(nextPath)}`);
  if (!isBusinessRole(account.role)) {
    redirect(homePathForRole(account.role));
  }
  return account;
}

/** Signed-in creator / influencer only. Business and agency are bounced to the business home. */
export async function requireCreatorSession(nextPath = "/creator"): Promise<AccountSession> {
  const account = await getAccountSession().catch(() => null);
  if (!account) redirect(`/login?next=${encodeURIComponent(nextPath)}`);
  if (isBusinessRole(account.role)) {
    redirect(homePathForRole(account.role));
  }
  return account;
}

/**
 * Restore CREATOR when an influencer was accidentally promoted to BUSINESS/AGENCY
 * (empty company shell + linked Creator profile, no published business requests).
 */
export async function repairMistakenBusinessRole(userId: string): Promise<"CREATOR" | null> {
  const uid = userId.trim();
  if (!uid) return null;
  const user = await prisma.user.findUnique({
    where: { id: uid },
    select: {
      role: true,
      creator: { select: { id: true } },
      business: { select: { industry: true } },
      businessWorkspace: { select: { id: true, industry: true } },
    },
  });
  if (!user || !isBusinessRole(user.role) || !user.creator) return null;
  const industry = (user.businessWorkspace?.industry || user.business?.industry || "").trim();
  if (industry) return null;
  if (user.businessWorkspace?.id) {
    const requests = await prisma.marketplaceBusinessRequest.count({
      where: { workspaceId: user.businessWorkspace.id },
    });
    if (requests > 0) return null;
  }
  await prisma.user.update({ where: { id: uid }, data: { role: "CREATOR" } });
  return "CREATOR";
}
