import Link from "next/link";
import { redirect } from "next/navigation";
import { CardPreviewDialog } from "@/components/card-preview-dialog";
import { IconHandshake, IconMail, IconWallet } from "@/components/icons";
import { dashboardEarningsLabel, openSetupReminders } from "@/lib/account-nav";
import { getAccountSession } from "@/lib/accounts";
import { unreadNoticeCount } from "@/lib/account-notices";
import { loadCreatorHome } from "@/lib/creator-home";
import { formatMoney, formatStoredMoney } from "@/lib/money";

export const dynamic = "force-dynamic";
export const metadata = { title: "Dashboard" };

function moneyLabel(cents: number, currency: string, failed: boolean) {
  if (failed || !currency) return "—";
  return formatMoney(cents, currency);
}

export default async function CreatorHomePage({
  searchParams,
}: {
  searchParams: Promise<{ welcome?: string; published?: string }>;
}) {
  const params = await searchParams;
  const account = await getAccountSession();
  if (!account) redirect("/login?next=/creator");
  const [home, unreadMessages] = await Promise.all([
    loadCreatorHome(account.id),
    unreadNoticeCount(account.id),
  ]);
  const connected = home.socials.filter((social) => social.status === "connected").length;
  const shareUrl = home.shortLabel
    ? home.shortLabel.startsWith("http")
      ? home.shortLabel
      : `https://${home.shortLabel}`
    : home.slug
      ? `https://influrios.com/c/${home.slug}`
      : "";
  const viewCount = home.visitsFailed ? "—" : home.visitCount30 === null ? "—" : String(home.visitCount30);
  const viewNote = home.visitsFailed
    ? "Profile views could not be loaded. This is not zero."
    : home.visitCount30 === null
      ? "Views start after your card link is live"
      : "Last 30 days";

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold text-[#1B1464] sm:text-4xl">
            Welcome back{home.firstName ? `, ${home.firstName}` : ""}
          </h1>
          <p className="mt-1 text-sm text-[#667085]">Your work and next steps in one place.</p>
        </div>
      </div>

      {params.published ? (
        <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          Your Starter card is live{home.slug ? ` at /c/${home.slug}` : ""}.
        </p>
      ) : null}
      {params.welcome && connected === 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#E4EBFF] bg-white px-4 py-3 text-sm">
          <div>
            <p className="font-semibold text-[#1B1464]">Connect a social account</p>
            <p className="text-[#667085]">You can do this later. A declined connection keeps this profile so you can retry.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/dashboard/social" className="btn-primary !py-2 text-sm">
              Connect a social account
            </Link>
            <Link href="/creator" className="btn-secondary !py-2 text-sm">
              Do this later
            </Link>
          </div>
        </div>
      ) : null}

      {home.pendingInvitations > 0 ? (
        <section className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-[#6D4AFF] px-4 py-4 text-white">
          <div className="flex items-center gap-3">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-white/15">
              <IconMail size={18} />
            </span>
            <div>
              <p className="font-semibold">
                {home.pendingInvitations} new invitation{home.pendingInvitations === 1 ? "" : "s"}
              </p>
              <p className="text-sm text-white/80">Brands want to collaborate with you.</p>
            </div>
          </div>
          <Link href="/collaboration/hub?view=collaborations&tab=invitations" className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-[#6D4AFF]">
            View invitations
          </Link>
        </section>
      ) : null}

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat href="/collaboration/hub?view=collaborations&tab=invitations" label="Invitations" value={String(home.pendingInvitations)} icon={<IconMail size={16} />} />
        <Stat href="/collaboration/hub?view=collaborations&tab=active" label="Active collaborations" value={String(home.activeCollabs)} icon={<IconHandshake size={16} />} />
        <Stat href="/creator/messages" label="Unread messages" value={String(unreadMessages)} icon={<IconMail size={16} />} />
        <Stat
          href="/creator/earnings"
          label={dashboardEarningsLabel(home.payoutReady)}
          value={home.earnings.failed ? "—" : formatStoredMoney(home.earnings.cents, home.earnings.currency)}
          icon={<IconWallet size={16} />}
        />
      </section>
      <p className="text-xs text-[#98A2B3]">
        Profile views {viewCount} · {viewNote}. Released this month {moneyLabel(home.earnings.cents, home.earnings.currency, home.earnings.failed)}
        {home.earnings.note ? ` · ${home.earnings.note}` : ""}.
      </p>

      {openSetupReminders({
        emailVerified: home.checklist.find((item) => item.id === "email")?.done ?? true,
        published: home.published,
        socialConnected: connected > 0 || Boolean(params.welcome),
        payoutReady: home.payoutReady,
      }).map((reminder) => (
        <section
          key={reminder.id}
          className={`flex flex-wrap items-center justify-between gap-3 rounded-2xl px-4 py-4 ${
            reminder.id === "payout" ? "bg-[#F3EEFF]" : "border border-[#E7ECF5] bg-white"
          }`}
        >
          <div>
            <p className="font-semibold text-[#1B1464]">{reminder.title}</p>
            <p className="text-sm text-[#667085]">{reminder.detail}</p>
          </div>
          <Link href={reminder.href} className="rounded-full bg-[#6D4AFF] px-4 py-2 text-sm font-semibold text-white">
            {reminder.action}
          </Link>
        </section>
      ))}

      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1.6fr)_minmax(18rem,0.8fr)]">
        <div className="space-y-4">
          <section className="rounded-[24px] border border-[#E7ECF5] bg-white p-4 shadow-sm sm:p-5">
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-display text-lg font-bold text-[#1B1464]">Needs your attention</h2>
              {home.attention.length > 0 ? (
                <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-[#F3EEFF] px-2 text-xs font-bold text-[#6D4AFF]">
                  {home.attention.length}
                </span>
              ) : null}
            </div>
            {home.attention.length === 0 ? (
              <p className="mt-3 text-sm text-[#667085]">Nothing is waiting on you. New invitations appear here.</p>
            ) : (
              <ul className="mt-3 divide-y divide-[#EEF2F7]">
                {home.attention.map((item) => (
                  <li key={item.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-[#1B1464]">{item.title}</p>
                      <p className="text-xs text-[#667085]">{item.detail}</p>
                    </div>
                    <Link href={item.href} className="rounded-full bg-[#6D4AFF] px-3 py-2 text-xs font-semibold text-white">
                      {item.action} →
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="rounded-[24px] border border-[#E7ECF5] bg-white p-4 shadow-sm sm:p-5">
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-display text-lg font-bold text-[#1B1464]">Active collaborations</h2>
              <Link href="/collaboration/hub?view=collaborations&tab=active" className="text-xs font-semibold text-[#6D4AFF]">
                View all
              </Link>
            </div>
            {home.pipeline.length === 0 ? (
              <p className="mt-3 text-sm text-[#667085]">
                No current work. Invitations and proposals stay in Needs your attention until they become a collaboration.
              </p>
            ) : (
              <div className="mt-3 overflow-x-auto">
                <table className="w-full min-w-[32rem] text-left text-sm">
                  <thead className="text-xs text-[#667085]">
                    <tr>
                      <th className="py-2 font-semibold">Collaboration</th>
                      <th className="py-2 font-semibold">Status</th>
                      <th className="py-2 font-semibold">Next action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {home.pipeline.map((item) => (
                      <tr key={item.id} className="border-t border-[#EEF2F7]">
                        <td className="py-3 pr-3">
                          <p className="font-semibold text-[#1B1464]">{item.title}</p>
                          <p className="text-xs text-[#667085]">{item.counterparty || item.next}</p>
                        </td>
                        <td className="py-3 pr-3">
                          <span className="rounded-full bg-[#F3EEFF] px-2 py-1 text-xs font-semibold text-[#6D4AFF]">{item.stage}</span>
                        </td>
                        <td className="py-3">
                          {item.stage === "Expecting funding" ? (
                            <span className="text-xs font-semibold text-[#98A2B3]">Expecting funding</span>
                          ) : (
                            <span className="flex flex-wrap gap-2">
                              {item.contractHref ? (
                                <Link href={item.contractHref} className="text-xs font-semibold text-[#6D4AFF]">
                                  Contract
                                </Link>
                              ) : null}
                              <Link href={item.href} className="rounded-full bg-[#6D4AFF] px-3 py-2 text-xs font-semibold text-white">
                                {item.href.includes("/collaboration/work/") ? "Submit content" : "View details"}
                              </Link>
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>

        <div className="space-y-4">
          <section className="rounded-[24px] border border-[#E7ECF5] bg-white p-4 shadow-sm">
            <h2 className="font-display text-lg font-bold text-[#1B1464]">Influencer Card</h2>
            {home.slug ? (
              <div className="mt-3 overflow-hidden rounded-2xl border border-[#E7ECF5]">
                <div className="flex h-36 items-center justify-center bg-[#F3EEFF]">
                  {home.avatar ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={home.avatar} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <span className="font-display text-3xl font-bold text-[#6D4AFF]">{home.displayName.slice(0, 1)}</span>
                  )}
                </div>
                <div className="p-3">
                  <p className="truncate font-semibold text-[#1B1464]">{home.displayName}</p>
                  {home.title ? <p className="truncate text-xs text-[#667085]">{home.title}</p> : null}
                </div>
              </div>
            ) : (
              <p className="mt-3 text-sm text-[#667085]">Create your card to get a share link. The full portrait stays on its own page.</p>
            )}
            <div className="mt-3 flex gap-2">
              {home.slug ? (
                <CardPreviewDialog
                  name={home.displayName}
                  title={home.title}
                  image={home.avatar}
                  href={home.cardHref}
                  shareUrl={shareUrl}
                />
              ) : (
                <Link href={home.cardHref} className="inline-flex flex-1 items-center justify-center rounded-full bg-[#6D4AFF] px-3 py-2 text-sm font-semibold text-white">
                  View card
                </Link>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

function Stat({
  href,
  label,
  value,
  note,
  icon,
}: {
  href: string;
  label: string;
  value: string;
  note?: string;
  icon: React.ReactNode;
}) {
  return (
    <Link href={href} className="rounded-2xl border border-[#E7ECF5] bg-white p-4 shadow-sm hover:border-[#C9B8FF]">
      <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-[#F3EEFF] text-[#6D4AFF]">{icon}</span>
      <p className="mt-3 text-xs font-semibold text-[#667085]">{label}</p>
      <p className="mt-1 font-display text-2xl font-bold text-[#1B1464]">{value}</p>
      {note ? <p className="mt-1 text-[11px] leading-snug text-[#667085]">{note}</p> : null}
    </Link>
  );
}
