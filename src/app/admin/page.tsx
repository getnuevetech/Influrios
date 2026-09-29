import Link from "next/link";
import { getCms } from "@/lib/cms";

export const metadata = { title: "Admin" };

export default async function AdminHomePage() {
  const cms = await getCms();
  const visibleCards = cms.featuredCards.cards.filter((c) => c.visible).length;

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <p className="text-xs font-bold uppercase tracking-[0.2em] text-violet">Influrios Admin</p>
      <h1 className="mt-2 font-display text-3xl font-bold text-indigo">Content & card controls</h1>
      <p className="mt-2 max-w-2xl text-muted">
        Manage landing banners (including multi-image uploads) and per-card influencer card features
        shown on the homepage carousel.
      </p>

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        <Link
          href="/admin/banners"
          className="card-surface block p-6 transition hover:-translate-y-0.5 hover:shadow-lg"
        >
          <h2 className="font-display text-xl font-bold text-indigo">Banners</h2>
          <p className="mt-2 text-sm text-muted">
            Hero, sponsored, card promo, and CTA. Upload multiple images per banner and adjust height.
          </p>
          <p className="mt-4 text-xs font-semibold text-violet">
            {Object.values(cms.banners).filter((b) => b.enabled).length} enabled ·{" "}
            {Object.values(cms.banners).reduce((n, b) => n + b.images.length, 0)} images
          </p>
        </Link>
        <Link
          href="/admin/cards"
          className="card-surface block p-6 transition hover:-translate-y-0.5 hover:shadow-lg"
        >
          <h2 className="font-display text-xl font-bold text-indigo">Influencer cards</h2>
          <p className="mt-2 text-sm text-muted">
            Width, icon/QR sizing, and per-card toggles for badge, socials, counts, QR, and status.
          </p>
          <p className="mt-4 text-xs font-semibold text-violet">
            {visibleCards} visible · width ×{cms.featuredCards.widthScale} · icons{" "}
            {cms.featuredCards.socialIconSize}px
          </p>
        </Link>
      </div>

      <Link href="/" className="mt-8 inline-block text-sm font-semibold text-violet hover:underline">
        ← Back to site
      </Link>
    </div>
  );
}
