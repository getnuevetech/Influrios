/**
 * Platform Overview metrics for the admin dashboard (design: platform-overview).
 * Period deltas use the last 30 days vs the prior 30 days when counts exist.
 */
import { prisma } from "@/lib/db";
import { providerHealth, type HealthLine } from "@/lib/provider-health";
import { specialtyLabel } from "@/lib/seed-data";

export type Trend = { pct: number | null; up: boolean | null };

export type KpiCard = {
  key: string;
  label: string;
  value: string;
  href: string;
  tone: "violet" | "blue" | "green" | "amber" | "rose";
  trend: Trend;
  spark: number[];
};

export type MonthPoint = { key: string; label: string; influencers: number; businesses: number; collaborations: number };

export type ActivityItem = {
  id: string;
  title: string;
  detail: string;
  at: Date;
  kind: "signup" | "verify" | "payment" | "kyc" | "contract" | "other";
};

export type CategorySlice = { label: string; count: number; pct: number };

export type CorridorRow = {
  code: string;
  count: number;
  trend: Trend;
};

export type AdminDashboardData = {
  sessionName: string;
  sessionEmail: string;
  sessionRole: string;
  rangeLabel: string;
  kpis: KpiCard[];
  growth: MonthPoint[];
  growthTotal: number;
  growthTrend: Trend;
  collabVolume: { label: string; value: number }[];
  collabTotal: number;
  collabTrend: Trend;
  health: { key: string; title: string; operational: boolean; detail: string }[];
  activity: ActivityItem[];
  categories: CategorySlice[];
  corridors: CorridorRow[];
  upcomingPayoutsCents: number;
  upcomingPayoutCount: number;
  pendingInvitations: number;
  invitationTrend: Trend;
};

function monthKey(d: Date) {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(key: string) {
  const [y, m] = key.split("-").map(Number);
  const d = new Date(Date.UTC(y!, (m ?? 1) - 1, 1));
  return d.toLocaleString("en-US", { month: "short", timeZone: "UTC" });
}

function lastNMonthKeys(n: number, now = new Date()): string[] {
  const keys: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    keys.push(monthKey(d));
  }
  return keys;
}

function pctChange(current: number, previous: number): Trend {
  if (previous <= 0 && current <= 0) return { pct: null, up: null };
  if (previous <= 0) return { pct: 100, up: true };
  const pct = ((current - previous) / previous) * 100;
  return { pct: Math.round(pct * 10) / 10, up: pct >= 0 };
}

function formatInt(n: number) {
  return new Intl.NumberFormat("en-US").format(n);
}

function formatMoney(cents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

function daysAgo(n: number) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  return d;
}

async function countUsers(role: "CREATOR" | "BUSINESS_LIKE", since?: Date, until?: Date) {
  const createdAt =
    since || until
      ? {
          ...(since ? { gte: since } : {}),
          ...(until ? { lt: until } : {}),
        }
      : undefined;
  if (role === "CREATOR") {
    return prisma.user.count({ where: { role: "CREATOR", ...(createdAt ? { createdAt } : {}) } });
  }
  return prisma.user.count({
    where: { role: { in: ["BUSINESS", "AGENCY"] }, ...(createdAt ? { createdAt } : {}) },
  });
}

function healthOperational(line: HealthLine): boolean {
  const label = line.label.toLowerCase();
  if (line.key === "payment") {
    return label.includes("sandbox") || label.includes("live secret");
  }
  if (line.key === "email") return label.includes("smtp ready");
  if (line.key === "marketplace") return label.includes("webhook secret");
  if (line.key === "shortlinks") return label.includes("verified and active");
  if (line.key === "ai") return !line.detail;
  return !line.detail;
}

function healthTitle(line: HealthLine): string {
  if (line.key === "payment") return "Payments (Stripe)";
  if (line.key === "email") return "Email (SMTP)";
  if (line.key === "ai") return "AI pipelines";
  if (line.key === "shortlinks") return "Domain & Short links";
  if (line.key === "marketplace") return "Marketplace webhook";
  return line.title;
}

