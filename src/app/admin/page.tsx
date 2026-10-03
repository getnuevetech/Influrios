import Link from "next/link";
import { redirect } from "next/navigation";
import {
  canAccessModule,
  getAdminSession,
  type AdminModule,
} from "@/lib/admin-auth";
import { agencyStats, getAgencyStore } from "@/lib/agency";
import { getBillingStore } from "@/lib/billing";
import { stripeBillingMode } from "@/lib/stripe-admin";
import { providerHealth } from "@/lib/provider-health";
import { getCms } from "@/lib/cms";
import { getAllAudienceSnapshots, getNicheTrends } from "@/lib/intelligence";
import { getManagedMatching } from "@/lib/managed-matching";
import {
  isLegacyDemoPaymentsAdminHref,
  legacyDemoPaymentsEnabled,
} from "@/lib/legacy-demo-payments";
import { formatMoney } from "@/lib/money";
import { escrowStats, getProtectedPaymentsStore } from "@/lib/protected-payments";
import { getTrustStore, trustStats } from "@/lib/trust";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";
export const metadata = { title: "Admin" };

const LINKS: {
  href: string;
  title: string;
  blurb: string;
  module: AdminModule;
  meta: (ctx: {
    visibleCards: number;
    bannersEnabled: number;
    optIns: number;
    intros: number;
    snapshots: number;
    rising: number;
    completedCheckouts: number;
    escrowActive: number;
    escrowHeld: string;
    trustOpen: number;
    agencyRoster: number;
    memberAccounts: number;
    stripeMode: "sandbox" | "live" | "demo" | "rejected";
  }) => string;
}[] = [
  {
    href: "/admin/banners",
    title: "Banners",
    blurb: "Hero, sponsored, card promo, and CTA.",
    module: "banners",
    meta: (c) => `${c.bannersEnabled} enabled`,
  },
  {
    href: "/admin/cards",
    title: "Influencer cards",
    blurb: "Width, icon/QR sizing, and per-card feature toggles.",
    module: "cards",
    meta: (c) => `${c.visibleCards} visible`,
  },
  {
    href: "/admin/matching",
    title: "Managed Matching",
    blurb: "Opt-in targeting, intros, and paid-relationship tracking.",
    module: "matching",
    meta: (c) => `${c.optIns} opted in · ${c.intros} intros`,
  },
  {
    href: "/admin/intelligence",
    title: "Intelligence",
    blurb: "Audience snapshots, niche trends, relationship signals.",
    module: "intelligence",
    meta: (c) => `${c.snapshots} snapshots · ${c.rising} rising niches`,
  },
  {
    href: "/admin/billing",
    title: "Billing",
    blurb: "Plan catalog, checkout sessions, Stripe readiness.",
    module: "billing",
    meta: (c) =>
      `${c.completedCheckouts} completed · ${c.stripeMode === "sandbox" ? "Sandbox" : c.stripeMode === "live" ? "Live" : "Demo"} mode`,
  },
  {
    href: "/admin/plans",
    title: "Plan entitlements",
    blurb: "Card limits stored in the database. Changes apply without a deploy.",
    module: "plans",
    meta: () => "Social, specialty, and QR limits",
  },
  {
    href: "/admin/taxonomy",
    title: "Taxonomy",
    blurb: "Enable specialties and add search synonyms.",
    module: "taxonomy",
    meta: () => "Synonyms drive Discover",
  },
  {
    href: "/admin/homepage",
    title: "Homepage",
    blurb: "Section order, category images, collab match cards, menus, and links to banner/card CMS.",
    module: "banners",
    meta: () => "Full homepage CMS hub",
  },
  {
    href: "/admin/collaboration-landing",
    title: "Collaboration landing",
    blurb: "Public /collaboration hero, dual path, features, mentorship, and trust copy.",
    module: "banners",
    meta: () => "CMS landing sections",
  },
  {
    href: "/admin/business-landing",
    title: "Business landing",
    blurb: "Public /business hero, capabilities, plans, and signup form copy.",
    module: "banners",
    meta: () => "CMS landing sections",
  },
  {
    href: "/admin/influencer-identity",
    title: "Influencer identity",
    blurb: "Self-description labels (Content Creator, Blogger, …) separate from the Influencer role.",
    module: "banners",
    meta: () => "Terminology addendum",
  },
  {
    href: "/admin/payments",
    title: "Protected Payments",
    blurb: "Escrow deals, milestone release, and refunds.",
    module: "payments",
    meta: (c) => `${c.escrowActive} active · ${c.escrowHeld} held`,
  },
  {
    href: "/admin/trust",
    title: "Trust & Disputes",
    blurb: "Mediation queue and collab contract briefs.",
    module: "trust",
    meta: (c) => `${c.trustOpen} open cases`,
  },
  {
    href: "/admin/agency",
    title: "Agency",
    blurb: "Talent roster, campaigns, joint portfolios.",
    module: "agency",
    meta: (c) => `${c.agencyRoster} on roster`,
  },
  {
    href: "/admin/value-prop",
    title: "Value proposition",
    blurb: "Homepage pillar section under the hero.",
    module: "banners",
    meta: () => "CMS strip",
  },
  {
    href: "/admin/stats",
    title: "Site stats",
    blurb: "Footer counters and the script tagline. Edit the numbers here.",
    module: "banners",
    meta: () => "50K+ strip",
  },
  {
    href: "/admin/guests",
    title: "Guest gates",
    blurb: "How many profile views and searches a guest gets before sign-in.",
    module: "plans",
    meta: () => "Soft prompt and hard stop",
  },
  {
    href: "/admin/invitations",
    title: "Invitations",
    blurb: "Claim links for directory profiles. Email send stays off until SMTP is configured.",
    module: "invitations",
    meta: () => "Queue, template, do-not-contact",
  },
  {
    href: "/admin/mail",
    title: "Email",
    blurb: "SMTP host and a test of the claim invitation. Sign in again if this page asks for permission.",
    module: "mail",
    meta: () => "Sends only when SMTP accepts",
  },
  {
    href: "/admin/jobs",
    title: "Jobs",
    blurb: "Failed mail and provider jobs, with retry. Sign in again if this page asks for permission.",
    module: "jobs",
    meta: () => "Queue and retry",
  },
  {
    href: "/admin/collaborations",
    title: "Collaborations",
    blurb: "Proposal records, the sending window, and commercial options.",
    module: "collaborations",
    meta: () => "Draft, sent, accepted",
  },
  {
    href: "/admin/ai",
    title: "AI pipelines",
    blurb: "Model providers and the function each pipeline runs. Unassigned functions keep their platform fallback.",
    module: "ai",
    meta: () => "Classify, explain, match, extract",
  },
  {
    href: "/admin/gateways",
    title: "Payment gateways",
    blurb: "Stripe, Flutterwave, and any other gateway, each assigned to countries.",
    module: "gateways",
    meta: () => "Country routes",
  },
  {
    href: "/admin/signing",
    title: "Document signing",
    blurb: "Signing API used after a collaboration is accepted.",
    module: "signing",
    meta: () => "Queued until the provider confirms",
  },
  {
    href: "/admin/social",
    title: "Social networks",
    blurb: "Live follower and like sync. Influencers accept the terms before a network connects.",
    module: "social",
    meta: () => "Terms required",
  },
  {
    href: "/admin/accounts",
    title: "Member accounts",
    blurb: "Registered members, verification, suspension, consent, and password length.",
    module: "accounts",
    meta: (c) => `${c.memberAccounts} accounts`,
  },
  {
    href: "/admin/fees",
    title: "Collaboration fees",
    blurb: "Fee matrix, simulator, immutable snapshots.",
    module: "commerce",
    meta: () => "Phase 12.1",
  },
  {
    href: "/admin/marketplace",
    title: "Marketplace ledger",
    blurb: "Prefund only after the provider confirms. Milestone templates and the escrow term are edited here. Sign in again if this page asks for permission.",
    module: "marketplace",
    meta: () => "Phase 12.3",
  },
  {
    href: "/admin/legal",
    title: "Legal documents",
    blurb: "Publish split terms and policies, and read the acceptance ledger. Sign in again if this page asks for permission.",
    module: "legal",
    meta: () => "Versioned",
  },
  {
    href: "/admin/short-links",
    title: "Short links",
    blurb: "inflr.me domains, reserved names, suspensions, and QR identities. Sign in again if this page asks for permission.",
    module: "shortlinks",
    meta: () => "inflr.me",
  },
  {
    href: "/admin/access",
    title: "Access levels",
    blurb: "Create roles from granular features and assign admin users.",
    module: "access",
    meta: () => "Super Admin tools",
  },
];

