import Link from "next/link";
import { actionUpdateCard, actionUpdateFeaturedGlobals } from "@/app/admin/actions";
import { requireAdminPage } from "@/app/admin/guard";
import { hasPermission } from "@/lib/admin-auth";
import { getCms } from "@/lib/cms";
import { getDirectory, indexCreatorsBySlug } from "@/lib/directory";

export const metadata = { title: "Admin · Cards" };

type Props = { searchParams: Promise<{ saved?: string }> };

const FEATURE_KEYS = [
  ["showBadge", "Badge"],
  ["showHeart", "Heart / shortlist"],
  ["showVerified", "Blue verified check"],
  ["showLocation", "Location"],
  ["showSpecialties", "Specialty chips"],
  ["showSocials", "Social icons"],
  ["showFollowerCounts", "Follower counts beside icons"],
  ["showQr", "QR (icon-sized)"],
  ["showStatus", "Status bar"],
] as const;

export default async function AdminCardsPage({ searchParams }: Props) {
  const session = await requireAdminPage("cards");
  const canEdit = hasPermission(session, "cards.edit");
  const params = await searchParams;
  const cms = await getCms();
  const cards = [...cms.featuredCards.cards].sort((a, b) => a.order - b.order);

  const directory = await getDirectory().catch(() => null);
  const bySlug = indexCreatorsBySlug(directory?.creators ?? []);

  return (
    <div className="mx-auto max-w-[90rem] space-y-8 px-4 py-10 sm:px-6">
      <div>
        <Link href="/admin" className="text-sm font-semibold text-violet hover:underline">
          ← Admin
        </Link>
        <h1 className="mt-2 font-display text-3xl font-bold text-indigo">Influencer cards</h1>
        <p className="mt-1 text-sm text-muted">
          {canEdit
            ? "Global sizing for the featured carousel, plus per-card feature toggles."
            : "View-only — your access level can open cards CMS but not change settings."}
        </p>
      </div>

      {params.saved ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          Saved: {params.saved}
        </div>
      ) : null}

      <section className="card-surface p-6">
        <h2 className="font-display text-xl font-bold text-indigo">Carousel globals</h2>
        {canEdit ? (
          <form action={actionUpdateFeaturedGlobals} className="mt-4 grid gap-3 sm:grid-cols-3">
            <label className="text-sm">
              <span className="font-semibold text-indigo">Width scale</span>
              <input
                name="widthScale"
                type="number"
                step="0.05"
                min="0.8"
                max="2"
                defaultValue={cms.featuredCards.widthScale}
                className="mt-1 w-full rounded-xl border border-border px-3 py-2"
              />
              <span className="text-xs text-muted">1.2 = +20% width</span>
            </label>
            <label className="text-sm">
              <span className="font-semibold text-indigo">Social icon size (px)</span>
              <input
                name="socialIconSize"
                type="number"
                min="14"
                max="40"
                defaultValue={cms.featuredCards.socialIconSize}
                className="mt-1 w-full rounded-xl border border-border px-3 py-2"
              />
            </label>
            <label className="text-sm">
              <span className="font-semibold text-indigo">QR size (px)</span>
              <input
                name="qrSize"
                type="number"
                min="14"
                max="64"
                defaultValue={cms.featuredCards.qrSize}
                className="mt-1 w-full rounded-xl border border-border px-3 py-2"
              />
              <span className="text-xs text-muted">Match icon size for template parity</span>
            </label>
            <button type="submit" className="btn-primary sm:col-span-3 !py-2 text-sm">
              Save globals
            </button>
          </form>
        ) : (
          <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-3">
            <div>
              <dt className="font-semibold text-indigo">Width scale</dt>
              <dd className="text-muted">{cms.featuredCards.widthScale}</dd>
            </div>
            <div>
              <dt className="font-semibold text-indigo">Social icon size</dt>
              <dd className="text-muted">{cms.featuredCards.socialIconSize}px</dd>
            </div>
            <div>
              <dt className="font-semibold text-indigo">QR size</dt>
              <dd className="text-muted">{cms.featuredCards.qrSize}px</dd>
            </div>
          </dl>
        )}
      </section>

      {cards.map((card) => {
        const creator = bySlug.get(card.slug);
        return (
          <section key={card.slug} className="card-surface p-6">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="font-display text-lg font-bold text-indigo">
                  {creator?.displayName ?? card.slug}
                </h2>
                <p className="text-xs text-muted">{card.slug}</p>
              </div>
              <span className="text-xs font-semibold text-violet">{creator?.planTier}</span>
            </div>

            {canEdit ? (
              <form action={actionUpdateCard} className="mt-4 space-y-4">
                <input type="hidden" name="slug" value={card.slug} />
                <div className="flex flex-wrap gap-4">
                  <label className="flex items-center gap-2 text-sm font-medium text-indigo">
                    <input
                      type="checkbox"
                      name="visible"
                      defaultChecked={card.visible}
                      className="accent-violet"
                    />
                    Visible in featured carousel
                  </label>
                  <label className="text-sm">
                    <span className="font-semibold text-indigo">Order</span>
                    <input
                      name="order"
                      type="number"
                      defaultValue={card.order}
                      className="ml-2 w-20 rounded-lg border border-border px-2 py-1"
                    />
                  </label>
                </div>

                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {FEATURE_KEYS.map(([key, label]) => (
                    <label key={key} className="flex items-center gap-2 text-sm text-indigo">
                      <input
                        type="checkbox"
                        name={key}
                        defaultChecked={card.features[key]}
                        className="accent-violet"
                      />
                      {label}
                    </label>
                  ))}
                </div>

                <label className="block text-sm">
                  <span className="font-semibold text-indigo">Visible platforms</span>
                  <input
                    name="visiblePlatforms"
                    defaultValue={card.features.visiblePlatforms.join(",")}
                    placeholder="INSTAGRAM,TIKTOK,YOUTUBE (empty = all)"
                    className="mt-1 w-full rounded-xl border border-border px-3 py-2"
                  />
                </label>

                <button type="submit" className="btn-primary !py-2 text-sm">
                  Save card
                </button>
              </form>
            ) : (
              <div className="mt-4 space-y-3 text-sm">
                <p className="text-muted">
                  {card.visible ? "Visible" : "Hidden"} · order {card.order}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {FEATURE_KEYS.filter(([key]) => card.features[key]).map(([key, label]) => (
                    <span
                      key={key}
                      className="rounded-full bg-[#EEF2FF] px-2 py-0.5 text-[10px] font-semibold text-indigo"
                    >
                      {label}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}
