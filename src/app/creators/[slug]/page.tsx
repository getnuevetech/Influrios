import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { actionAddShortlist, actionSendInquiry } from "@/app/business/actions";
import { InfluencerCardView } from "@/components/creator-card";
import {
  formatFollowers,
  getCreatorBySlug,
  SEED_CREATORS,
  specialtyLabel,
} from "@/lib/seed-data";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props) {
  const { slug } = await params;
  const creator = getCreatorBySlug(slug);
  if (!creator) return { title: "Creator not found" };
  return { title: creator.displayName, description: creator.bio };
}

export default async function CreatorProfilePage({ params }: Props) {
  const { slug } = await params;
  const creator = getCreatorBySlug(slug);
  if (!creator) notFound();

  const related = SEED_CREATORS.filter((c) => c.slug !== creator.slug).slice(0, 4);
  const content = creator.featuredContent ?? [];
  const stats = creator.stats;
  const demo = creator.demographics;

  return (
    <div className="bg-[#F7FAFF]">
      {/* Hero banner */}
      <section className="relative overflow-hidden">
        <div className="relative h-56 sm:h-72 lg:h-80">
          <Image
            src={creator.coverImage ?? creator.image}
            alt=""
            fill
            className="object-cover"
            priority
            sizes="100vw"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#0B123F]/90 via-[#111A5A]/55 to-violet/30" />
          {creator.polaroids ? (
            <div className="absolute right-6 top-8 hidden gap-3 lg:flex">
              {creator.polaroids.map((p) => (
                <div
                  key={p.caption}
                  className="w-28 rotate-3 overflow-hidden rounded-lg bg-white p-1.5 shadow-xl first:-rotate-6 last:rotate-6"
                >
                  <div className="relative aspect-[3/4]">
                    <Image src={p.image} alt={p.caption} fill className="object-cover" sizes="112px" />
                  </div>
                  <p className="mt-1 px-0.5 text-[9px] font-semibold italic text-indigo">{p.caption}</p>
                </div>
              ))}
            </div>
          ) : null}
        </div>

        <div className="relative mx-auto -mt-20 max-w-6xl px-4 sm:-mt-24 sm:px-6">
          <div className="card-surface overflow-hidden p-5 sm:p-8">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
              <div className="relative mx-auto h-28 w-28 shrink-0 overflow-hidden rounded-full ring-4 ring-white shadow-lg sm:mx-0 sm:h-36 sm:w-36">
                <Image src={creator.image} alt={creator.displayName} fill className="object-cover" sizes="144px" />
              </div>
              <div className="flex-1 text-center lg:text-left">
                <div className="flex flex-wrap items-center justify-center gap-2 lg:justify-start">
                  <h1 className="font-display text-3xl font-bold text-indigo sm:text-4xl">
                    {creator.displayName}
                  </h1>
                  <span className="text-lg text-blue" aria-label="Verified">
                    ✓
                  </span>
                  <span className="rounded-full bg-lavender px-2.5 py-0.5 text-xs font-bold text-violet">
                    {creator.badge}
                  </span>
                </div>
                <p className="mt-1 text-lg font-medium text-muted">{creator.title}</p>
                <p className="mt-1 text-sm text-muted">
                  📍 {creator.locationCity}, {creator.locationCountry}
                </p>
                <p className="mx-auto mt-3 max-w-2xl text-muted lg:mx-0">{creator.bio}</p>
                <div className="mt-4 flex flex-wrap justify-center gap-2 lg:justify-start">
                  {creator.specialties.map((s) => (
                    <span key={s} className="chip">
                      {specialtyLabel(s)}
                    </span>
                  ))}
                </div>

                <div className="mt-5 flex flex-wrap justify-center gap-3 overflow-x-auto lg:justify-start">
                  {creator.socials.map((s) => (
                    <a
                      key={s.platform}
                      href={s.url}
                      target="_blank"
                      rel="noreferrer"
                      className="min-w-[5.5rem] rounded-xl border border-border bg-starter-bg px-3 py-2 text-center"
                    >
                      <p className="text-[10px] font-semibold uppercase text-muted">{s.platform}</p>
                      <p className="font-bold text-indigo">{formatFollowers(s.followers)}</p>
                    </a>
                  ))}
                </div>

                <div className="mt-6 flex flex-wrap justify-center gap-3 lg:justify-start">
                  <a href="#contact" className="btn-primary">
                    Contact
                  </a>
                  <form action={actionAddShortlist}>
                    <input type="hidden" name="slug" value={creator.slug} />
                    <input type="hidden" name="note" value="Saved from profile" />
                    <button type="submit" className="btn-secondary">
                      Add to Shortlist
                    </button>
                  </form>
                  <Link href={`/collaboration?from=${creator.slug}`} className="btn-secondary">
                    Invite to Collaborate
                  </Link>
                  <Link
                    href={`/collaboration?from=${creator.slug}&specialty=${creator.specialties[0] ?? ""}`}
                    className="btn-secondary"
                  >
                    Find Matches
                  </Link>
                  <Link href={`/c/${creator.slug}`} className="btn-secondary">
                    Share Card
                  </Link>
                  <Link href="/business" className="btn-secondary">
                    Business workspace
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:px-6 lg:grid-cols-[0.9fr_1.4fr]">
        <aside className="space-y-6">
          <div className="rounded-[1.5rem] bg-gradient-to-b from-lavender/80 to-white p-4 shadow-md">
            <InfluencerCardView creator={creator} />
          </div>
          <div className="card-surface p-5 text-sm">
            <h2 className="font-display text-lg font-bold text-indigo">Personal info</h2>
            <dl className="mt-4 space-y-3 text-muted">
              {creator.age ? (
                <div className="flex justify-between gap-3">
                  <dt>Age</dt>
                  <dd className="font-semibold text-indigo">{creator.age}</dd>
                </div>
              ) : null}
              <div className="flex justify-between gap-3">
                <dt>Location</dt>
                <dd className="font-semibold text-indigo">
                  {creator.locationCity}, {creator.locationCountry}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt>Languages</dt>
                <dd className="font-semibold text-indigo">{creator.languages.join(", ")}</dd>
              </div>
              {creator.email ? (
                <div className="flex justify-between gap-3">
                  <dt>Email</dt>
                  <dd className="font-semibold text-indigo">{creator.email}</dd>
                </div>
              ) : null}
            </dl>
          </div>
        </aside>

        <div className="space-y-8">
          {stats ? (
            <section>
              <h2 className="font-display text-xl font-bold text-indigo">Key stats · Last 30 days</h2>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {[
                  ["Engagement Rate", stats.engagementRate, stats.engagementDelta],
                  ["Total Reach", stats.totalReach, stats.reachDelta],
                  ["Average Views", stats.avgViews, stats.viewsDelta],
                  ["Collaborations", stats.collaborations, stats.collabDelta],
                ].map(([label, value, delta]) => (
                  <div key={label} className="card-surface p-4">
                    <p className="text-xs font-semibold uppercase text-muted">{label}</p>
                    <p className="mt-1 font-display text-2xl font-bold text-indigo">{value}</p>
                    <p className="mt-1 text-xs font-semibold text-emerald-600">{delta}</p>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          <section id="contact" className="card-surface p-6">
            <h2 className="font-display text-xl font-bold text-indigo">About {creator.displayName.split(" ")[0]}</h2>
            <p className="mt-3 leading-relaxed text-muted">{creator.bio}</p>
            {(creator.offer || creator.need) && (
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                {creator.offer ? (
                  <div className="rounded-xl bg-starter-bg p-4">
                    <p className="text-xs font-semibold uppercase text-muted">I can offer</p>
                    <p className="mt-1 font-medium text-indigo">{creator.offer}</p>
                  </div>
                ) : null}
                {creator.need ? (
                  <div className="rounded-xl bg-lavender/50 p-4">
                    <p className="text-xs font-semibold uppercase text-muted">Looking for</p>
                    <p className="mt-1 font-medium text-indigo">{creator.need}</p>
                  </div>
                ) : null}
              </div>
            )}
            <form action={actionSendInquiry} className="mt-6 space-y-3 border-t border-border pt-5">
              <p className="text-sm font-semibold text-indigo">Send a business inquiry</p>
              <input type="hidden" name="creatorSlug" value={creator.slug} />
              <textarea
                name="message"
                required
                rows={3}
                defaultValue={`Hi ${creator.displayName.split(" ")[0]} — we'd love to explore a collaboration.`}
                className="w-full rounded-xl border border-border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-violet"
              />
              <button type="submit" className="btn-primary !py-2 text-sm">
                Send inquiry →
              </button>
            </form>
          </section>

          {content.length > 0 ? (
            <section>
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <h2 className="font-display text-xl font-bold text-indigo">Featured content</h2>
                <div className="flex flex-wrap gap-2">
                  {["All", "Beauty", "Lifestyle", "Travel", "Fashion", "Brand Collaborations"].map((t) => (
                    <span
                      key={t}
                      className={`rounded-full px-3 py-1 text-xs font-semibold ${
                        t === "All" ? "bg-violet text-white" : "bg-white text-muted ring-1 ring-border"
                      }`}
                    >
                      {t}
                    </span>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {content.map((item) => (
                  <article key={item.id} className="group relative aspect-square overflow-hidden rounded-2xl">
                    <Image
                      src={item.image}
                      alt={item.category}
                      fill
                      className="object-cover transition duration-500 group-hover:scale-105"
                      sizes="33vw"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/75 to-transparent" />
                    <div className="absolute bottom-2 left-2 right-2 text-white">
                      <p className="text-[10px] font-semibold uppercase opacity-80">{item.platform}</p>
                      <p className="text-xs font-bold">
                        {item.views} views · {item.likes} likes
                      </p>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          ) : null}

          {demo ? (
            <section className="grid gap-6 lg:grid-cols-2">
              <div className="card-surface p-5">
                <h2 className="font-display text-lg font-bold text-indigo">Audience demographics</h2>
                <div className="mt-4 flex items-center gap-4">
                  <div
                    className="h-28 w-28 rounded-full"
                    style={{
                      background: `conic-gradient(#633CFF 0 ${demo.female}%, #2979FF ${demo.female}% 100%)`,
                    }}
                    aria-hidden
                  />
                  <div className="text-sm">
                    <p>
                      <span className="font-bold text-violet">{demo.female}%</span> Female
                    </p>
                    <p className="mt-1">
                      <span className="font-bold text-blue">{demo.male}%</span> Male
                    </p>
                  </div>
                </div>
                <div className="mt-5 space-y-2">
                  <p className="text-xs font-semibold uppercase text-muted">Top locations</p>
                  {demo.locations.map((loc) => (
                    <div key={loc.name}>
                      <div className="mb-1 flex justify-between text-xs">
                        <span>{loc.name}</span>
                        <span className="font-semibold">{loc.pct}%</span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-lavender">
                        <div className="h-full rounded-full bg-violet" style={{ width: `${loc.pct * 3}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-5 space-y-2">
                  <p className="text-xs font-semibold uppercase text-muted">Age range</p>
                  {demo.ages.map((a) => (
                    <div key={a.range} className="flex items-center gap-2 text-xs">
                      <span className="w-12 text-muted">{a.range}</span>
                      <div className="h-2 flex-1 overflow-hidden rounded-full bg-lavender">
                        <div className="h-full rounded-full bg-blue" style={{ width: `${a.pct * 2.2}%` }} />
                      </div>
                      <span className="w-8 font-semibold">{a.pct}%</span>
                    </div>
                  ))}
                </div>
              </div>

              {creator.collabPrefs ? (
                <div className="card-surface p-5">
                  <h2 className="font-display text-lg font-bold text-indigo">Collaboration preferences</h2>
                  <div className="mt-4 grid grid-cols-2 gap-3">
                    {creator.collabPrefs.map((p) => (
                      <div
                        key={p}
                        className="rounded-xl border border-border bg-starter-bg px-3 py-4 text-center text-sm font-semibold text-indigo"
                      >
                        {p}
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </section>
          ) : null}
        </div>
      </div>

      {/* Related */}
      <section className="mx-auto max-w-6xl px-4 pb-16 sm:px-6">
        <h2 className="mb-6 font-display text-2xl font-bold text-indigo">You might also like</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {related.map((c) => (
            <Link
              key={c.slug}
              href={`/creators/${c.slug}`}
              className="card-surface flex items-center gap-3 p-3 transition hover:-translate-y-0.5"
            >
              <span className="relative h-14 w-14 overflow-hidden rounded-full">
                <Image src={c.image} alt={c.displayName} fill className="object-cover" sizes="56px" />
              </span>
              <div className="min-w-0">
                <p className="truncate font-bold text-indigo">{c.displayName}</p>
                <p className="truncate text-xs text-muted">{c.title}</p>
                <p className="text-xs text-muted">
                  {c.locationCity}, {c.locationCountry}
                </p>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
