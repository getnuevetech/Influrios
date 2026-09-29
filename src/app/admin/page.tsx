import Link from "next/link";
import { getBillingStore, isStripeConfigured } from "@/lib/billing";
import { getCms } from "@/lib/cms";
import { getAllAudienceSnapshots, getNicheTrends } from "@/lib/intelligence";
import { getManagedMatching } from "@/lib/managed-matching";

export const metadata = { title: "Admin" };

export default async function AdminHomePage() {
  const cms = await getCms();
  const matching = await getManagedMatching();
  const billing = await getBillingStore();
  const visibleCards = cms.featuredCards.cards.filter((c) => c.visible).length;
  const optIns = matching.optIns.filter((o) => o.openToManaged).length;
  const snapshots = getAllAudienceSnapshots().length;
  const rising = getNicheTrends().filter((t) => t.signal === "rising").length;
  const completedCheckouts = billing.sessions.filter((s) => s.status === "completed").length;

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <p className="text-xs font-bold uppercase tracking-[0.2em] text-violet">Influrios Admin</p>
      <h1 className="mt-2 font-display text-3xl font-bold text-indigo">Content & ops controls</h1>
      <p className="mt-2 max-w-2xl text-muted">
        Manage landing banners, influencer cards, matching, intelligence, and Phase 6 billing.
      </p>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Link
          href="/admin/banners"
          className="card-surface block p-6 transition hover:-translate-y-0.5 hover:shadow-lg"
        >
          <h2 className="font-display text-xl font-bold text-indigo">Banners</h2>
          <p className="mt-2 text-sm text-muted">
            Hero, sponsored, card promo, and CTA. Upload multiple images per banner.
          </p>
          <p className="mt-4 text-xs font-semibold text-violet">
            {Object.values(cms.banners).filter((b) => b.enabled).length} enabled
          </p>
        </Link>
        <Link
          href="/admin/cards"
          className="card-surface block p-6 transition hover:-translate-y-0.5 hover:shadow-lg"
        >
          <h2 className="font-display text-xl font-bold text-indigo">Influencer cards</h2>
          <p className="mt-2 text-sm text-muted">
            Width, icon/QR sizing, and per-card feature toggles.
          </p>
          <p className="mt-4 text-xs font-semibold text-violet">{visibleCards} visible</p>
        </Link>
        <Link
          href="/admin/matching"
          className="card-surface block p-6 transition hover:-translate-y-0.5 hover:shadow-lg"
        >
          <h2 className="font-display text-xl font-bold text-indigo">Managed Matching</h2>
          <p className="mt-2 text-sm text-muted">
            Phase 4 — opt-in targeting, intros, and paid-relationship tracking.
          </p>
          <p className="mt-4 text-xs font-semibold text-violet">
            {optIns} opted in · {matching.intros.length} intros
          </p>
        </Link>
        <Link
          href="/admin/intelligence"
          className="card-surface block p-6 transition hover:-translate-y-0.5 hover:shadow-lg"
        >
          <h2 className="font-display text-xl font-bold text-indigo">Intelligence</h2>
          <p className="mt-2 text-sm text-muted">
            Phase 5 — audience snapshots, niche trends, relationship signals, exports.
          </p>
          <p className="mt-4 text-xs font-semibold text-violet">
            {snapshots} snapshots · {rising} rising niches
          </p>
        </Link>
        <Link
          href="/admin/billing"
          className="card-surface block p-6 transition hover:-translate-y-0.5 hover:shadow-lg"
        >
          <h2 className="font-display text-xl font-bold text-indigo">Billing</h2>
          <p className="mt-2 text-sm text-muted">
            Phase 6 — plan catalog, checkout sessions, Stripe webhook readiness.
          </p>
          <p className="mt-4 text-xs font-semibold text-violet">
            {completedCheckouts} completed · {isStripeConfigured() ? "Stripe" : "Demo"} mode
          </p>
        </Link>
      </div>

      <Link href="/" className="mt-8 inline-block text-sm font-semibold text-violet hover:underline">
        ← Back to site
      </Link>
    </div>
  );
}
