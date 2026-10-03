import Image from "next/image";
import Link from "next/link";
import {
  CategoryGlyph,
  IconArrowRight,
  IconBuilding,
  IconCheck,
  IconSearch,
  IconUsers,
  SocialIcon,
} from "@/components/icons";
import type { BusinessLandingConfig } from "@/lib/landing-pages";
import { SPECIALTY_TAXONOMY } from "@/lib/seed-data";

type RecommendedInfluencer = {
  slug: string;
  displayName: string;
  title: string;
  image: string;
  locationCity: string;
  locationCountry: string;
  specialty: string;
  specialtySlug: string;
  followers: string;
  engagement: string;
  why: string;
  platforms: string[];
};

/** Public For Businesses marketing + signup surface (approved design, CMS-backed). */
export function BusinessMarketingPage({
  landing,
  recommended,
}: {
  landing: BusinessLandingConfig;
  recommended: RecommendedInfluencer[];
}) {
  const hero = landing.hero;
  const tagSlug = (name: string) =>
    SPECIALTY_TAXONOMY.find((item) => item.name === name)?.slug ??
    name.toLowerCase().replace(/\s+&\s+/g, "-").replace(/\s+/g, "-");

  return (
    <div className="bg-[#F7FAFF]">
      <section className="relative overflow-hidden border-b border-[#E4EBFF] bg-gradient-to-br from-[#F4F0FF] via-white to-[#E8F4FF]">
        <div className="mx-auto grid max-w-[90rem] items-center gap-8 px-4 py-12 sm:px-6 lg:grid-cols-[1.1fr_0.9fr] lg:px-10 lg:py-16">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-violet">{hero.eyebrow}</p>
            <h1 className="mt-3 max-w-3xl font-display text-4xl font-bold text-indigo sm:text-5xl">
              {hero.title}{" "}
              <span className="bg-gradient-to-r from-[#633CFF] to-[#E91E8C] bg-clip-text text-transparent">
                {hero.titleHighlight}
              </span>
            </h1>
            <p className="mt-4 max-w-2xl text-sm text-muted sm:text-base">{hero.subtitle}</p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link href={hero.primaryCta.href} className="btn-primary">
                {hero.primaryCta.label} <IconArrowRight size={14} />
              </Link>
              <Link href={hero.secondaryCta.href} className="btn-secondary">
                {hero.secondaryCta.label}
              </Link>
            </div>
            <form
              action="/discover"
              className="mt-8 flex max-w-3xl items-center gap-2 rounded-full bg-white p-1.5 shadow-lg ring-1 ring-[#E4E9F5]"
            >
              <span className="pl-3 text-muted">
                <IconSearch size={16} />
              </span>
              <input
                name="q"
                placeholder={hero.searchPlaceholder}
                className="min-w-0 flex-1 border-0 bg-transparent py-2.5 text-sm outline-none"
              />
              <button type="submit" className="btn-primary shrink-0 !px-5 !py-2.5 text-sm">
                Search
              </button>
            </form>
            <div className="mt-4 flex flex-wrap gap-2">
              {hero.tags.map((name) => {
                const slug = tagSlug(name);
                return (
                  <Link
                    key={name}
                    href={`/discover?specialty=${encodeURIComponent(slug)}`}
                    className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-indigo ring-1 ring-[#E4E9F5]"
                  >
                    <CategoryGlyph slug={slug} size={14} />
                    {name}
                  </Link>
                );
              })}
              <Link
                href="/categories"
                className="rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-violet ring-1 ring-[#E4E9F5]"
              >
                + More
              </Link>
            </div>
          </div>

          <div className="relative mx-auto hidden h-[380px] w-full max-w-md lg:block">
            {recommended[0] ? (
              <div className="absolute inset-y-4 right-0 w-[70%] overflow-hidden rounded-[2rem] shadow-2xl ring-4 ring-white">
                <Image src={recommended[0].image} alt="" fill className="object-cover" sizes="320px" />
              </div>
            ) : null}
            {recommended.slice(1, 4).map((item, index) => (
              <div
                key={item.slug}
                className={`absolute overflow-hidden rounded-2xl border border-white bg-white p-2 shadow-xl ${
                  index === 0
                    ? "left-0 top-8 w-44"
                    : index === 1
                      ? "bottom-16 left-4 w-40"
                      : "bottom-4 right-8 w-36"
                }`}
              >
                <div className="relative h-20 overflow-hidden rounded-xl">
                  <Image src={item.image} alt="" fill className="object-cover" sizes="160px" />
                </div>
                <p className="mt-2 truncate text-xs font-bold text-indigo">{item.displayName}</p>
                <p className="truncate text-[10px] text-muted">{item.specialty}</p>
              </div>
            ))}
            <div className="absolute left-2 top-1/2 max-w-[170px] -translate-y-1/2 rounded-2xl bg-violet px-3 py-2 text-[11px] font-bold text-white shadow-lg">
              {hero.floatingNotes[0]}
            </div>
            <div className="absolute bottom-24 right-0 max-w-[160px] rounded-2xl bg-[#2979FF] px-3 py-2 text-[11px] font-bold text-white shadow-lg">
              {hero.floatingNotes[1]}
            </div>
            <p className="absolute -right-2 top-4 rotate-6 font-display text-sm font-bold text-violet">
              {hero.collageNote}
            </p>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-[90rem] px-4 py-12 sm:px-6 lg:px-10">
        <h2 className="font-display text-2xl font-bold text-indigo">{landing.capabilities.title}</h2>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {landing.capabilities.items.map((item) => (
            <article key={item.title} className="rounded-2xl border border-[#E4E9F5] bg-white p-5 shadow-sm">
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-[#EAE4FF] text-violet">
                <IconBuilding size={18} />
              </span>
              <h3 className="mt-3 font-display text-lg font-bold text-indigo">{item.title}</h3>
              <p className="mt-1 text-sm text-muted">{item.copy}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="border-y border-[#E4EBFF] bg-white">
        <div className="mx-auto max-w-[90rem] px-4 py-12 sm:px-6 lg:px-10">
          <div className="mb-6 flex items-end justify-between gap-3">
            <div>
              <h2 className="font-display text-2xl font-bold text-indigo">{landing.recommended.title}</h2>
              <p className="mt-1 text-sm text-muted">{landing.recommended.subtitle}</p>
            </div>
            <Link href={landing.recommended.ctaHref} className="text-sm font-bold text-violet hover:underline">
              {landing.recommended.ctaLabel} →
            </Link>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {recommended.map((item) => (
              <article key={item.slug} className="overflow-hidden rounded-2xl border border-[#E4E9F5] bg-white shadow-sm">
                <div className="relative h-36">
                  <Image src={item.image} alt="" fill className="object-cover" sizes="280px" />
                  <span className="absolute left-3 top-3 rounded-full bg-white/95 px-2 py-0.5 text-[10px] font-bold text-violet">
                    {item.specialty}
                  </span>
                </div>
                <div className="p-4">
                  <p className="font-display text-lg font-bold text-indigo">{item.displayName}</p>
                  <p className="text-xs text-muted">{item.title}</p>
                  <p className="mt-1 text-[11px] text-muted">
                    {item.locationCity}, {item.locationCountry}
                  </p>
                  <div className="mt-2 flex items-center gap-2">
                    {item.platforms.slice(0, 4).map((platform) => (
                      <SocialIcon key={platform} platform={platform} size={14} />
                    ))}
                  </div>
                  <p className="mt-2 text-xs font-semibold text-indigo">
                    {item.followers} followers · {item.engagement} eng.
                  </p>
                  <p className="mt-2 rounded-xl bg-[#F4F0FF] p-2 text-[11px] text-muted">
                    <span className="font-bold text-violet">Why this match?</span> {item.why}
                  </p>
                  <Link href={`/creators/${item.slug}`} className="mt-3 inline-flex text-xs font-bold text-violet">
                    View Profile →
                  </Link>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-[90rem] px-4 py-12 sm:px-6 lg:px-10">
        <h2 className="font-display text-2xl font-bold text-indigo">{landing.howItWorks.title}</h2>
        <ol className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {landing.howItWorks.steps.map((step, index) => (
            <li key={step.title} className="rounded-2xl border border-[#E4E9F5] bg-white p-5">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-violet text-sm font-bold text-white">
                {index + 1}
              </span>
              <h3 className="mt-3 font-display text-lg font-bold text-indigo">{step.title}</h3>
              <p className="mt-1 text-sm text-muted">{step.copy}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="border-y border-[#E4EBFF] bg-white">
        <div className="mx-auto grid max-w-[90rem] items-center gap-8 px-4 py-12 sm:px-6 lg:grid-cols-2 lg:px-10">
          <div>
            <h2 className="font-display text-2xl font-bold text-indigo">{landing.whyChoose.title}</h2>
            <ul className="mt-5 space-y-3">
              {landing.whyChoose.items.map((item) => (
                <li key={item} className="flex items-start gap-3 text-sm font-semibold text-indigo">
                  <span className="mt-0.5 inline-flex h-6 w-6 items-center justify-center rounded-full bg-[#EAE4FF] text-violet">
                    <IconCheck size={12} />
                  </span>
                  {item}
                </li>
              ))}
            </ul>
          </div>
          <div className="relative h-72 overflow-hidden rounded-[2rem] shadow-xl">
            {recommended[1] ? (
              <Image src={recommended[1].image} alt="" fill className="object-cover" sizes="520px" />
            ) : (
              <div className="flex h-full items-center justify-center bg-gradient-to-br from-[#633CFF] to-[#2979FF] text-white">
                <IconUsers size={40} />
              </div>
            )}
            <p className="absolute bottom-4 left-4 right-4 rounded-2xl bg-white/95 px-4 py-3 font-display text-lg font-bold text-indigo shadow">
              {landing.whyChoose.photoCaption}
            </p>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-[90rem] px-4 py-12 sm:px-6 lg:px-10">
        <h2 className="font-display text-2xl font-bold text-indigo">{landing.plans.title}</h2>
        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {landing.plans.items.map((plan) => (
            <article
              key={plan.code}
              className={`rounded-2xl border p-5 shadow-sm ${
                plan.popular ? "border-violet bg-[#F7F4FF]" : "border-[#E4E9F5] bg-white"
              }`}
            >
              {plan.popular ? (
                <p className="text-[10px] font-bold uppercase tracking-wide text-violet">Most Popular</p>
              ) : null}
              <h3 className="mt-1 font-display text-xl font-bold text-indigo">{plan.name}</h3>
              <p className="mt-2 font-display text-3xl font-bold text-indigo">
                {plan.price}
                <span className="text-sm font-medium text-muted"> {plan.detail}</span>
              </p>
              <ul className="mt-4 space-y-1.5 text-sm text-muted">
                {plan.points.map((point) => (
                  <li key={point} className="flex gap-2">
                    <IconCheck size={14} className="mt-0.5 shrink-0 text-violet" />
                    {point}
                  </li>
                ))}
              </ul>
              <Link href={plan.href} className="btn-primary mt-5 w-full !py-2 text-center text-sm">
                {plan.ctaLabel}
              </Link>
            </article>
          ))}
        </div>
      </section>

      <section id="create-profile" className="mx-auto max-w-[90rem] px-4 py-12 sm:px-6 lg:px-10">
        <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <form action="/register" method="get" className="rounded-2xl border border-[#E4E9F5] bg-white p-6 shadow-sm">
            <input type="hidden" name="next" value="/collaboration/business" />
            <h2 className="font-display text-2xl font-bold text-indigo">{landing.signup.title}</h2>
            <p className="mt-1 text-sm text-muted">{landing.signup.subtitle}</p>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <label className="block text-xs font-bold text-indigo sm:col-span-2">
                Business Name
                <input
                  name="name"
                  required
                  placeholder="Your brand or company"
                  className="mt-1 w-full rounded-xl border border-border px-3 py-2 text-sm font-normal"
                />
              </label>
              <label className="block text-xs font-bold text-indigo sm:col-span-2">
                Work Email
                <input
                  name="email"
                  type="email"
                  required
                  className="mt-1 w-full rounded-xl border border-border px-3 py-2 text-sm font-normal"
                />
              </label>
              <label className="block text-xs font-bold text-indigo">
                Country
                <input
                  name="country"
                  placeholder="United States"
                  className="mt-1 w-full rounded-xl border border-border px-3 py-2 text-sm font-normal"
                />
              </label>
              <label className="block text-xs font-bold text-indigo">
                Business Type
                <select name="businessType" className="mt-1 w-full rounded-xl border border-border px-3 py-2 text-sm font-normal">
                  <option>Brand</option>
                  <option>Agency</option>
                  <option>Marketplace</option>
                  <option>Other</option>
                </select>
              </label>
              <label className="block text-xs font-bold text-indigo sm:col-span-2">
                Website (optional)
                <input name="website" className="mt-1 w-full rounded-xl border border-border px-3 py-2 text-sm font-normal" />
              </label>
            </div>
            <label className="mt-4 flex items-start gap-2 text-sm text-muted">
              <input type="checkbox" name="wantSuggestions" defaultChecked className="mt-1 accent-[#633CFF]" />
              {landing.signup.checkboxLabel}
            </label>
            <Link
              href="/register?next=%2Fcollaboration%2Fbusiness"
              className="btn-primary mt-5 flex w-full justify-center"
            >
              {landing.signup.submitLabel} <IconArrowRight size={14} />
            </Link>
            <p className="mt-3 text-center text-sm text-muted">
              Already have an account?{" "}
              <Link href="/login?next=%2Fcollaboration%2Fbusiness&gate=business" className="font-semibold text-violet">
                Log in
              </Link>
            </p>
          </form>

          <aside className="rounded-2xl bg-gradient-to-br from-[#633CFF] to-[#2979FF] p-6 text-white shadow-sm">
            <IconUsers size={22} />
            <h3 className="mt-3 font-display text-2xl font-bold">{landing.signup.asideTitle}</h3>
            <p className="mt-2 text-sm text-white/85">{landing.signup.asideCopy}</p>
            <Link
              href={landing.signup.asideCta.href}
              className="ink-on-light mt-5 inline-flex rounded-full bg-white px-5 py-2.5 text-sm font-bold"
            >
              {landing.signup.asideCta.label} <IconArrowRight size={14} />
            </Link>
            <div className="mt-6 flex -space-x-3">
              {recommended.slice(0, 4).map((item) => (
                <span key={item.slug} className="relative h-12 w-12 overflow-hidden rounded-full ring-2 ring-white">
                  <Image src={item.image} alt="" fill className="object-cover" sizes="48px" />
                </span>
              ))}
            </div>
          </aside>
        </div>
      </section>
    </div>
  );
}
