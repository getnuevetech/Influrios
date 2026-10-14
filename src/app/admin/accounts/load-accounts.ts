import { prisma } from "@/lib/db";
import type { AdminAccountRow } from "@/app/admin/accounts/account-section";
import type { UserRole } from "@prisma/client";

function locationLabel(city?: string | null, state?: string | null, country?: string | null) {
  const parts = [city?.trim(), state?.trim(), country?.trim()].filter(
    (part) => part && part !== "Your city" && part !== "Your state" && part !== "Your country",
  );
  return parts.length ? parts.join(", ") : "Not set";
}

function draftLocation(payload: unknown) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return { city: null as string | null, state: null as string | null, country: null as string | null };
  }
  const record = payload as Record<string, unknown>;
  return {
    city: typeof record.locationCity === "string" ? record.locationCity : null,
    state: typeof record.locationState === "string" ? record.locationState : null,
    country: typeof record.locationCountry === "string" ? record.locationCountry : null,
  };
}

export async function loadAdminAccounts(roles: UserRole[]): Promise<AdminAccountRow[]> {
  const users = await prisma.user
    .findMany({
      where: { role: { in: roles } },
      orderBy: { createdAt: "desc" },
      take: 100,
      include: {
        consents: { orderBy: { acceptedAt: "desc" }, take: 1 },
        creator: {
          select: {
            locationCity: true,
            locationState: true,
            locationCountry: true,
            slug: true,
            displayName: true,
          },
        },
        business: { select: { name: true, geography: true, contactName: true, contactEmail: true, contactPhone: true } },
        onboardingSessions: {
          orderBy: { updatedAt: "desc" },
          take: 1,
          select: { payload: true, draftSlug: true },
        },
      },
    })
    .catch(() => []);

  return users.map((user) => {
    const draft = draftLocation(user.onboardingSessions[0]?.payload);
    const city = user.creator?.locationCity || draft.city;
    const state = user.creator?.locationState || draft.state;
    const country = user.creator?.locationCountry || draft.country;
    const fromCreator = locationLabel(city, state, country);
    const geography = user.business?.geography?.trim();
    const isBusiness = user.role === "BUSINESS" || user.role === "AGENCY";

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      planTier: user.planTier,
      passwordHash: user.passwordHash,
      emailVerifiedAt: user.emailVerifiedAt,
      suspendedAt: user.suspendedAt,
      createdAt: user.createdAt,
      consentVersion: user.consents[0]?.version || null,
      locationLabel: isBusiness
        ? geography || (fromCreator !== "Not set" ? fromCreator : "Not set")
        : fromCreator,
      secondaryLabel: isBusiness
        ? user.business?.name || user.name || null
        : user.creator?.slug
          ? `@${user.creator.slug}`
          : user.creator?.displayName || null,
      contactLabel: isBusiness
        ? [user.business?.contactName, user.business?.contactEmail, user.business?.contactPhone]
            .filter(Boolean)
            .join(" · ") || null
        : null,
    };
  });
}
