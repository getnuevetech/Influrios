import Link from "next/link";
import { redirect } from "next/navigation";
import { PublicInfluencerCard } from "@/components/public-influencer-card";
import { getAccountSession } from "@/lib/accounts";
import { completenessFor, draftToSeedCreator, getCreatorSessionDraft } from "@/lib/claim";
import { loadCreatorHub } from "@/lib/collaboration-hub";
import { prisma } from "@/lib/db";
import { formatMoney } from "@/lib/money";
import { formatFollowers } from "@/lib/seed-data";
import { primaryShortHost } from "@/lib/short-link";

export const dynamic = "force-dynamic";
export const metadata = { title: "Creator account" };

export default async function CreatorHomePage({
  searchParams,
}: {
  searchParams: Promise<{ welcome?: string; published?: string }>;
}) {
  const params = await searchParams;
  const account = await getAccountSession();
  if (!account) redirect("/login?next=/creator");
  const [creator, draft, host] = await Promise.all([
    prisma.creator
      .findUnique({
        where: { userId: account.id },
        include: {
          socialAccounts: { orderBy: { platform: "asc" } },
          specialties: { include: { specialty: { select: { name: true } } } },
          payoutProfile: { select: { stripeConnectAccountId: true, providerConnectedAccountId: true } },
          shortLinks: { where: { status: { not: "archived" } }, take: 1, select: { id: true, slug: true } },
          card: { select: { id: true } },
        },
      })
      .catch(() => null),
    getCreatorSessionDraft().catch(() => null),
    primaryShortHost().catch(() => "inflr.me"),
  ]);
  const shortLink = creator?.shortLinks[0] ?? null;
  const [visits, inquiries] = creator
    ? await Promise.all([
        shortLink
          ? prisma.shortLinkEvent
              .count({
                where: {
                  shortLinkId: shortLink.id,
                  eventType: { in: ["resolve", "qr_scan", "alias_redirect", "nfc_tap", "campaign_redirect"] },
                },
              })
              .catch(() => 0)
          : Promise.resolve(0),
        prisma.businessInquiry.count({ where: { creatorSlug: creator.slug } }).catch(() => 0),
      ])
    : [0, 0];

  const seed = draft ? draftToSeedCreator(draft) : null;
  const hub =
    creator && seed
      ? await loadCreatorHub({ userId: account.id, creator: seed }).catch(() => null)
      : null;
  const completion = draft ? completenessFor(draft) : null;
  const incomplete = Boolean(completion && completion.score < 100);
  const doneCount = completion?.items.filter((item) => item.done).length ?? 0;
  const totalCount = completion?.items.length ?? 0;
  const today = new Date().toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  const payoutReady = Boolean(
    creator?.payoutProfile?.stripeConnectAccountId ||
      creator?.payoutProfile?.providerConnectedAccountId ||
      hub?.payout.readiness?.globalPayoutReady ||
      hub?.payout.readiness?.hasVerifiedMethod,
  );
  const earningsCents = hub?.earnings.releasedCents ?? 0;
  const earningsCurrency = hub?.earnings.currency || "USD";
  const activeCollabs = hub?.status.active ?? 0;
  const opportunityCount = hub?.brandMatches.length ?? hub?.requests.length ?? 0;
  const displayName = creator?.displayName || draft?.displayName || account.name || "Creator";
  const slug = creator?.slug || draft?.slug || "";
  const bio = (creator?.bio || draft?.bio || "").trim();
  const title = (creator?.title || draft?.title || "").trim();
  const specialties =
    creator?.specialties.map((row) => row.specialty.name) ??
    draft?.specialties.map((item) => item) ??
    [];
  const avatar = creator?.avatarUrl || draft?.image || null;
  const socials = creator?.socialAccounts ?? [];
  const cardHref = slug ? `/c/${slug}` : "/claim";
  const profileHref = draft ? "/dashboard" : "/claim";

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold">Creator account</h1>
          <p className="mt-1 text-sm text-muted">
            Welcome back{account.name ? `, ${account.name.split(" ")[0]}` : ""}. Here&apos;s what&apos;s happening with
            your creator journey.
          </p>
        </div>
        <p className="text-xs font-semibold text-muted">{today}</p>
      </div>

      {params.published ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          Your Starter card is live
          {slug ? (
            <>
              {" "}
              at{" "}
              <Link href={cardHref} className="font-semibold underline">
                /c/{slug}
              </Link>
            </>
          ) : null}
          .
        </div>
      ) : null}

      {incomplete ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          <div>
            <p className="font-semibold">Complete your profile ({completion?.score ?? 0}%)</p>
            <p className="text-amber-900/80">
              {params.welcome
                ? "Your account is ready. Finish the remaining profile steps so brands can find you."
                : "A few profile details are still missing."}
            </p>
          </div>
          <Link href={profileHref} className="btn-primary !py-2 text-sm">
            Edit profile
          </Link>
        </div>
      ) : null}

      {!creator && !draft ? (
        <section className="rounded-3xl border border-[#E6ECF7] bg-white p-6">
          <h2 className="font-display text-xl font-bold">Create your influencer card</h2>
          <p className="mt-2 max-w-xl text-sm text-muted">
            Your email is verified and this account is active. Start a card whenever you are ready — profile completion is
            separate from account access.
          </p>
          <Link href="/claim" className="btn-primary mt-4">
            Get started free
          </Link>
        </section>
      ) : (
        <>
          <section className="grid gap-4 xl:grid-cols-[minmax(0,1.45fr)_minmax(18rem,0.85fr)]">
            <div className="rounded-3xl border border-[#E6ECF7] bg-white p-5">
              <div className="flex flex-wrap items-start gap-4">
                <span className="relative inline-flex h-20 w-20 overflow-hidden rounded-full bg-[#EDE7FF] text-xl font-bold text-violet">
                  {avatar ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={avatar} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <span className="flex h-full w-full items-center justify-center">{displayName.slice(0, 1)}</span>
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <h2 className="font-display text-2xl font-bold">{displayName}</h2>
                  {slug ? <p className="text-sm text-muted">@{slug}</p> : null}
                  {title ? <p className="mt-1 text-sm text-indigo/80">{title}</p> : null}
                  {bio && !bio.includes("Draft Influencer") ? (
                    <p className="mt-2 line-clamp-2 text-sm text-muted">{bio}</p>
                  ) : (
                    <p className="mt-2 text-sm text-muted">Add a short bio so brands know what you create.</p>
                  )}
                  <div className="mt-3 flex flex-wrap gap-2">
                    {specialties.length ? (
                      specialties.slice(0, 6).map((name) => (
                        <span
                          key={name}
                          className="rounded-full bg-[#E8F0FF] px-2.5 py-1 text-xs font-semibold text-[#2F5FD0]"
                        >
                          {name}
                        </span>
                      ))
                    ) : (
                      <span className="text-xs text-muted">No niche tags yet</span>
                    )}
                  </div>
                  {completion ? (
                    <div className="mt-4 max-w-sm">
                      <div className="flex items-center justify-between text-xs font-semibold">
                        <span>Profile completion</span>
                        <span>{completion.score}%</span>
                      </div>
                      <div className="mt-2 h-2 rounded-full bg-[#EEF2FA]">
                        <div className="h-2 rounded-full bg-violet" style={{ width: `${completion.score}%` }} />
                      </div>
                      <p className="mt-2 text-xs text-muted">Complete your profile to unlock more brand opportunities.</p>
                    </div>
                  ) : null}
                </div>
                <div className="flex w-full flex-col gap-2 sm:w-44">
                  <Link href={profileHref} className="btn-primary !py-2 text-center text-sm">
                    Edit profile
                  </Link>
                  <Link href={cardHref} className="btn-secondary !py-2 text-center text-sm">
                    Share Influrios Card
                  </Link>
                  <Link href="/dashboard#socials" className="btn-secondary !py-2 text-center text-sm">
                    Connect socials
                  </Link>
                </div>
              </div>
            </div>

            <div className="rounded-3xl border border-[#E6ECF7] bg-white p-5">
              <div className="flex items-center justify-between gap-2">
                <h2 className="font-display text-lg font-bold">My INFLR.me Card</h2>
                {shortLink ? (
                  <button
                    type="button"
                    className="text-xs font-semibold text-violet"
                    data-copy={`${host}/${shortLink.slug}`}
                  >
                    {host}/{shortLink.slug}
                  </button>
                ) : (
                  <span className="text-xs text-muted">Short link after publish + plan</span>
                )}
              </div>
              <div className="mt-3 scale-[0.92] origin-top">
                {seed ? (
                  <PublicInfluencerCard creator={seed} qrDisplay="default" hideCta draftPreview={draft?.stage !== "published"} />
                ) : (
                  <p className="text-sm text-muted">Card preview appears after your profile draft exists.</p>
                )}
              </div>
            </div>
          </section>

          <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Stat label="Profile views" value={String(visits)} note="Short link, QR, and NFC visits on this card." />
            <Stat
              label="Opportunity invites"
              value={String(Math.max(inquiries, opportunityCount))}
              note="Business inquiries plus scored brand requests."
            />
            <Stat label="Active collaborations" value={String(activeCollabs)} note="Accepted collaboration records." />
            <Stat
              label="Earnings this month"
              value={formatMoney(earningsCents, earningsCurrency)}
              note="Released milestone totals from the ledger — not estimates."
            />
          </section>

          <section className="grid gap-4 lg:grid-cols-3">
            <div className="rounded-3xl border border-[#E6ECF7] bg-white p-5">
              <div className="flex items-center justify-between">
                <h2 className="font-display text-lg font-bold">Connected social profiles</h2>
                <Link href="/dashboard#socials" className="text-xs font-semibold text-violet">
                  Manage
                </Link>
              </div>
              {socials.length === 0 ? (
                <p className="mt-3 text-sm text-muted">No social profile is saved on this card yet.</p>
              ) : null}
              <ul className="mt-3 space-y-3">
                {socials.map((social) => (
                  <li key={social.id} className="flex items-center justify-between gap-3 text-sm">
                    <span>
                      <span className="font-semibold capitalize">{social.platform.toLowerCase()}</span>
                      <span className="mt-0.5 block text-xs text-muted">
                        {social.handle}
                        {typeof social.followers === "number" ? ` · ${formatFollowers(social.followers)} followers` : ""}
                      </span>
                    </span>
                    <span className="text-xs font-semibold text-emerald-700">Connected</span>
                  </li>
                ))}
              </ul>
            </div>

            <div id="media-kit" className="rounded-3xl border border-[#E6ECF7] bg-white p-5">
              <div className="flex items-center justify-between gap-2">
                <h2 className="font-display text-lg font-bold">Media kit</h2>
                <span className="rounded-full bg-[#EEF2FA] px-2.5 py-1 text-[11px] font-semibold text-muted">
                  Not published
                </span>
              </div>
              <p className="mt-3 text-sm text-muted">
                A dedicated media-kit editor is not available yet. Use your public card and profile photos until that
                surface ships.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Link href={cardHref} className="btn-secondary !py-2 text-sm">
                  View public card
                </Link>
                <Link href="/dashboard" className="text-sm font-semibold text-violet hover:underline">
                  Edit profile media
                </Link>
              </div>
            </div>

            <div className="rounded-3xl border border-[#E6ECF7] bg-white p-5">
              <div className="flex items-center justify-between gap-2">
                <h2 className="font-display text-lg font-bold">Payout status</h2>
                <span
                  className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                    payoutReady ? "bg-emerald-50 text-emerald-700" : "bg-[#EEF2FA] text-muted"
                  }`}
                >
                  {payoutReady ? "Payout ready" : "Not set up"}
                </span>
              </div>
              <ul className="mt-3 space-y-2 text-sm">
                <CheckRow
                  done={Boolean(hub?.payout.readiness?.identityVerified || creator?.identityVerified === "VERIFIED")}
                  label="Identity verified"
                />
                <CheckRow done={payoutReady} label="Payout method added" />
                <CheckRow done={payoutReady} label="Ready to receive payments" />
              </ul>
              <Link href="/billing#payouts" className="mt-4 inline-block text-sm font-semibold text-violet hover:underline">
                Manage payout methods
              </Link>
            </div>
          </section>

          <section className="grid gap-4 xl:grid-cols-3">
            <div className="rounded-3xl border border-[#E6ECF7] bg-white p-5">
              <div className="flex items-center justify-between">
                <h2 className="font-display text-lg font-bold">Recent opportunities</h2>
                <Link href="/collaboration/hub" className="text-xs font-semibold text-violet">
                  View all
                </Link>
              </div>
              {(hub?.brandMatches.length ?? 0) === 0 ? (
                <p className="mt-3 text-sm text-muted">No published brand requests are matched to this card yet.</p>
              ) : (
                <ul className="mt-3 space-y-3">
                  {hub!.brandMatches.slice(0, 4).map(({ request, score }) => (
                    <li key={request.id} className="rounded-2xl border border-[#F0F3FA] px-3 py-3 text-sm">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-semibold">{request.brand}</p>
                          <p className="text-xs text-muted">{request.category || request.lookingFor || "Open brief"}</p>
                        </div>
                        <span className="rounded-full bg-[#F1ECFF] px-2 py-0.5 text-[11px] font-semibold text-violet">
                          Score {score}
                        </span>
                      </div>
                      {request.budget ? <p className="mt-1 text-xs text-muted">Budget {request.budget}</p> : null}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="rounded-3xl border border-[#E6ECF7] bg-white p-5">
              <div className="flex items-center justify-between">
                <h2 className="font-display text-lg font-bold">Active collaborations</h2>
                <Link href="/collaboration/hub#pipeline" className="text-xs font-semibold text-violet">
                  Open hub
                </Link>
              </div>
              {(hub?.pipeline.length ?? 0) === 0 ? (
                <p className="mt-3 text-sm text-muted">No active collaboration pipeline items yet.</p>
              ) : (
                <ul className="mt-3 space-y-3">
                  {hub!.pipeline.slice(0, 4).map((item) => (
                    <li key={item.id} className="flex items-center justify-between gap-3 text-sm">
                      <div>
                        <p className="font-semibold">{item.title}</p>
                        <p className="text-xs text-muted">{item.counterparty}</p>
                      </div>
                      <span className="rounded-full bg-[#EEF2FA] px-2.5 py-1 text-[11px] font-semibold">{item.stage}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="rounded-3xl border border-[#E6ECF7] bg-white p-5">
              <h2 className="font-display text-lg font-bold">Account setup checklist</h2>
              {completion ? (
                <>
                  <p className="mt-1 text-xs font-semibold text-muted">
                    {doneCount} of {totalCount} complete
                  </p>
                  <div className="mt-2 h-2 rounded-full bg-[#EEF2FA]">
                    <div
                      className="h-2 rounded-full bg-violet"
                      style={{ width: `${totalCount ? (doneCount / totalCount) * 100 : 0}%` }}
                    />
                  </div>
                  <ul className="mt-3 space-y-2 text-sm">
                    {completion.items.map((item) => (
                      <li key={item.id} className="flex gap-2">
                        <span className={item.done ? "text-emerald-600" : "text-muted"}>{item.done ? "✓" : "○"}</span>
                        <span>{item.label}</span>
                      </li>
                    ))}
                  </ul>
                </>
              ) : (
                <p className="mt-3 text-sm text-muted">The checklist appears with the creator profile.</p>
              )}
            </div>
          </section>
        </>
      )}
    </div>
  );
}

function Stat({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className="rounded-3xl border border-[#E6ECF7] bg-white p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted">{label}</p>
      <p className="mt-1 font-display text-2xl font-bold">{value}</p>
      <p className="mt-1 text-xs text-muted">{note}</p>
    </div>
  );
}

function CheckRow({ done, label }: { done: boolean; label: string }) {
  return (
    <li className="flex gap-2">
      <span className={done ? "text-emerald-600" : "text-muted"}>{done ? "✓" : "○"}</span>
      <span>{label}</span>
    </li>
  );
}