export async function loadAdminDashboard(session: {
  name: string;
  email: string;
  roleName: string;
}): Promise<AdminDashboardData> {
  const now = new Date();
  const d30 = daysAgo(30);
  const d60 = daysAgo(60);
  const monthKeys = lastNMonthKeys(6, now);
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 5, 1));

  const [
    influencers,
    businesses,
    influencers30,
    influencersPrev,
    businesses30,
    businessesPrev,
    activeCollabs,
    collabs30,
    collabsPrev,
    volumeHeld,
    volumeReleased30,
    volumeReleasedPrev,
    kycPending,
    kycPrev,
    disputesOpen,
    disputesPrev,
    recentUsers,
    recentCollabs,
    healthLines,
    specialtyGroups,
    specialties,
    corridorGroups,
    corridorGroupsPrev,
    upcomingMilestones,
    pendingInvites,
    invitesPrev,
    auditRows,
    signingCount,
  ] = await Promise.all([
    countUsers("CREATOR"),
    countUsers("BUSINESS_LIKE"),
    countUsers("CREATOR", d30),
    countUsers("CREATOR", d60, d30),
    countUsers("BUSINESS_LIKE", d30),
    countUsers("BUSINESS_LIKE", d60, d30),
    prisma.collaboration.count({ where: { status: "accepted" } }).catch(() => 0),
    prisma.collaboration.count({ where: { status: "accepted", createdAt: { gte: d30 } } }).catch(() => 0),
    prisma.collaboration
      .count({ where: { status: "accepted", createdAt: { gte: d60, lt: d30 } } })
      .catch(() => 0),
    prisma.collaborationFunding
      .aggregate({
        where: { status: { in: ["held", "partially_released", "released", "completed"] } },
        _sum: { grossCents: true },
      })
      .catch(() => ({ _sum: { grossCents: 0 } })),
    prisma.ledgerEntry
      .aggregate({
        where: { kind: "release", createdAt: { gte: d30 } },
        _sum: { amountCents: true },
      })
      .catch(() => ({ _sum: { amountCents: 0 } })),
    prisma.ledgerEntry
      .aggregate({
        where: { kind: "release", createdAt: { gte: d60, lt: d30 } },
        _sum: { amountCents: true },
      })
      .catch(() => ({ _sum: { amountCents: 0 } })),
    prisma.creatorKycSubmission
      .count({ where: { status: { in: ["submitted", "pending_gateway"] } } })
      .catch(() => 0),
    prisma.creatorKycSubmission
      .count({
        where: {
          status: { in: ["submitted", "pending_gateway"] },
          createdAt: { gte: d60, lt: d30 },
        },
      })
      .catch(() => 0),
    prisma.milestoneDispute
      .count({
        where: {
          status: {
            in: ["open", "under_review", "refund_requested", "escalated_provider", "escalated_legal"],
          },
        },
      })
      .catch(() => 0),
    prisma.milestoneDispute
      .count({
        where: {
          status: {
            in: ["open", "under_review", "refund_requested", "escalated_provider", "escalated_legal"],
          },
          createdAt: { gte: d60, lt: d30 },
        },
      })
      .catch(() => 0),
    prisma.user
      .findMany({
        where: { createdAt: { gte: monthStart }, role: { in: ["CREATOR", "BUSINESS", "AGENCY"] } },
        select: { role: true, createdAt: true },
      })
      .catch(() => []),
    prisma.collaboration
      .findMany({
        where: { createdAt: { gte: monthStart }, status: { in: ["sent", "accepted"] } },
        select: { createdAt: true },
      })
      .catch(() => []),
    providerHealth().catch(() => [] as HealthLine[]),
    prisma.creatorSpecialty
      .groupBy({
        by: ["specialtyId"],
        _count: { _all: true },
        orderBy: { _count: { specialtyId: "desc" } },
        take: 8,
      })
      .catch(() => []),
    prisma.specialty.findMany({ select: { id: true, name: true, slug: true } }).catch(() => []),
    prisma.collaborationFunding
      .groupBy({
        by: ["jurisdictionCode"],
        where: { createdAt: { gte: d30 } },
        _count: { _all: true },
        orderBy: { _count: { jurisdictionCode: "desc" } },
        take: 5,
      })
      .catch(() => []),
    prisma.collaborationFunding
      .groupBy({
        by: ["jurisdictionCode"],
        where: { createdAt: { gte: d60, lt: d30 } },
        _count: { _all: true },
      })
      .catch(() => []),
    prisma.fundingMilestone
      .findMany({
        where: {
          status: { in: ["approved", "release_scheduled", "release_requested"] },
          funding: { status: "held" },
        },
        select: { amountCents: true, refundedCents: true },
        take: 200,
      })
      .catch(() => []),
    prisma.creatorInvitation.count({ where: { status: { in: ["queued", "opened"] } } }).catch(() => 0),
    prisma.creatorInvitation
      .count({ where: { status: { in: ["queued", "opened"] }, createdAt: { gte: d60, lt: d30 } } })
      .catch(() => 0),
    prisma.auditLog
      .findMany({
        orderBy: { createdAt: "desc" },
        take: 8,
        select: { id: true, action: true, actor: true, objectType: true, objectId: true, createdAt: true },
      })
      .catch(() => []),
    prisma.signatureRequest.count({ where: { status: { in: ["sent", "completed"] } } }).catch(() => 0),
  ]);

  const volumeCents = volumeHeld._sum.grossCents ?? 0;
  const volume30 = volumeReleased30._sum.amountCents ?? 0;
  const volumePrev = volumeReleasedPrev._sum.amountCents ?? 0;

  const byMonthInf = new Map<string, number>();
  const byMonthBiz = new Map<string, number>();
  const byMonthCollab = new Map<string, number>();
  for (const key of monthKeys) {
    byMonthInf.set(key, 0);
    byMonthBiz.set(key, 0);
    byMonthCollab.set(key, 0);
  }
  for (const u of recentUsers) {
    const key = monthKey(u.createdAt);
    if (!byMonthInf.has(key)) continue;
    if (u.role === "CREATOR") byMonthInf.set(key, (byMonthInf.get(key) ?? 0) + 1);
    else byMonthBiz.set(key, (byMonthBiz.get(key) ?? 0) + 1);
  }
  for (const c of recentCollabs) {
    const key = monthKey(c.createdAt);
    if (!byMonthCollab.has(key)) continue;
    byMonthCollab.set(key, (byMonthCollab.get(key) ?? 0) + 1);
  }

  const growth: MonthPoint[] = monthKeys.map((key) => ({
    key,
    label: monthLabel(key),
    influencers: byMonthInf.get(key) ?? 0,
    businesses: byMonthBiz.get(key) ?? 0,
    collaborations: byMonthCollab.get(key) ?? 0,
  }));

  const growthTotal = growth.reduce((s, m) => s + m.influencers + m.businesses, 0);
  const growthPrevTotal = influencersPrev + businessesPrev;
  const growthCurrTotal = influencers30 + businesses30;

  const sparkFromMonths = (picker: (m: MonthPoint) => number) => growth.map(picker);

  const kpis: KpiCard[] = [
    {
      key: "influencers",
      label: "Total Influencers",
      value: formatInt(influencers),
      href: "/admin/accounts",
      tone: "violet",
      trend: pctChange(influencers30, influencersPrev),
      spark: sparkFromMonths((m) => m.influencers),
    },
    {
      key: "businesses",
      label: "Total Businesses",
      value: formatInt(businesses),
      href: "/admin/business-accounts",
      tone: "blue",
      trend: pctChange(businesses30, businessesPrev),
      spark: sparkFromMonths((m) => m.businesses),
    },
    {
      key: "collabs",
      label: "Active Collaborations",
      value: formatInt(activeCollabs),
      href: "/admin/collaborations",
      tone: "violet",
      trend: pctChange(collabs30, collabsPrev),
      spark: sparkFromMonths((m) => m.collaborations),
    },
    {
      key: "volume",
      label: "Marketplace Volume",
      value: formatMoney(volumeCents),
      href: "/admin/marketplace",
      tone: "green",
      trend: pctChange(volume30, volumePrev),
      spark: sparkFromMonths((m) => m.collaborations),
    },
    {
      key: "kyc",
      label: "Pending KYC Reviews",
      value: formatInt(kycPending),
      href: "/admin/kyc",
      tone: "amber",
      trend: pctChange(kycPending, kycPrev),
      spark: [kycPrev, kycPending, kycPending],
    },
    {
      key: "disputes",
      label: "Open Dispute Cases",
      value: formatInt(disputesOpen),
      href: "/admin/trust",
      tone: "rose",
      // Lower disputes is an improvement — invert "up" for display color in UI.
      trend: pctChange(disputesOpen, disputesPrev),
      spark: [disputesPrev, disputesOpen, disputesOpen],
    },
  ];

  const specialtyById = new Map(specialties.map((s) => [s.id, s]));
  const totalSpec = specialtyGroups.reduce((s, g) => s + g._count._all, 0) || 1;
  const top = specialtyGroups.slice(0, 4);
  const topCount = top.reduce((s, g) => s + g._count._all, 0);
  const categories: CategorySlice[] = top.map((g) => {
    const spec = specialtyById.get(g.specialtyId);
    const label = spec?.name || specialtyLabel(spec?.slug || "other");
    return {
      label,
      count: g._count._all,
      pct: Math.round((g._count._all / totalSpec) * 1000) / 10,
    };
  });
  if (totalSpec > topCount) {
    categories.push({
      label: "Others",
      count: totalSpec - topCount,
      pct: Math.round(((totalSpec - topCount) / totalSpec) * 1000) / 10,
    });
  }

  const prevCorridor = new Map(
    corridorGroupsPrev.map((g) => [g.jurisdictionCode || "—", g._count._all]),
  );
  const corridors: CorridorRow[] = corridorGroups.map((g) => {
    const code = g.jurisdictionCode || "—";
    const count = g._count._all;
    return { code, count, trend: pctChange(count, prevCorridor.get(code) ?? 0) };
  });

  const upcomingPayoutsCents = upcomingMilestones.reduce(
    (s, m) => s + Math.max(0, m.amountCents - m.refundedCents),
    0,
  );

  const activity: ActivityItem[] = [];
  for (const row of auditRows) {
    const action = row.action.toLowerCase();
    let kind: ActivityItem["kind"] = "other";
    if (action.includes("kyc")) kind = "kyc";
    else if (action.includes("sign") || action.includes("contract")) kind = "contract";
    else if (action.includes("pay") || action.includes("funding") || action.includes("ledger"))
      kind = "payment";
    else if (action.includes("verif")) kind = "verify";
    else if (action.includes("user") || action.includes("invite") || action.includes("signup"))
      kind = "signup";
    activity.push({
      id: row.id,
      title: row.action.replace(/\./g, " · "),
      detail: [row.actor, row.objectType, row.objectId].filter(Boolean).join(" · ") || row.action,
      at: row.createdAt,
      kind,
    });
  }
  if (activity.length < 4) {
    const latestCreators = await prisma.user
      .findMany({
        where: { role: "CREATOR" },
        orderBy: { createdAt: "desc" },
        take: 3,
        select: { id: true, name: true, email: true, createdAt: true },
      })
      .catch(() => []);
    for (const u of latestCreators) {
      activity.push({
        id: `user-${u.id}`,
        title: "New influencer signup",
        detail: `${u.name || u.email} joined Influrios`,
        at: u.createdAt,
        kind: "signup",
      });
    }
  }
  activity.sort((a, b) => b.at.getTime() - a.at.getTime());

  const signingOperational = signingCount >= 0; // channel configured when rows exist or page reachable
  const health = [
    ...healthLines.map((line) => ({
      key: line.key,
      title: healthTitle(line),
      operational: healthOperational(line),
      detail: line.detail || line.label,
    })),
    {
      key: "signing",
      title: "Document signing",
      operational: signingOperational,
      detail: signingCount > 0 ? `${signingCount} envelope(s) on record` : "Signing channel available in admin",
    },
  ];

  return {
    sessionName: session.name,
    sessionEmail: session.email,
    sessionRole: session.roleName,
    rangeLabel: "Last 30 days",
    kpis,
    growth,
    growthTotal,
    growthTrend: pctChange(growthCurrTotal, growthPrevTotal),
    collabVolume: growth.map((m) => ({ label: m.label, value: m.collaborations })),
    collabTotal: activeCollabs,
    collabTrend: pctChange(collabs30, collabsPrev),
    health,
    activity: activity.slice(0, 8),
    categories,
    corridors,
    upcomingPayoutsCents,
    upcomingPayoutCount: upcomingMilestones.length,
    pendingInvitations: pendingInvites,
    invitationTrend: pctChange(pendingInvites, invitesPrev),
  };
}
