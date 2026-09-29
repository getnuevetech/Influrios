import Link from "next/link";
import { redirect } from "next/navigation";
import { actionAdminLogout } from "@/app/admin/actions-auth";
import { PageShell } from "@/components/page-shell";
import {
  canAccessModule,
  getAdminSession,
  type AdminModule,
} from "@/lib/admin-auth";
import { agencyStats, getAgencyStore } from "@/lib/agency";
import { getBillingStore, isStripeConfigured } from "@/lib/billing";
import { getCms } from "@/lib/cms";
import { getAllAudienceSnapshots, getNicheTrends } from "@/lib/intelligence";
import { getManagedMatching } from "@/lib/managed-matching";
import { escrowStats, getProtectedPaymentsStore } from "@/lib/protected-payments";
import { getTrustStore, trustStats } from "@/lib/trust";

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
      `${c.completedCheckouts} completed · ${isStripeConfigured() ? "Stripe" : "Demo"} mode`,
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
  const cms = await getCms();
  const matching = await getManagedMatching();
  const billing = await getBillingStore();
  const payments = await getProtectedPaymentsStore();
  const payStats = escrowStats(payments);
  const trust = await getTrustStore();
  const tStats = trustStats(trust);
  const agency = await getAgencyStore();
  const aStats = agencyStats(agency);
  const visibleCards = cms.featuredCards.cards.filter((c) => c.visible).length;
  const optIns = matching.optIns.filter((o) => o.openToManaged).length;
  const snapshots = getAllAudienceSnapshots().length;
  const rising = getNicheTrends().filter((t) => t.signal === "rising").length;
  const completedCheckouts = billing.sessions.filter((s) => s.status === "completed").length;
  const ctx = {
    visibleCards,
    bannersEnabled: Object.values(cms.banners).filter((b) => b.enabled).length,
    optIns,
    intros: matching.intros.length,
    snapshots,
    rising,
    completedCheckouts,
    escrowActive: payStats.active,
    escrowHeld: new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    }).format(payStats.held / 100),
    trustOpen: tStats.open,
    agencyRoster: aStats.roster,
  };

  const visibleLinks = LINKS.filter((l) => canAccessModule(session, l.module));

  return (
    <PageShell className="py-10">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-violet">Influrios Admin</p>
          <h1 className="mt-2 font-display text-3xl font-bold text-indigo">Content & ops controls</h1>
          <p className="mt-2 max-w-2xl text-muted">
            Signed in as <span className="font-semibold text-indigo">{session.name}</span> (
            {session.email}) · <span className="font-semibold text-violet">{session.roleName}</span>
          </p>
          <p className="mt-1 text-xs text-muted">
            {session.permissions.length} feature permission
            {session.permissions.length === 1 ? "" : "s"} on this access level
          </p>
        </div>
        <form action={actionAdminLogout}>
          <button type="submit" className="btn-secondary !py-2 text-sm">
            Sign out
          </button>
        </form>
      </div>

      {params.error === "forbidden" ? (
        <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          You don’t have permission for that admin feature. Ask a Super Admin to update your access
          level.
        </div>
      ) : null}

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
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

      <Link href="/" className="mt-8 inline-block text-sm font-semibold text-violet hover:underline">
        ← Back to site
      </Link>
    </PageShell>
  );
}
