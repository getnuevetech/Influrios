/**
 * Admin User Accounts — list/detail data for influencer, business, and all members.
 * Design: docs/design-references/admin/user-accounts.png
 */
import type { UserRole } from "@prisma/client";
import { prisma } from "@/lib/db";

export type AccountsTab = "influencer" | "business" | "all";

export type AccountListFilters = {
  tab: AccountsTab;
  q?: string;
  status?: "active" | "suspended" | "all";
  plan?: string;
  kyc?: "verified" | "pending" | "unverified" | "rejected" | "all";
  page?: number;
  pageSize?: number;
  selectedId?: string;
  /** Exact user id lookup (detail panel when row is off-page). */
  ids?: string[];
};

export type AccountKpis = {
  total: number;
  totalTrendPct: number | null;
  influencers: number;
  influencersTrendPct: number | null;
  businesses: number;
  businessesTrendPct: number | null;
  verifiedKyc: number;
  verifiedPct: number | null;
  pendingReview: number;
};

export type AccountTableRow = {
  id: string;
  email: string;
  name: string | null;
  displayName: string;
  handle: string | null;
  role: string;
  planTier: string;
  passwordHash: string | null;
  emailVerifiedAt: string | null;
  suspendedAt: string | null;
  createdAt: string;
  updatedAt: string;
  consentVersion: string | null;
  locationLabel: string;
  secondaryLabel: string | null;
  contactLabel: string | null;
  creatorSlug: string | null;
  identityVerified: string | null;
  kycSubmissionStatus: string | null;
  avatarUrl: string | null;
  coverUrl: string | null;
  followers: number;
  engagementRate: string | null;
  collaborations: number;
  earningsYtdCents: number;
  lastActiveLabel: string;
};

export type AccountNote = {
  id: string;
  note: string;
  actor: string;
  at: string;
};

export type AccountActivity = {
  id: string;
  title: string;
  detail: string;
  at: string;
};

export type AccountDetailExtras = {
  notes: AccountNote[];
  activity: AccountActivity[];
  publicId: string;
};

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