export default async function AdminHomePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const session = await getAdminSession();
  if (!session) redirect("/admin/login");

  const params = await searchParams;
  const legacyDemoOn = await legacyDemoPaymentsEnabled().catch(() => false);
  const [cms, matching, billing, payments, trust, agency, memberAccounts, health, stripeMode, snapshotsList, trends] =
    await Promise.all([
      getCms().catch(() => null),
      getManagedMatching().catch(() => null),
      getBillingStore().catch(() => null),
      legacyDemoOn ? getProtectedPaymentsStore().catch(() => null) : Promise.resolve(null),
      legacyDemoOn ? getTrustStore().catch(() => null) : Promise.resolve(null),
      getAgencyStore().catch(() => null),
      prisma.user.count().catch(() => 0),
      providerHealth().catch(() => null),
      stripeBillingMode().catch(() => "demo" as const),
      getAllAudienceSnapshots().catch(() => []),
      getNicheTrends().catch(() => []),
    ]);
  const payStats = payments ? escrowStats(payments) : { active: 0, held: 0 };
  const tStats = trust ? trustStats(trust) : { open: 0, resolved: 0, total: 0, contracts: 0 };
  const aStats = agency ? agencyStats(agency) : { roster: 0, campaigns: 0, live: 0, portfolios: 0, published: 0 };
  const visibleCards = cms?.featuredCards.cards.filter((c) => c.visible).length ?? 0;
  const optIns = matching?.optIns.filter((o) => o.openToManaged).length ?? 0;
  const snapshots = snapshotsList.length;
  const rising = trends.filter((t) => t.signal === "rising").length;
  const completedCheckouts = billing?.sessions.filter((s) => s.status === "completed").length ?? 0;
  const ctx = {
    visibleCards,
    bannersEnabled: cms ? Object.values(cms.banners).filter((b) => b.enabled).length : 0,
    optIns,
    intros: matching?.intros.length ?? 0,
    snapshots,
    rising,
    completedCheckouts,
    escrowActive: payStats.active,
    escrowHeld: formatMoney(payStats.held),
    trustOpen: tStats.open,
    agencyRoster: aStats.roster,
    memberAccounts,
    stripeMode,
  };

  const visibleLinks = LINKS.filter(
    (l) =>
      (legacyDemoOn || !isLegacyDemoPaymentsAdminHref(l.href)) &&
      canAccessModule(session, l.module),
  );

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-violet">Dashboard</p>
          <h1 className="mt-2 font-display text-3xl font-bold text-indigo">Content & ops controls</h1>
          <p className="mt-2 max-w-2xl text-muted">
            Signed in as <span className="font-semibold text-indigo">{session.name}</span> (
            {session.email}) · <span className="font-semibold text-violet">{session.roleName}</span>
          </p>
          <p className="mt-1 text-xs text-muted">
            {session.permissions.length} feature permission
            {session.permissions.length === 1 ? "" : "s"} on this access level · use the sidebar to
            open modules
          </p>
        </div>
      </div>

      {params.error === "forbidden" ? (
        <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          You don’t have permission for that admin feature. Ask a Super Admin to update your access
          level.
        </div>
      ) : null}

      {health ? (
        <section className="mt-6 grid gap-3 sm:grid-cols-3" aria-label="Provider health">
          {health.map((line) => (
            <div key={line.key} className="rounded-xl border border-[#E4EBFF] bg-white px-4 py-3">
              <p className="text-xs font-bold uppercase tracking-wide text-violet">{line.title}</p>
              <p className="mt-1 text-sm font-semibold text-indigo">{line.label}</p>
              {line.detail ? <p className="mt-1 text-xs text-amber-800">{line.detail}</p> : null}
            </div>
          ))}
        </section>
      ) : null}

      <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {visibleLinks.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="card-surface block p-6 transition hover:-translate-y-0.5 hover:shadow-lg"
          >
            <h2 className="font-display text-xl font-bold text-indigo">{item.title}</h2>
            <p className="mt-2 text-sm text-muted">{item.blurb}</p>
            <p className="mt-4 text-xs font-semibold text-violet">{item.meta(ctx)}</p>
          </Link>
        ))}
      </div>

      {visibleLinks.length === 0 ? (
        <div className="card-surface mt-8 p-8 text-center">
          <p className="font-semibold text-indigo">No admin modules assigned to your role.</p>
          <p className="mt-2 text-sm text-muted">Contact a Super Admin to grant feature access.</p>
        </div>
      ) : null}
    </div>
  );
}
