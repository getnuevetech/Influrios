import Link from "next/link";
import { redirect } from "next/navigation";
import { getAccountSession } from "@/lib/accounts";
import { completenessFor, getCreatorSessionDraft } from "@/lib/claim";
import { prisma } from "@/lib/db";
import { formatFollowers } from "@/lib/seed-data";
import { primaryShortHost } from "@/lib/short-link";

export const dynamic = "force-dynamic";
export const metadata = { title: "Creator account" };

export default async function CreatorHomePage() {
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
        },
      })
      .catch(() => null),
    getCreatorSessionDraft().catch(() => null),
    primaryShortHost().catch(() => "inflr.me"),
  ]);
  const shortLink = creator?.shortLinks[0] ?? null;
  const [visits, collaborations, inquiries] = creator
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
        prisma.collaborationFunding.count({ where: { creatorSlug: creator.slug } }).catch(() => 0),
        prisma.businessInquiry.count({ where: { creatorSlug: creator.slug } }).catch(() => 0),
      ])
    : [0, 0, 0];
  const completion = draft ? completenessFor(draft) : null;
  const next = completion?.items.find((item) => !item.done);
  const today = new Date().toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" });
  const payoutReady = Boolean(creator?.payoutProfile?.stripeConnectAccountId || creator?.payoutProfile?.providerConnectedAccountId);

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold">Creator account</h1>
          <p className="mt-1 text-sm text-muted">Welcome back{account.name ? `, ${account.name.split(" ")[0]}` : ""}. This is the account on {account.email}.</p>
        </div>
        <p className="text-xs font-semibold text-muted">{today}</p>
      </div>

      {!creator ? (
        <section className="mt-6 rounded-3xl border border-[#E6ECF7] bg-white p-6">
          <h2 className="font-display text-xl font-bold">Create your influencer card</h2>
          <p className="mt-2 max-w-xl text-sm text-muted">This account does not have a published card yet. Profile, visits, and payouts appear here after the card exists.</p>
          <Link href="/claim" className="btn-primary mt-4">Get started free</Link>
        </section>
      ) : (
        <>
          <section className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
            <div className="rounded-3xl border border-[#E6ECF7] bg-white p-5">
              <div className="flex flex-wrap items-start gap-4">
                <span className="inline-flex h-16 w-16 items-center justify-center overflow-hidden rounded-full bg-[#EDE7FF] text-xl font-bold text-violet">
                  {creator.avatarUrl ? (
                    // Avatar URLs are stored by the creator. A plain image avoids blocking on the image optimizer.
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={creator.avatarUrl} alt="" className="h-full w-full object-cover" />
                  ) : (
                    creator.displayName.slice(0, 1)
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <h2 className="font-display text-2xl font-bold">{creator.displayName}</h2>
                  <p className="text-sm text-muted">@{creator.slug}</p>
                  <p className="mt-1 text-sm text-indigo/80">{creator.title || "Influencer"}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {creator.specialties.map((row) => (
                      <span key={row.id} className="rounded-full bg-[#E8F0FF] px-2.5 py-1 text-xs font-semibold text-[#2F5FD0]">
                        {row.specialty.name}
                      </span>
                    ))}
                  </div>
                </div>
                <Link href="/dashboard" className="btn-secondary !py-2 text-sm">Edit profile</Link>
              </div>
              {completion ? (
                <div className="mt-5">
                  <div className="flex items-center justify-between text-xs font-semibold">
                    <span>Profile completion</span>
                    <span>{completion.score}%</span>
                  </div>
                  <div className="mt-2 h-2 rounded-full bg-[#EEF2FA]">
                    <div className="h-2 rounded-full bg-violet" style={{ width: `${completion.score}%` }} />
                  </div>
                </div>
              ) : null}
              {shortLink ? (
                <p className="mt-4 text-sm">
                  Card link{" "}
                  <a className="font-semibold text-violet" href={`https://${host}/${shortLink.slug}`}>
                    {host}/{shortLink.slug}
                  </a>
                </p>
              ) : (
                <p className="mt-4 text-sm text-muted">A short link appears when the plan includes one and the card is published.</p>
              )}
            </div>
            <div className="rounded-3xl border border-[#E6ECF7] bg-gradient-to-br from-[#F7F4FF] to-white p-5">
              <p className="text-xs font-bold uppercase tracking-wide text-violet">Next step</p>
              <p className="mt-2 font-display text-xl font-bold">{next ? next.label : "Your profile checklist is complete."}</p>
              <p className="mt-2 text-sm text-muted">{next?.hint || "Keep the card current from your profile."}</p>
              <Link href="/dashboard" className="mt-4 inline-block text-sm font-semibold text-violet hover:underline">
                Open profile
              </Link>
            </div>
          </section>

          <section className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Stat label="Profile visits" value={String(visits)} note="Short link, QR, and NFC visits on this card." />
            <Stat label="Inquiries" value={String(inquiries)} note="Business inquiries sent to this creator." />
            <Stat label="Collaborations" value={String(collaborations)} note="Funding records that name this creator." />
            <Stat label="Payouts" value={payoutReady ? "Ready" : "Not set up"} note="Subscription billing does not send a payout." />
          </section>

          <section className="mt-4 grid gap-4 lg:grid-cols-3">
            <div className="rounded-3xl border border-[#E6ECF7] bg-white p-5 lg:col-span-1">
              <div className="flex items-center justify-between">
                <h2 className="font-display text-lg font-bold">Connected social profiles</h2>
                <Link href="/dashboard" className="text-xs font-semibold text-violet">Manage</Link>
              </div>
              {creator.socialAccounts.length === 0 ? <p className="mt-3 text-sm text-muted">No social profile is saved on this card yet.</p> : null}
              <ul className="mt-3 space-y-3">
                {creator.socialAccounts.map((social) => (
                  <li key={social.id} className="flex items-center justify-between gap-3 text-sm">
                    <span>
                      <span className="font-semibold capitalize">{social.platform.toLowerCase()}</span>
                      <span className="mt-0.5 block text-xs text-muted">
                        {social.handle}
                        {typeof social.followers === "number" ? ` · ${formatFollowers(social.followers)} followers` : ""}
                      </span>
                    </span>
                    <span className="text-xs font-semibold text-emerald-700">Saved</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-3xl border border-[#E6ECF7] bg-white p-5">
              <h2 className="font-display text-lg font-bold">Payout status</h2>
              <p className="mt-2 text-sm text-muted">
                {payoutReady ? "A payout account is saved on this profile. Opening it does not send a payout." : "Add a payout account before a collaboration can pay this card."}
              </p>
              <Link href="/billing#payouts" className="mt-4 inline-block text-sm font-semibold text-violet hover:underline">
                Manage payout methods
              </Link>
            </div>
            <div className="rounded-3xl border border-[#E6ECF7] bg-white p-5">
              <h2 className="font-display text-lg font-bold">Account checklist</h2>
              {completion ? (
                <ul className="mt-3 space-y-2 text-sm">
                  {completion.items.slice(0, 6).map((item) => (
                    <li key={item.id} className="flex gap-2">
                      <span className={item.done ? "text-emerald-600" : "text-muted"}>{item.done ? "✓" : "○"}</span>
                      <span>{item.label}</span>
                    </li>
                  ))}
                </ul>
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
