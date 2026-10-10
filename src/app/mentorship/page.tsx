import Image from "next/image";
import Link from "next/link";
import {
  actionBecomeMentor,
  actionCancelMentorship,
  actionRequestMentor,
  actionRespondMentorship,
} from "@/app/mentorship/actions";
import { IconArrowRight, IconCheck, IconUsers } from "@/components/icons";
import { getAccountSession } from "@/lib/accounts";
import { getCreatorSessionDraft } from "@/lib/claim";
import { prisma } from "@/lib/db";
import {
  EXPERIENCE_BAND_LABELS,
  evaluateCreatorMentorshipEligibility,
  listMentorshipInbox,
  listOpenMentors,
  paidMentoringEnabled,
} from "@/lib/mentorship";
import { formatFollowers } from "@/lib/seed-data";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Influencer Mentorship",
};

type Props = {
  searchParams: Promise<{
    niche?: string;
    country?: string;
    error?: string;
    mentor?: string;
    requested?: string;
    responded?: string;
    cancelled?: string;
    returned?: string;
  }>;
};

export default async function MentorshipPage({ searchParams }: Props) {
  const params = await searchParams;
  const account = await getAccountSession().catch(() => null);
  const draft = account ? await getCreatorSessionDraft().catch(() => null) : null;
  const me = draft?.slug
    ? await prisma.creator.findUnique({ where: { slug: draft.slug } }).catch(() => null)
    : null;

  const [mentors, paidOn, eligibility, inbox] = await Promise.all([
    listOpenMentors({ niche: params.niche, country: params.country }).catch(() => []),
    paidMentoringEnabled().catch(() => false),
    me ? evaluateCreatorMentorshipEligibility(me.id).catch(() => null) : Promise.resolve(null),
    me ? listMentorshipInbox(me.id).catch(() => null) : Promise.resolve(null),
  ]);

  return (
    <div className="bg-[#F4F7FF]">
      <section className="border-b border-[#E4E9F5] bg-gradient-to-br from-[#F7F4FF] via-white to-[#EEF5FF]">
        <div className="mx-auto max-w-[90rem] px-4 py-14 sm:px-6 lg:px-10">
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-violet">Mentor–Mentee Network</p>
          <h1 className="mt-2 font-display text-4xl font-bold text-indigo sm:text-5xl">
            Influrios Influencer Mentorship
          </h1>
          <p className="mt-4 max-w-2xl text-sm text-muted sm:text-base">
            Emerging Influencers learn from Experienced Influencer Mentors. Community mentoring is live;
            paid mentoring stays behind a feature flag and never mixes into collaboration holding funds.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <a href="#find" className="btn-primary">
              Find an Influencer Mentor <IconArrowRight size={14} />
            </a>
            <a href="#become" className="btn-secondary">
              Become an Influrios Influencer Mentor
            </a>
            <Link href="/collaboration" className="btn-secondary">
              Back to Collaborations
            </Link>
          </div>
          {!paidOn ? (
            <p className="mt-4 text-xs font-semibold text-violet">
              Paid mentoring is off — all sessions are community/free.
            </p>
          ) : (
            <p className="mt-4 text-xs font-semibold text-amber-800">
              Paid mentoring flag is on for testing — funds still stay outside Collaboration Holding.
            </p>
          )}
        </div>
      </section>

      {(params.error || params.mentor || params.requested || params.responded || params.cancelled || params.returned) && (
        <div className="mx-auto max-w-[90rem] px-4 pt-6 sm:px-6 lg:px-10">
          {params.error ? (
            <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900">
              {params.error}
            </p>
          ) : (
            <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">
              {params.returned
                ? "Checkout returned. The session stays unconfirmed until the payment webhook."
                : params.mentor
                  ? "Mentor profile saved. You are listed when availability is open."
                  : params.requested
                    ? "Mentorship request sent."
                    : params.responded
                      ? `Request ${params.responded}.`
                      : "Request cancelled."}
            </p>
          )}
        </div>
      )}

      <section id="find" className="mx-auto max-w-[90rem] space-y-4 px-4 py-10 sm:px-6 lg:px-10">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="font-display text-2xl font-bold text-indigo">Find an Influencer Mentor</h2>
            <p className="mt-1 text-sm text-muted">
              Filter by niche or country. Mentors must pass admin eligibility from Collaboration ops.
            </p>
          </div>
          <form className="flex flex-wrap gap-2">
            <input
              name="niche"
              defaultValue={params.niche}
              placeholder="Niche"
              className="rounded-xl border border-border px-3 py-2 text-sm"
            />
            <input
              name="country"
              defaultValue={params.country}
              placeholder="Country"
              className="rounded-xl border border-border px-3 py-2 text-sm"
            />
            <button type="submit" className="btn-primary !px-4 !py-2 text-xs">
              Filter
            </button>
          </form>
        </div>

        {mentors.length === 0 ? (
          <p className="text-sm text-muted">No open mentors yet. Be the first — apply below.</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {mentors.map((mentor) => (
              <article key={mentor.profileId} className="rounded-2xl border border-[#E4E9F5] bg-white p-4 shadow-sm">
                <div className="flex gap-3">
                  <span className="relative h-12 w-12 overflow-hidden rounded-full bg-lavender">
                    {mentor.avatarUrl ? (
                      <Image src={mentor.avatarUrl} alt="" fill className="object-cover" sizes="48px" />
                    ) : (
                      <span className="flex h-full w-full items-center justify-center text-violet">
                        <IconUsers size={18} />
                      </span>
                    )}
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-indigo">{mentor.displayName}</p>
                    <p className="text-[11px] text-violet">
                      {EXPERIENCE_BAND_LABELS[mentor.band]} · {formatFollowers(mentor.followers)}
                    </p>
                    {mentor.locationCountry || mentor.niches.length ? (
                      <p className="text-[11px] text-muted">
                        {[mentor.locationCountry, mentor.niches.slice(0, 3).join(", ")].filter(Boolean).join(" · ")}
                      </p>
                    ) : null}
                  </div>
                </div>
                {mentor.headline ? <p className="mt-3 text-sm text-indigo">{mentor.headline}</p> : null}
                {mentor.boundaries ? <p className="mt-1 text-xs text-muted">{mentor.boundaries}</p> : null}
                {me && me.id !== mentor.creatorId ? (
                  <form action={actionRequestMentor} className="mt-4 space-y-2">
                    <input type="hidden" name="mentorCreatorId" value={mentor.creatorId} />
                    <textarea
                      name="message"
                      rows={2}
                      placeholder="What do you want help with?"
                      className="w-full rounded-xl border border-border px-3 py-2 text-sm"
                    />
                    {paidOn ? (
                      <label className="flex items-center gap-2 text-xs text-indigo">
                        <input type="checkbox" name="paidRequested" value="1" />
                        Request a paid session. Checkout does not use collaboration holding, and the session stays unconfirmed until the payment webhook.
                      </label>
                    ) : null}
                    <button type="submit" className="btn-primary w-full !py-2 text-xs">
                      Request mentorship
                    </button>
                  </form>
                ) : !account ? (
                  <Link
                    href={`/login?next=${encodeURIComponent("/mentorship#find")}`}
                    className="btn-secondary mt-4 inline-flex w-full justify-center !py-2 text-xs"
                  >
                    Sign in to request
                  </Link>
                ) : null}
              </article>
            ))}
          </div>
        )}
      </section>

      <section id="become" className="mx-auto max-w-[90rem] px-4 pb-10 sm:px-6 lg:px-10">
        <div className="rounded-2xl border border-[#E4E9F5] bg-white p-6 shadow-sm">
          <h2 className="font-display text-2xl font-bold text-indigo">Become an Influrios Influencer Mentor</h2>
          <p className="mt-1 text-sm text-muted">
            Experienced Influencers who pass admin eligibility can open availability for Emerging Influencers.
          </p>
          {!me ? (
            <Link href={`/login?next=${encodeURIComponent("/mentorship#become")}`} className="btn-primary mt-4 inline-flex">
              Sign in to apply <IconArrowRight size={14} />
            </Link>
          ) : (
            <>
              {eligibility && !eligibility.ok ? (
                <ul className="mt-4 list-disc space-y-1 pl-5 text-sm text-amber-900">
                  {eligibility.blockers.map((b) => (
                    <li key={b}>{b}</li>
                  ))}
                </ul>
              ) : null}
              {eligibility?.ok ? (
                <p className="mt-3 text-xs font-semibold text-emerald-700">
                  Eligible as {EXPERIENCE_BAND_LABELS[eligibility.band]} · {formatFollowers(eligibility.followers)}{" "}
                  followers
                </p>
              ) : null}
              <form action={actionBecomeMentor} className="mt-4 grid gap-3 sm:grid-cols-2">
                <label className="text-xs font-semibold text-muted sm:col-span-2">
                  Headline
                  <input
                    name="headline"
                    defaultValue={inbox?.profile?.headline ?? ""}
                    placeholder="e.g. Beauty + short-form storytelling"
                    className="mt-1 w-full rounded-xl border border-border px-3 py-2 text-sm text-indigo"
                  />
                </label>
                <label className="text-xs font-semibold text-muted sm:col-span-2">
                  Boundaries / availability notes
                  <textarea
                    name="boundaries"
                    rows={3}
                    defaultValue={inbox?.profile?.boundaries ?? ""}
                    placeholder="Office hours, topics you won’t cover, response time…"
                    className="mt-1 w-full rounded-xl border border-border px-3 py-2 text-sm text-indigo"
                  />
                </label>
                <label className="text-xs font-semibold text-muted">
                  Niches (comma-separated)
                  <input
                    name="niches"
                    defaultValue={
                      Array.isArray(inbox?.profile?.nichesJson)
                        ? (inbox?.profile?.nichesJson as string[]).join(", ")
                        : ""
                    }
                    className="mt-1 w-full rounded-xl border border-border px-3 py-2 text-sm text-indigo"
                  />
                </label>
                <label className="text-xs font-semibold text-muted">
                  Availability
                  <select
                    name="availability"
                    required
                    defaultValue={inbox?.profile?.availability ?? ""}
                    className="mt-1 w-full rounded-xl border border-border px-3 py-2 text-sm text-indigo"
                  >
                    <option value="">Choose availability</option>
                    <option value="open">Open</option>
                    <option value="paused">Paused</option>
                    <option value="closed">Closed</option>
                  </select>
                </label>
                <label className="text-xs font-semibold text-muted">
                  Max active mentees
                  <input
                    name="maxActiveMentees"
                    type="number"
                    min={1}
                    max={20}
                    required
                    defaultValue={inbox?.profile?.maxActiveMentees ?? ""}
                    className="mt-1 w-full rounded-xl border border-border px-3 py-2 text-sm text-indigo"
                  />
                </label>
                <div className="sm:col-span-2">
                  <button
                    type="submit"
                    className="btn-primary !px-4 !py-2 text-sm"
                    disabled={Boolean(eligibility && !eligibility.ok)}
                  >
                    Save mentor profile
                  </button>
                </div>
              </form>
            </>
          )}
        </div>
      </section>

      {inbox ? (
        <section id="inbox" className="mx-auto max-w-[90rem] space-y-4 px-4 pb-14 sm:px-6 lg:px-10">
          <h2 className="font-display text-2xl font-bold text-indigo">Your mentorship inbox</h2>
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-2xl border border-[#E4E9F5] bg-white p-4 shadow-sm">
              <h3 className="font-display text-base font-bold text-indigo">Incoming requests</h3>
              {inbox.incoming.length === 0 ? (
                <p className="mt-2 text-sm text-muted">No requests yet.</p>
              ) : (
                <ul className="mt-3 space-y-3">
                  {inbox.incoming.map((row) => (
                    <li key={row.id} className="rounded-xl bg-[#F4F7FF] p-3 text-sm">
                      <p className="font-semibold text-indigo">
                        {row.mentee.displayName} · <span className="capitalize text-muted">{row.status}</span>
                      </p>
                      {row.message ? <p className="mt-1 text-xs text-muted">{row.message}</p> : null}
                      {row.paidRequested ? (
                        <p className="mt-1 text-xs text-muted">
                          Paid session ·{" "}
                          {row.paymentStatus === "paid"
                            ? "confirmed by the payment webhook"
                            : "waiting for the payment webhook"}
                        </p>
                      ) : null}
                      {row.status === "pending" ? (
                        <div className="mt-2 flex flex-wrap gap-2">
                          {!row.paidRequested || row.paymentStatus === "paid" ? (
                            <form action={actionRespondMentorship}>
                              <input type="hidden" name="requestId" value={row.id} />
                              <input type="hidden" name="decision" value="accepted" />
                              <button type="submit" className="btn-primary !px-3 !py-1.5 text-[11px]">
                                Accept
                              </button>
                            </form>
                          ) : null}
                          <form action={actionRespondMentorship} className="flex gap-2">
                            <input type="hidden" name="requestId" value={row.id} />
                            <input type="hidden" name="decision" value="declined" />
                            <input
                              name="responseNote"
                              placeholder="Optional note"
                              className="rounded-lg border border-border px-2 py-1 text-[11px]"
                            />
                            <button type="submit" className="btn-secondary !px-3 !py-1.5 text-[11px]">
                              Decline
                            </button>
                          </form>
                        </div>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="rounded-2xl border border-[#E4E9F5] bg-white p-4 shadow-sm">
              <h3 className="font-display text-base font-bold text-indigo">Your outgoing requests</h3>
              {inbox.outgoing.length === 0 ? (
                <p className="mt-2 text-sm text-muted">You have not requested a mentor yet.</p>
              ) : (
                <ul className="mt-3 space-y-3">
                  {inbox.outgoing.map((row) => (
                    <li key={row.id} className="rounded-xl bg-[#F4F7FF] p-3 text-sm">
                      <p className="font-semibold text-indigo">
                        {row.mentor.displayName} · <span className="capitalize text-muted">{row.status}</span>
                      </p>
                      {row.paidRequested ? (
                        <p className="mt-1 text-xs text-muted">
                          Paid session ·{" "}
                          {row.paymentStatus === "paid"
                            ? "confirmed by the payment webhook"
                            : params.returned
                              ? "checkout returned; still waiting for the payment webhook"
                              : "waiting for the payment webhook"}
                        </p>
                      ) : null}
                      {row.status === "pending" ? (
                        <form action={actionCancelMentorship} className="mt-2">
                          <input type="hidden" name="requestId" value={row.id} />
                          <button type="submit" className="btn-secondary !px-3 !py-1.5 text-[11px]">
                            Cancel request
                          </button>
                        </form>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </section>
      ) : null}

      <section className="mx-auto max-w-[90rem] px-4 pb-14 sm:px-6 lg:px-10">
        <div className="rounded-2xl border border-[#E4E9F5] bg-white p-6 shadow-sm">
          <h2 className="font-display text-xl font-bold text-indigo">Money isolation</h2>
          <ul className="mt-3 space-y-2 text-sm text-muted">
            {[
              "Community mentoring never creates Collaboration Holding ledger entries.",
              "Paid mentoring requires the paid_mentoring product switch and still stays outside collab holding in this module.",
              "Eligibility thresholds are admin-configurable under Collaboration operations.",
            ].map((item) => (
              <li key={item} className="flex items-start gap-2">
                <IconCheck size={14} className="mt-0.5 shrink-0 text-violet" />
                {item}
              </li>
            ))}
          </ul>
        </div>
      </section>
    </div>
  );
}
