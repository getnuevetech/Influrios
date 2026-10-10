import Link from "next/link";
import {
  actionRemoveCollaborationHeroImage,
  actionSaveCollaborationLanding,
  actionUploadCollaborationHeroImage,
} from "@/app/admin/landing/actions";
import { requireAdminPage } from "@/app/admin/guard";
import { hasPermission } from "@/lib/admin-auth";
import { AdminUploadedImages } from "@/components/admin-uploaded-images";
import { getCollaborationLanding } from "@/lib/landing-pages";

export const dynamic = "force-dynamic";
export const metadata = { title: "Collaboration landing · Admin" };

type Props = { searchParams: Promise<{ saved?: string; error?: string }> };

function Field({
  label,
  name,
  defaultValue,
  rows,
  disabled,
}: {
  label: string;
  name: string;
  defaultValue: string;
  rows?: number;
  disabled?: boolean;
}) {
  return (
    <label className="block text-xs font-bold text-indigo">
      {label}
      {rows ? (
        <textarea
          name={name}
          rows={rows}
          defaultValue={defaultValue}
          disabled={disabled}
          className="mt-1 w-full rounded-xl border border-border px-3 py-2 text-sm font-normal"
        />
      ) : (
        <input
          name={name}
          defaultValue={defaultValue}
          disabled={disabled}
          className="mt-1 w-full rounded-xl border border-border px-3 py-2 text-sm font-normal"
        />
      )}
    </label>
  );
}

