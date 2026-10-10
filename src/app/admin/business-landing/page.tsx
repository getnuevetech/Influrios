import Link from "next/link";
import { actionSaveBusinessLanding } from "@/app/admin/landing/actions";
import { requireAdminPage } from "@/app/admin/guard";
import { hasPermission } from "@/lib/admin-auth";
import { getBusinessLanding } from "@/lib/landing-pages";

export const dynamic = "force-dynamic";
export const metadata = { title: "Business landing · Admin" };

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

export default async function AdminBusinessLandingPage({ searchParams }: Props) {
  const session = await requireAdminPage("banners");
  const query = await searchParams;
  const canEdit = hasPermission(session, "banners.edit");
  const landing = await getBusinessLanding();

  return (
    <div className="mx-auto max-w-5xl">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-indigo">Business landing</h1>
          <p className="mt-1 text-sm text-muted">
            Public <code>/business</code> copy, capabilities, plans, and signup form text.
          </p>
        </div>
        <Link href="/business" className="text-sm font-bold text-violet">
          View public page →
        </Link>
      </div>
      {query.saved ? (
        <p className="mt-4 rounded-xl bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">Saved.</p>
      ) : null}
      {query.error ? (
        <p className="mt-4 rounded-xl bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-800">{query.error}</p>
      ) : null}

      <form action={actionSaveBusinessLanding} className="mt-6 space-y-8">
        <section className="rounded-2xl border border-[#E4EBFF] bg-white p-5">
          <h2 className="font-display text-lg font-bold text-indigo">Hero</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <Field label="Eyebrow" name="heroEyebrow" defaultValue={landing.hero.eyebrow} disabled={!canEdit} />
            <Field label="Title" name="heroTitle" defaultValue={landing.hero.title} disabled={!canEdit} />
            <Field label="Title highlight" name="heroTitleHighlight" defaultValue={landing.hero.titleHighlight} disabled={!canEdit} />
            <Field label="Collage note" name="heroCollageNote" defaultValue={landing.hero.collageNote} disabled={!canEdit} />
            <div className="sm:col-span-2">
              <Field label="Subtitle" name="heroSubtitle" defaultValue={landing.hero.subtitle} rows={3} disabled={!canEdit} />
            </div>
            <Field label="Primary CTA label" name="heroPrimaryLabel" defaultValue={landing.hero.primaryCta.label} disabled={!canEdit} />
            <Field label="Primary CTA href" name="heroPrimaryHref" defaultValue={landing.hero.primaryCta.href} disabled={!canEdit} />
            <Field label="Secondary CTA label" name="heroSecondaryLabel" defaultValue={landing.hero.secondaryCta.label} disabled={!canEdit} />
            <Field label="Secondary CTA href" name="heroSecondaryHref" defaultValue={landing.hero.secondaryCta.href} disabled={!canEdit} />
            <Field label="Search placeholder" name="heroSearchPlaceholder" defaultValue={landing.hero.searchPlaceholder} disabled={!canEdit} />
            <Field label="Tags (one per line)" name="heroTags" defaultValue={landing.hero.tags.join("\n")} rows={4} disabled={!canEdit} />
            <div className="sm:col-span-2">
              <Field label="Floating notes (one per line)" name="heroFloatingNotes" defaultValue={landing.hero.floatingNotes.join("\n")} rows={3} disabled={!canEdit} />
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-[#E4EBFF] bg-white p-5">
          <h2 className="font-display text-lg font-bold text-indigo">Capabilities</h2>
          <Field label="Section title" name="capabilitiesTitle" defaultValue={landing.capabilities.title} disabled={!canEdit} />
          <div className="mt-4 space-y-3">
            {landing.capabilities.items.map((item, index) => (
              <div key={`${item.title}-${index}`} className="grid gap-2 rounded-xl border border-[#F0F3FA] p-3 sm:grid-cols-2">
                <Field label={`Capability ${index + 1} title`} name="capabilityTitle" defaultValue={item.title} disabled={!canEdit} />
                <Field label="Copy" name="capabilityCopy" defaultValue={item.copy} disabled={!canEdit} />
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-[#E4EBFF] bg-white p-5">
          <h2 className="font-display text-lg font-bold text-indigo">Directory profiles + How it works + Why</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <Field label="Directory title" name="recommendedTitle" defaultValue={landing.recommended.title} disabled={!canEdit} />
            <Field label="Directory subtitle" name="recommendedSubtitle" defaultValue={landing.recommended.subtitle} disabled={!canEdit} />
            <Field label="Directory CTA label" name="recommendedCtaLabel" defaultValue={landing.recommended.ctaLabel} disabled={!canEdit} />
            <Field label="Directory CTA href" name="recommendedCtaHref" defaultValue={landing.recommended.ctaHref} disabled={!canEdit} />
            <Field label="How it works title" name="howTitle" defaultValue={landing.howItWorks.title} disabled={!canEdit} />
            <div />
            {landing.howItWorks.steps.map((step, index) => (
              <div key={`${step.title}-${index}`} className="contents">
                <Field label={`Step ${index + 1} title`} name="stepTitle" defaultValue={step.title} disabled={!canEdit} />
                <Field label="Copy" name="stepCopy" defaultValue={step.copy} disabled={!canEdit} />
              </div>
            ))}
            <Field label="Why title" name="whyTitle" defaultValue={landing.whyChoose.title} disabled={!canEdit} />
            <Field label="Photo caption" name="whyCaption" defaultValue={landing.whyChoose.photoCaption} disabled={!canEdit} />
            <div className="sm:col-span-2">
              <Field label="Why items (one per line)" name="whyItems" defaultValue={landing.whyChoose.items.join("\n")} rows={6} disabled={!canEdit} />
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-[#E4EBFF] bg-white p-5">
          <h2 className="font-display text-lg font-bold text-indigo">Plans</h2>
          <Field label="Plans section title" name="plansTitle" defaultValue={landing.plans.title} disabled={!canEdit} />
          <div className="mt-4 space-y-4">
            {landing.plans.items.map((plan, index) => (
              <div key={plan.code} className="grid gap-2 rounded-xl border border-[#F0F3FA] p-3 sm:grid-cols-2">
                <Field label="Code" name="planCode" defaultValue={plan.code} disabled={!canEdit} />
                <Field label="Name" name="planName" defaultValue={plan.name} disabled={!canEdit} />
                <Field label="Price" name="planPrice" defaultValue={plan.price} disabled={!canEdit} />
                <Field label="Detail" name="planDetail" defaultValue={plan.detail} disabled={!canEdit} />
                <Field label="CTA label" name="planCtaLabel" defaultValue={plan.ctaLabel} disabled={!canEdit} />
                <Field label="CTA href" name="planHref" defaultValue={plan.href} disabled={!canEdit} />
                <div className="sm:col-span-2">
                  <Field label="Points (one per line)" name="planPoints" defaultValue={plan.points.join("\n")} rows={4} disabled={!canEdit} />
                </div>
                <input type="hidden" name="planPopular" value={plan.popular ? "1" : "0"} />
                <p className="text-xs text-muted sm:col-span-2">
                  Plan {index + 1}
                  {plan.popular ? " · Most Popular" : ""}
                </p>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-[#E4EBFF] bg-white p-5">
          <h2 className="font-display text-lg font-bold text-indigo">Signup</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <Field label="Title" name="signupTitle" defaultValue={landing.signup.title} disabled={!canEdit} />
            <Field label="Subtitle" name="signupSubtitle" defaultValue={landing.signup.subtitle} disabled={!canEdit} />
            <Field label="Checkbox label" name="signupCheckbox" defaultValue={landing.signup.checkboxLabel} disabled={!canEdit} />
            <Field label="Submit label" name="signupSubmit" defaultValue={landing.signup.submitLabel} disabled={!canEdit} />
            <Field label="Aside title" name="asideTitle" defaultValue={landing.signup.asideTitle} disabled={!canEdit} />
            <Field label="Aside copy" name="asideCopy" defaultValue={landing.signup.asideCopy} rows={3} disabled={!canEdit} />
            <Field label="Aside CTA label" name="asideCtaLabel" defaultValue={landing.signup.asideCta.label} disabled={!canEdit} />
            <Field label="Aside CTA href" name="asideCtaHref" defaultValue={landing.signup.asideCta.href} disabled={!canEdit} />
          </div>
        </section>

        {canEdit ? (
          <button type="submit" className="btn-primary">
            Save business landing
          </button>
        ) : null}
      </form>
    </div>
  );
}
