import Image from "next/image";
import Link from "next/link";
import { requireAdminPage } from "@/app/admin/guard";
import {
  actionRemoveBannerImage,
  actionUpdateBanner,
  actionUploadBannerImage,
} from "@/app/admin/actions";
import { hasPermission } from "@/lib/admin-auth";
import { getCms, type BannerSlot } from "@/lib/cms";

export const metadata = { title: "Admin · Banners" };

type Props = { searchParams: Promise<{ saved?: string; uploaded?: string; error?: string }> };

export default async function AdminBannersPage({ searchParams }: Props) {
  const session = await requireAdminPage("banners");
  const canEdit = hasPermission(session, "banners.edit");
  const params = await searchParams;
  const cms = await getCms();
  const banners = Object.values(cms.banners);

  return (
    <div className="mx-auto max-w-[90rem] space-y-8 px-4 py-10 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Link href="/admin" className="text-sm font-semibold text-violet hover:underline">
            ← Admin
          </Link>
          <h1 className="mt-2 font-display text-3xl font-bold text-indigo">Banners</h1>
          <p className="mt-1 text-sm text-muted">
            {canEdit
              ? "Edit copy, height scale (−20% = 0.8), and upload multiple images per banner."
              : "View-only — your access level can open banners but not edit them."}
          </p>
        </div>
      </div>

      {params.saved || params.uploaded ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          Banner updated{params.uploaded ? " · image uploaded" : ""}.
        </div>
      ) : null}
      {params.error ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Upload failed — choose an image file.
        </div>
      ) : null}

      {banners.map((b) => (
        <section key={b.id} className="card-surface space-y-5 p-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-display text-xl font-bold text-indigo">{b.label}</h2>
            <span className="rounded-full bg-lavender px-2.5 py-0.5 text-xs font-bold text-violet">
              {b.id}
            </span>
          </div>

          {canEdit ? (
            <form action={actionUpdateBanner} className="grid gap-3 sm:grid-cols-2">
              <input type="hidden" name="id" value={b.id} />
              <label className="flex items-center gap-2 text-sm font-medium text-indigo sm:col-span-2">
                <input type="checkbox" name="enabled" defaultChecked={b.enabled} className="accent-violet" />
                Enabled on site
              </label>
              <label className="text-sm">
                <span className="font-semibold text-indigo">Height scale</span>
                <input
                  name="heightScale"
                  type="number"
                  step="0.05"
                  min="0.5"
                  max="1.5"
                  defaultValue={b.heightScale}
                  className="mt-1 w-full rounded-xl border border-border px-3 py-2"
                />
                <span className="text-xs text-muted">0.8 = 20% shorter</span>
              </label>
              <label className="text-sm">
                <span className="font-semibold text-indigo">CTA href</span>
                <input
                  name="ctaHref"
                  defaultValue={b.ctaHref}
                  className="mt-1 w-full rounded-xl border border-border px-3 py-2"
                />
              </label>
              <label className="text-sm sm:col-span-2">
                <span className="font-semibold text-indigo">Title</span>
                <input
                  name="title"
                  defaultValue={b.title}
                  className="mt-1 w-full rounded-xl border border-border px-3 py-2"
                />
              </label>
              <label className="text-sm sm:col-span-2">
                <span className="font-semibold text-indigo">Subtitle</span>
                <textarea
                  name="subtitle"
                  rows={2}
                  defaultValue={b.subtitle}
                  className="mt-1 w-full rounded-xl border border-border px-3 py-2"
                />
              </label>
              <label className="text-sm sm:col-span-2">
                <span className="font-semibold text-indigo">CTA label</span>
                <input
                  name="ctaLabel"
                  defaultValue={b.ctaLabel}
                  className="mt-1 w-full rounded-xl border border-border px-3 py-2"
                />
              </label>
              {b.id === "sponsored" ? (
                <label className="text-sm sm:col-span-2">
                  <span className="font-semibold text-indigo">Partner names</span>
                  <textarea
                    name="partners"
                    rows={4}
                    defaultValue={b.partners.join("\n")}
                    placeholder="One saved partner per line"
                    className="mt-1 w-full rounded-xl border border-border px-3 py-2"
                  />
                  <span className="text-xs text-muted">Leave this empty and the homepage omits the name row.</span>
                </label>
              ) : (
                <input type="hidden" name="partners" value={b.partners.join("\n")} />
              )}
              <button type="submit" className="btn-primary sm:col-span-2 !py-2 text-sm">
                Save {b.label}
              </button>
            </form>
          ) : (
            <dl className="grid gap-2 text-sm sm:grid-cols-2">
              <div>
                <dt className="font-semibold text-indigo">Status</dt>
                <dd className="text-muted">{b.enabled ? "Enabled" : "Disabled"}</dd>
              </div>
              <div>
                <dt className="font-semibold text-indigo">Height scale</dt>
                <dd className="text-muted">{b.heightScale}</dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="font-semibold text-indigo">Title</dt>
                <dd className="text-muted">{b.title || "—"}</dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="font-semibold text-indigo">Subtitle</dt>
                <dd className="text-muted">{b.subtitle || "—"}</dd>
              </div>
              <div>
                <dt className="font-semibold text-indigo">CTA</dt>
                <dd className="text-muted">
                  {b.ctaLabel || "—"} → {b.ctaHref || "—"}
                </dd>
              </div>
              {b.id === "sponsored" ? (
                <div className="sm:col-span-2">
                  <dt className="font-semibold text-indigo">Partner names</dt>
                  <dd className="text-muted">{b.partners.length > 0 ? b.partners.join(", ") : "None saved"}</dd>
                </div>
              ) : null}
            </dl>
          )}

          <div>
            <p className="text-sm font-semibold text-indigo">Images ({b.images.length})</p>
            <div className="mt-3 flex flex-wrap gap-3">
              {b.images.map((img) => (
                <div key={img} className="relative h-24 w-36 overflow-hidden rounded-xl border border-border">
                  <Image src={img} alt="" fill className="object-cover" sizes="144px" />
                  {canEdit ? (
                    <form action={actionRemoveBannerImage} className="absolute bottom-1 right-1">
                      <input type="hidden" name="id" value={b.id} />
                      <input type="hidden" name="image" value={img} />
                      <button
                        type="submit"
                        className="rounded bg-white/95 px-2 py-0.5 text-[10px] font-bold text-violet"
                      >
                        Remove
                      </button>
                    </form>
                  ) : null}
                </div>
              ))}
              {b.images.length === 0 ? (
                <p className="text-sm text-muted">No images yet{canEdit ? " — upload below." : "."}</p>
              ) : null}
            </div>
            {canEdit ? (
              <form action={actionUploadBannerImage} className="mt-4 flex flex-wrap items-end gap-3">
                <input type="hidden" name="id" value={b.id as BannerSlot} />
                <label className="text-sm">
                  <span className="font-semibold text-indigo">Upload image</span>
                  <input
                    type="file"
                    name="file"
                    accept="image/*"
                    required
                    className="mt-1 block w-full text-sm"
                  />
                </label>
                <button type="submit" className="btn-secondary !py-2 text-sm">
                  Add image
                </button>
              </form>
            ) : null}
          </div>
        </section>
      ))}
    </div>
  );
}
