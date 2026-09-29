import Link from "next/link";
import { notFound } from "next/navigation";
import {
  formatFollowers,
  getCreatorBySlug,
  specialtyLabel,
} from "@/lib/seed-data";
import { getEntitlements, type PlanCode } from "@/lib/entitlements";

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

  const entitlements = getEntitlements(creator.planTier as PlanCode);

  return (
    <div>
      <section
        className="relative px-4 pb-16 pt-16 text-white sm:px-6"
        style={{
          background: `linear-gradient(135deg, ${creator.avatarColor} 0%, #0b123f 70%)`,
        }}
      >
        <div className="mx-auto max-w-6xl">
          <p className="text-sm font-semibold uppercase tracking-wider text-white/70">
            Influence Profile
          </p>
          <h1 className="mt-2 font-display text-4xl font-bold sm:text-5xl">{creator.displayName}</h1>
          <p className="mt-2 text-lg text-white/85">{creator.title}</p>
          <p className="mt-1 text-white/70">
            {creator.locationCity}, {creator.locationCountry} · {creator.languages.join(", ")}
          </p>
          <p className="mt-4 max-w-2xl text-white/80">{creator.bio}</p>
          <div className="mt-5 flex flex-wrap gap-2">
            {creator.specialties.map((s) => (
              <span key={s} className="rounded-full bg-white/15 px-3 py-1 text-sm font-semibold">
                {specialtyLabel(s)}
              </span>
            ))}
          </div>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href={`/c/${creator.slug}`} className="rounded-full bg-white px-5 py-3 text-sm font-bold text-violet">
              Share Card
            </Link>
            <a href="#contact" className="rounded-full border border-white/40 px-5 py-3 text-sm font-bold">
              Contact
            </a>
            {creator.openToCollab ? (
              <Link
                href="/collaboration"
                className="rounded-full border border-white/40 px-5 py-3 text-sm font-bold"
              >
                Invite to Collaborate
              </Link>
            ) : null}
          </div>
        </div>
      </section>

      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:px-6 lg:grid-cols-[1fr_1.4fr]">
        <aside className="card-surface h-fit p-5">
          <h2 className="font-display text-lg font-bold text-indigo">Social reach</h2>
          <ul className="mt-4 space-y-3">
            {creator.socials.map((s) => (
              <li key={s.platform} className="flex items-center justify-between text-sm">
                <a href={s.url} className="font-semibold text-blue hover:underline" target="_blank" rel="noreferrer">
                  {s.platform}
                </a>
                <span className="font-bold text-indigo">{formatFollowers(s.followers)}</span>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-xs text-muted">
            Metrics are creator-claimed unless marked platform-verified. Plan: {creator.planTier}.
          </p>
          <div className="mt-4 rounded-xl bg-lavender/50 p-3 text-xs text-indigo">
            Entitlements: {entitlements.specialtiesMax} specialties · {entitlements.socialLinksMax}{" "}
            socials · QR {entitlements.standardQr || entitlements.dynamicQr ? "on" : "off"}
          </div>
        </aside>

        <div className="space-y-6">
          <section className="card-surface p-6" id="contact">
            <h2 className="font-display text-xl font-bold text-indigo">About & commercial fit</h2>
            <p className="mt-3 text-muted">{creator.bio}</p>
            <dl className="mt-6 grid gap-4 sm:grid-cols-2">
              <div>
                <dt className="text-xs font-semibold uppercase text-muted">Availability</dt>
                <dd className="font-medium text-indigo">
                  {creator.openToCollab ? "Open to partnerships" : "Not available"}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase text-muted">Plan</dt>
                <dd className="font-medium text-indigo">{creator.planTier}</dd>
              </div>
            </dl>
          </section>

          {(creator.offer || creator.need) && (
            <section className="card-surface p-6">
              <h2 className="font-display text-xl font-bold text-indigo">Collaboration</h2>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                {creator.offer ? (
                  <div className="rounded-xl bg-starter-bg p-4">
                    <p className="text-xs font-semibold uppercase text-muted">I can offer</p>
                    <p className="mt-1 font-medium text-indigo">{creator.offer}</p>
                  </div>
                ) : null}
                {creator.need ? (
                  <div className="rounded-xl bg-lavender/40 p-4">
                    <p className="text-xs font-semibold uppercase text-muted">I am looking for</p>
                    <p className="mt-1 font-medium text-indigo">{creator.need}</p>
                  </div>
                ) : null}
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