export default async function AdminCollaborationLandingPage({ searchParams }: Props) {
  const session = await requireAdminPage("banners");
  const query = await searchParams;
  const canEdit = hasPermission(session, "banners.edit");
  const landing = await getCollaborationLanding();

  return (
    <div className="mx-auto max-w-5xl">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-indigo">Collaboration landing</h1>
          <p className="mt-1 text-sm text-muted">
            Every public section on <code>/collaboration</code> is editable here. Match cards stay under{" "}
            <Link href="/admin/homepage" className="font-semibold text-violet">
              Homepage → Collaboration matches
            </Link>
            ; marketplace listings under{" "}
            <Link href="/admin/marketplace-listings" className="font-semibold text-violet">
              Marketplace listings
            </Link>
            .
          </p>
        </div>
        <Link href="/collaboration?landing=1" className="text-sm font-bold text-violet">
          View public page →
        </Link>
      </div>
      {query.saved ? (
        <p className="mt-4 rounded-xl bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">Saved.</p>
      ) : null}
      {query.error ? (
        <p className="mt-4 rounded-xl bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-800">{query.error}</p>
      ) : null}

      <form action={actionSaveCollaborationLanding} className="mt-6 space-y-8">
        <section className="rounded-2xl border border-[#E4EBFF] bg-white p-5">
          <h2 className="font-display text-lg font-bold text-indigo">Hero</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <Field label="Title" name="heroTitle" defaultValue={landing.hero.title} disabled={!canEdit} />
            <Field
              label="Search placeholder"
              name="heroSearchPlaceholder"
              defaultValue={landing.hero.searchPlaceholder}
              disabled={!canEdit}
            />
            <div className="sm:col-span-2">
              <Field
                label="Subtitle"
                name="heroSubtitle"
                defaultValue={landing.hero.subtitle}
                rows={3}
                disabled={!canEdit}
              />
            </div>
            <Field
              label="Primary CTA label"
              name="heroPrimaryLabel"
              defaultValue={landing.hero.primaryCta.label}
              disabled={!canEdit}
            />
            <Field
              label="Primary CTA href"
              name="heroPrimaryHref"
              defaultValue={landing.hero.primaryCta.href}
              disabled={!canEdit}
            />
            <Field
              label="Secondary CTA label"
              name="heroSecondaryLabel"
              defaultValue={landing.hero.secondaryCta.label}
              disabled={!canEdit}
            />
            <Field
              label="Secondary CTA href"
              name="heroSecondaryHref"
              defaultValue={landing.hero.secondaryCta.href}
              disabled={!canEdit}
            />
            <Field
              label="Tags (one per line)"
              name="heroTags"
              defaultValue={landing.hero.tags.join("\n")}
              rows={4}
              disabled={!canEdit}
            />
            <Field
              label="Collage labels (one per line)"
              name="heroCollageLabels"
              defaultValue={landing.hero.collageLabels.join("\n")}
              rows={4}
              disabled={!canEdit}
            />
          </div>
          <div className="mt-6 border-t border-[#E4EBFF] pt-4">
            <h3 className="font-display text-base font-bold text-indigo">Hero images</h3>
            <p className="mt-1 text-sm text-muted">
              These photos are the collaboration page collage. Upload them here. A page with no images leaves that area empty.
            </p>
            <AdminUploadedImages
              images={landing.hero.images}
              uploadAction={actionUploadCollaborationHeroImage}
              removeAction={actionRemoveCollaborationHeroImage}
              canEdit={canEdit}
              emptyLabel="No hero images yet. Upload one below."
            />
          </div>
        </section>

        <section className="rounded-2xl border border-[#E4EBFF] bg-white p-5">
          <h2 className="font-display text-lg font-bold text-indigo">Popular matches + dual path</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <Field label="Popular title" name="popularTitle" defaultValue={landing.popularMatches.title} disabled={!canEdit} />
            <Field label="Popular subtitle" name="popularSubtitle" defaultValue={landing.popularMatches.subtitle} disabled={!canEdit} />
            <Field label="Popular CTA label" name="popularCtaLabel" defaultValue={landing.popularMatches.ctaLabel} disabled={!canEdit} />
            <Field label="Popular CTA href" name="popularCtaHref" defaultValue={landing.popularMatches.ctaHref} disabled={!canEdit} />
            <Field label="Dual path title" name="dualTitle" defaultValue={landing.dualPath.title} disabled={!canEdit} />
            <div />
            <Field label="Business eyebrow" name="dualBusinessEyebrow" defaultValue={landing.dualPath.business.eyebrow} disabled={!canEdit} />
            <Field label="Business title" name="dualBusinessTitle" defaultValue={landing.dualPath.business.title} disabled={!canEdit} />
            <Field label="Business points" name="dualBusinessPoints" defaultValue={landing.dualPath.business.points.join("\n")} rows={6} disabled={!canEdit} />
            <Field label="Influencer points" name="dualInfluencerPoints" defaultValue={landing.dualPath.influencer.points.join("\n")} rows={6} disabled={!canEdit} />
            <Field label="Business CTA label" name="dualBusinessCtaLabel" defaultValue={landing.dualPath.business.cta.label} disabled={!canEdit} />
            <Field label="Business CTA href" name="dualBusinessCtaHref" defaultValue={landing.dualPath.business.cta.href} disabled={!canEdit} />
            <Field label="Influencer eyebrow" name="dualInfluencerEyebrow" defaultValue={landing.dualPath.influencer.eyebrow} disabled={!canEdit} />
            <Field label="Influencer title" name="dualInfluencerTitle" defaultValue={landing.dualPath.influencer.title} disabled={!canEdit} />
            <Field label="Influencer CTA label" name="dualInfluencerCtaLabel" defaultValue={landing.dualPath.influencer.cta.label} disabled={!canEdit} />
            <Field label="Influencer CTA href" name="dualInfluencerCtaHref" defaultValue={landing.dualPath.influencer.cta.href} disabled={!canEdit} />
          </div>
        </section>

        <section className="rounded-2xl border border-[#E4EBFF] bg-white p-5">
          <h2 className="font-display text-lg font-bold text-indigo">Featured + marketplace + suggestions</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <Field label="Featured title" name="featuredTitle" defaultValue={landing.featured.title} disabled={!canEdit} />
            <Field label="Featured subtitle" name="featuredSubtitle" defaultValue={landing.featured.subtitle} disabled={!canEdit} />
            <Field label="Featured CTA label" name="featuredCtaLabel" defaultValue={landing.featured.ctaLabel} disabled={!canEdit} />
            <Field label="Featured CTA href" name="featuredCtaHref" defaultValue={landing.featured.ctaHref} disabled={!canEdit} />
            <Field label="Business requests title" name="marketBusinessTitle" defaultValue={landing.marketplace.businessTitle} disabled={!canEdit} />
            <Field label="Business requests subtitle" name="marketBusinessSubtitle" defaultValue={landing.marketplace.businessSubtitle} disabled={!canEdit} />
            <Field label="Influencer opportunities title" name="marketInfluencerTitle" defaultValue={landing.marketplace.influencerTitle} disabled={!canEdit} />
            <Field label="Influencer opportunities subtitle" name="marketInfluencerSubtitle" defaultValue={landing.marketplace.influencerSubtitle} disabled={!canEdit} />
            <Field label="Suggestions title" name="suggestionsTitle" defaultValue={landing.suggestionsBanner.title} disabled={!canEdit} />
            <Field label="Suggestions subtitle" name="suggestionsSubtitle" defaultValue={landing.suggestionsBanner.subtitle} disabled={!canEdit} />
            <Field label="Suggestions CTA label" name="suggestionsCtaLabel" defaultValue={landing.suggestionsBanner.cta.label} disabled={!canEdit} />
            <Field label="Suggestions CTA href" name="suggestionsCtaHref" defaultValue={landing.suggestionsBanner.cta.href} disabled={!canEdit} />
          </div>
        </section>

        <section className="rounded-2xl border border-[#E4EBFF] bg-white p-5">
          <h2 className="font-display text-lg font-bold text-indigo">How it works, features, payments, types</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <Field label="How it works title" name="howTitle" defaultValue={landing.howItWorks.title} disabled={!canEdit} />
            <Field label="How it works steps" name="howSteps" defaultValue={landing.howItWorks.steps.join("\n")} rows={6} disabled={!canEdit} />
            <Field label="For Businesses title" name="featuresBusinessTitle" defaultValue={landing.features.businessTitle} disabled={!canEdit} />
            <Field label="For Influencers title" name="featuresInfluencerTitle" defaultValue={landing.features.influencerTitle} disabled={!canEdit} />
            <Field label="Business feature items" name="featuresBusinessItems" defaultValue={landing.features.businessItems.join("\n")} rows={6} disabled={!canEdit} />
            <Field label="Influencer feature items" name="featuresInfluencerItems" defaultValue={landing.features.influencerItems.join("\n")} rows={6} disabled={!canEdit} />
            <Field label="Protected payments title" name="paymentsTitle" defaultValue={landing.protectedPayments.title} disabled={!canEdit} />
            <Field label="Protected payments subtitle" name="paymentsSubtitle" defaultValue={landing.protectedPayments.subtitle} disabled={!canEdit} />
            <Field label="Protected payment steps" name="paymentsSteps" defaultValue={landing.protectedPayments.steps.join("\n")} rows={5} disabled={!canEdit} />
            <Field label="Collab types title" name="typesTitle" defaultValue={landing.collabTypes.title} disabled={!canEdit} />
            <div className="sm:col-span-2">
              <Field label="Collab type items" name="typesItems" defaultValue={landing.collabTypes.items.join("\n")} rows={5} disabled={!canEdit} />
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-[#E4EBFF] bg-white p-5">
          <h2 className="font-display text-lg font-bold text-indigo">Mentorship, trust, final CTAs</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <Field label="Mentorship title" name="mentorTitle" defaultValue={landing.mentorship.title} disabled={!canEdit} />
            <Field label="Mentorship subtitle" name="mentorSubtitle" defaultValue={landing.mentorship.subtitle} rows={3} disabled={!canEdit} />
            <Field label="Find mentor label" name="mentorFindLabel" defaultValue={landing.mentorship.findCta.label} disabled={!canEdit} />
            <Field label="Find mentor href" name="mentorFindHref" defaultValue={landing.mentorship.findCta.href} disabled={!canEdit} />
            <Field label="Become mentor label" name="mentorBecomeLabel" defaultValue={landing.mentorship.becomeCta.label} disabled={!canEdit} />
            <Field label="Become mentor href" name="mentorBecomeHref" defaultValue={landing.mentorship.becomeCta.href} disabled={!canEdit} />
            <Field label="Trust bar title" name="trustTitle" defaultValue={landing.trustBar.title} disabled={!canEdit} />
            <Field label="Trust items" name="trustItems" defaultValue={landing.trustBar.items.join("\n")} rows={5} disabled={!canEdit} />
            <Field label="Final influencer title" name="finalInfluencerTitle" defaultValue={landing.finalCtas.influencer.title} disabled={!canEdit} />
            <Field label="Final business title" name="finalBusinessTitle" defaultValue={landing.finalCtas.business.title} disabled={!canEdit} />
            <Field label="Final influencer points" name="finalInfluencerPoints" defaultValue={landing.finalCtas.influencer.points.join("\n")} rows={4} disabled={!canEdit} />
            <Field label="Final business points" name="finalBusinessPoints" defaultValue={landing.finalCtas.business.points.join("\n")} rows={4} disabled={!canEdit} />
            <Field label="Final influencer CTA label" name="finalInfluencerCtaLabel" defaultValue={landing.finalCtas.influencer.cta.label} disabled={!canEdit} />
            <Field label="Final influencer CTA href" name="finalInfluencerCtaHref" defaultValue={landing.finalCtas.influencer.cta.href} disabled={!canEdit} />
            <Field label="Final business CTA label" name="finalBusinessCtaLabel" defaultValue={landing.finalCtas.business.cta.label} disabled={!canEdit} />
            <Field label="Final business CTA href" name="finalBusinessCtaHref" defaultValue={landing.finalCtas.business.cta.href} disabled={!canEdit} />
          </div>
        </section>

        {canEdit ? (
          <button type="submit" className="btn-primary">
            Save collaboration landing
          </button>
        ) : null}
      </form>
    </div>
  );
}