function relativeTime(at: Date) {
  const ms = Date.now() - at.getTime();
  const min = Math.round(ms / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min} min ago`;
  const hr = Math.round(min / 60);
  if (hr < 48) return `${hr} hr ago`;
  const day = Math.round(hr / 24);
  if (day < 30) return `${day}d ago`;
  return at.toISOString().slice(0, 10);
}

function pctChange(current: number, previous: number): number | null {
  if (previous <= 0 && current <= 0) return null;
  if (previous <= 0) return 100;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

function daysAgo(n: number) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  return d;
}

function rolesForTab(tab: AccountsTab): UserRole[] {
  if (tab === "influencer") return ["CREATOR"];
  if (tab === "business") return ["BUSINESS", "AGENCY"];
  return ["CREATOR", "BUSINESS", "AGENCY"];
}

function publicAccountId(role: string, id: string) {
  const prefix = role === "CREATOR" ? "INF" : role === "AGENCY" ? "AGY" : "BIZ";
  const short = id.replace(/[^a-zA-Z0-9]/g, "").slice(-6).toUpperCase();
  return `${prefix}-${short}`;
}

export function accountsBasePath(tab: AccountsTab) {
  if (tab === "business") return "/admin/business-accounts";
  return "/admin/accounts";
}

export async function loadAccountKpis(): Promise<AccountKpis> {
  const d30 = daysAgo(30);
  const d60 = daysAgo(60);
  const [
    total,
    total30,
    totalPrev,
    influencers,
    influencers30,
    influencersPrev,
    businesses,
    businesses30,
    businessesPrev,
    verifiedKyc,
    pendingIdentity,
    pendingSubmissions,
  ] = await Promise.all([
    prisma.user.count({ where: { role: { in: ["CREATOR", "BUSINESS", "AGENCY"] } } }).catch(() => 0),
    prisma.user
      .count({ where: { role: { in: ["CREATOR", "BUSINESS", "AGENCY"] }, createdAt: { gte: d30 } } })
      .catch(() => 0),
    prisma.user
      .count({
        where: { role: { in: ["CREATOR", "BUSINESS", "AGENCY"] }, createdAt: { gte: d60, lt: d30 } },
      })
      .catch(() => 0),
    prisma.user.count({ where: { role: "CREATOR" } }).catch(() => 0),
    prisma.user.count({ where: { role: "CREATOR", createdAt: { gte: d30 } } }).catch(() => 0),
    prisma.user.count({ where: { role: "CREATOR", createdAt: { gte: d60, lt: d30 } } }).catch(() => 0),
    prisma.user.count({ where: { role: { in: ["BUSINESS", "AGENCY"] } } }).catch(() => 0),
    prisma.user
      .count({ where: { role: { in: ["BUSINESS", "AGENCY"] }, createdAt: { gte: d30 } } })
      .catch(() => 0),
    prisma.user
      .count({
        where: { role: { in: ["BUSINESS", "AGENCY"] }, createdAt: { gte: d60, lt: d30 } },
      })
      .catch(() => 0),
    prisma.creator.count({ where: { identityVerified: "VERIFIED", userId: { not: null } } }).catch(() => 0),
    prisma.creator.count({ where: { userId: { not: null }, identityVerified: "PENDING" } }).catch(() => 0),
    prisma.creatorKycSubmission
      .count({ where: { status: { in: ["submitted", "pending_gateway"] } } })
      .catch(() => 0),
  ]);

  return {
    total,
    totalTrendPct: pctChange(total30, totalPrev),
    influencers,
    influencersTrendPct: pctChange(influencers30, influencersPrev),
    businesses,
    businessesTrendPct: pctChange(businesses30, businessesPrev),
    verifiedKyc,
    verifiedPct: total > 0 ? Math.round((verifiedKyc / total) * 1000) / 10 : null,
    pendingReview: Math.max(pendingIdentity, pendingSubmissions),
  };
}

export async function loadAccountTable(filters: AccountListFilters): Promise<{
  rows: AccountTableRow[];
  total: number;
  page: number;
  pageSize: number;
}> {
  const roles = rolesForTab(filters.tab);

  const pageSize = Math.min(Math.max(filters.pageSize ?? 8, 1), 50);
  const page = Math.max(filters.page ?? 1, 1);
  const q = filters.q?.trim().slice(0, 120) || "";
  const status = filters.status || "all";
  const plan = filters.plan?.trim() || "";
  const kyc = filters.kyc || "all";

  const where: Record<string, unknown> = { role: { in: roles } };
  if (filters.ids?.length) where.id = { in: filters.ids };
  if (status === "active") where.suspendedAt = null;
  if (status === "suspended") where.suspendedAt = { not: null };
  if (plan) where.planTier = plan;
  if (q) {
    where.OR = [
      { email: { contains: q, mode: "insensitive" } },
      { name: { contains: q, mode: "insensitive" } },
      { id: { contains: q, mode: "insensitive" } },
      { creator: { slug: { contains: q, mode: "insensitive" } } },
      { creator: { displayName: { contains: q, mode: "insensitive" } } },
      { business: { name: { contains: q, mode: "insensitive" } } },
    ];
  }
  if (kyc !== "all" && (filters.tab === "influencer" || filters.tab === "all")) {
    const map: Record<string, string> = {
      verified: "VERIFIED",
      pending: "PENDING",
      unverified: "UNVERIFIED",
      rejected: "REJECTED",
    };
    const identity = map[kyc];
    if (identity) {
      where.creator = { ...(typeof where.creator === "object" ? where.creator : {}), identityVerified: identity };
    }
  }

  const [total, users] = await Promise.all([
    prisma.user.count({ where: where as never }).catch(() => 0),
    prisma.user
      .findMany({
        where: where as never,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          consents: { orderBy: { acceptedAt: "desc" }, take: 1 },
          creator: {
            select: {
              locationCity: true,
              locationState: true,
              locationCountry: true,
              slug: true,
              displayName: true,
              identityVerified: true,
              avatarUrl: true,
              coverUrl: true,
              socialAccounts: { select: { followers: true } },
            },
          },
          business: {
            select: { name: true, geography: true, contactName: true, contactEmail: true, contactPhone: true },
          },
          onboardingSessions: {
            orderBy: { updatedAt: "desc" },
            take: 1,
            select: { payload: true },
          },
        },
      })
      .catch(() => []),
  ]);

  const slugs = users.map((u) => u.creator?.slug).filter((s): s is string => Boolean(s));
  const submissions = slugs.length
    ? await prisma.creatorKycSubmission
        .findMany({
          where: { creatorSlug: { in: slugs } },
          select: { creatorSlug: true, status: true, kycModel: true, updatedAt: true },
          orderBy: { updatedAt: "desc" },
        })
        .catch(() => [])
    : [];
  const latestKyc = new Map<string, { status: string; kycModel: string }>();
  for (const row of submissions) {
    if (latestKyc.has(row.creatorSlug)) continue;
    latestKyc.set(row.creatorSlug, { status: row.status, kycModel: row.kycModel });
  }

  const earningsBySlug = new Map<string, number>();
  const collabBySlug = new Map<string, number>();
  const pageSlugs = users.map((u) => u.creator?.slug).filter((s): s is string => Boolean(s));
  if (pageSlugs.length) {
    const yearStart = new Date(Date.UTC(new Date().getUTCFullYear(), 0, 1));
    const [fundings, collabs] = await Promise.all([
      prisma.collaborationFunding
        .findMany({
          where: {
            creatorSlug: { in: pageSlugs },
            status: { in: ["held", "partially_released", "released", "completed"] },
            createdAt: { gte: yearStart },
          },
          select: { creatorSlug: true, grossCents: true, feeCents: true },
          take: 2000,
        })
        .catch(() => []),
      prisma.collaboration
        .findMany({
          where: {
            status: "accepted",
            OR: [{ initiatorSlug: { in: pageSlugs } }, { recipientSlug: { in: pageSlugs } }],
          },
          select: { initiatorSlug: true, recipientSlug: true },
          take: 2000,
        })
        .catch(() => []),
    ]);
    for (const f of fundings) {
      const net = Math.max(0, f.grossCents - f.feeCents);
      earningsBySlug.set(f.creatorSlug, (earningsBySlug.get(f.creatorSlug) ?? 0) + net);
    }
    for (const c of collabs) {
      if (pageSlugs.includes(c.initiatorSlug)) {
        collabBySlug.set(c.initiatorSlug, (collabBySlug.get(c.initiatorSlug) ?? 0) + 1);
      }
      if (pageSlugs.includes(c.recipientSlug) && c.recipientSlug !== c.initiatorSlug) {
        collabBySlug.set(c.recipientSlug, (collabBySlug.get(c.recipientSlug) ?? 0) + 1);
      }
    }
  }

  const rows: AccountTableRow[] = users.map((user) => {
    const draft = draftLocation(user.onboardingSessions[0]?.payload);
    const city = user.creator?.locationCity || draft.city;
    const state = user.creator?.locationState || draft.state;
    const country = user.creator?.locationCountry || draft.country;
    const fromCreator = locationLabel(city, state, country);
    const geography = user.business?.geography?.trim();
    const isBusiness = user.role === "BUSINESS" || user.role === "AGENCY";
    const followers =
      user.creator?.socialAccounts.reduce((sum, s) => sum + (s.followers ?? 0), 0) ?? 0;
    const kycHit = user.creator?.slug ? latestKyc.get(user.creator.slug) : undefined;
    const handle = user.creator?.slug
      ? `@${user.creator.slug}`
      : isBusiness
        ? user.business?.name || null
        : null;
    const displayName = isBusiness
      ? user.business?.name || user.name || "Unnamed business"
      : user.creator?.displayName || user.name || handle || "Unnamed";

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      displayName,
      handle,
      role: user.role,
      planTier: user.planTier,
      passwordHash: user.passwordHash,
      emailVerifiedAt: user.emailVerifiedAt?.toISOString() ?? null,
      suspendedAt: user.suspendedAt?.toISOString() ?? null,
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
      consentVersion: user.consents[0]?.version || null,
      locationLabel: isBusiness
        ? geography || (fromCreator !== "Not set" ? fromCreator : "Not set")
        : fromCreator,
      secondaryLabel: handle,
      contactLabel: isBusiness
        ? [user.business?.contactName, user.business?.contactEmail, user.business?.contactPhone]
            .filter(Boolean)
            .join(" · ") || null
        : null,
      creatorSlug: user.creator?.slug ?? null,
      identityVerified: user.creator?.identityVerified ?? null,
      kycSubmissionStatus: kycHit
        ? `${kycHit.status} · ${kycHit.kycModel === "government_id" ? "document" : "gateway"}`
        : null,
      avatarUrl: user.creator?.avatarUrl ?? null,
      coverUrl: user.creator?.coverUrl ?? null,
      followers,
      engagementRate: null,
      collaborations: user.creator?.slug ? collabBySlug.get(user.creator.slug) ?? 0 : 0,
      earningsYtdCents: user.creator?.slug ? earningsBySlug.get(user.creator.slug) ?? 0 : 0,
      lastActiveLabel: relativeTime(user.updatedAt),
    };
  });

  return { rows, total, page, pageSize };
}

export async function loadAccountById(userId: string): Promise<AccountTableRow | null> {
  const result = await loadAccountTable({
    tab: "all",
    ids: [userId],
    page: 1,
    pageSize: 1,
  });
  return result.rows[0] || null;
}

export async function loadAccountDetailExtras(userId: string): Promise<AccountDetailExtras> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true },
  });
  const [notes, activity] = await Promise.all([
    prisma.auditLog
      .findMany({
        where: { objectType: "User", objectId: userId, action: "accounts.note" },
        orderBy: { createdAt: "desc" },
        take: 20,
        select: { id: true, actor: true, after: true, createdAt: true },
      })
      .catch(() => []),
    prisma.auditLog
      .findMany({
        where: { objectType: "User", objectId: userId },
        orderBy: { createdAt: "desc" },
        take: 12,
        select: { id: true, action: true, actor: true, after: true, createdAt: true },
      })
      .catch(() => []),
  ]);

  return {
    publicId: user ? publicAccountId(user.role, user.id) : userId,
    notes: notes.map((n) => ({
      id: n.id,
      note:
        n.after && typeof n.after === "object" && n.after !== null && "note" in n.after
          ? String((n.after as { note?: unknown }).note ?? "")
          : "",
      actor: n.actor,
      at: n.createdAt.toISOString(),
    })),
    activity: activity.map((a) => ({
      id: a.id,
      title: a.action.replace(/\./g, " · "),
      detail: a.actor,
      at: a.createdAt.toISOString(),
    })),
  };
}

export type AdminConsoleRow = {
  id: string;
  email: string;
  name: string;
  roleId: string;
  roleName: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
};

export async function loadAdminConsoleRows(): Promise<AdminConsoleRow[]> {
  const { getAdminAuthStore } = await import("@/lib/admin-auth");
  const store = await getAdminAuthStore();
  const roleName = new Map(store.roles.map((r) => [r.id, r.name]));
  return store.users.map((u) => ({
    id: u.id,
    email: u.email,
    name: u.name,
    roleId: u.roleId,
    roleName: roleName.get(u.roleId) || "Unknown",
    active: u.active,
    createdAt: u.createdAt,
    updatedAt: u.updatedAt,
  }));
}
