import Link from "next/link";
import { redirect } from "next/navigation";
import { actionPublishDraft, actionUpdateDashboardProfile } from "@/app/claim/actions";
import { actionConnectSocial, actionDisconnectSocial, actionRefreshSocial } from "@/app/dashboard/social-actions";
import {
  completenessFor,
  getCreatorSessionDraft,
} from "@/lib/claim";
import { socialConnectState } from "@/lib/social-connect";
import { formatFollowers, SPECIALTY_TAXONOMY } from "@/lib/seed-data";

export const dynamic = "force-dynamic";
export const metadata = { title: "Creator dashboard" };

type Props = {
  searchParams: Promise<{ published?: string; saved?: string; error?: string; social?: string }>;
};

export default async function CreatorDashboardPage({ searchParams }: Props) {
  const params = await searchParams;
  const draft = await getCreatorSessionDraft();
  if (!draft) redirect("/claim");
  const social = await socialConnectState(draft.slug).catch(() => null);

  const { score, items } = completenessFor(draft);
  const nextAction = items.find((i) => !i.done);

  return (
    <div className="mx-auto max-w-[90rem] space-y-8 px-4 py-10 sm:px-6 lg:px-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-violet">
            Phase 8 · Creator dashboard
          </p>
          <h1 className="mt-2 font-display text-3xl font-bold text-indigo">
            Welcome{draft.ownerName ? `, ${draft.ownerName.split(" ")[0]}` : ""}
          </h1>
          <p className="mt-1 text-sm text-muted">
            Completeness score and next-best actions for your Influencer Card.
          </p>
        </div>
        <div className="rounded-2xl bg-lavender px-5 py-3 text-center">
          <p className="font-display text-3xl font-bold text-violet">{score}%</p>
          <p className="text-xs font-semibold text-indigo">Profile completeness</p>
        </div>
      </div>

      {params.published ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          Published! Your Starter card is live at{" "}
          <Link href={`/c/${draft.slug}`} className="font-semibold underline">
            /c/{draft.slug}
          </Link>
          .
        </div>
      ) : null}
      {params.saved ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          Profile saved.
        </div>
      ) : null}
      {params.error ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {params.error}
        </div>
      ) : null}

      {nextAction ? (
        <div className="card-surface flex flex-wrap items-center justify-between gap-4 p-5">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-violet">Next best action</p>
            <p className="mt-1 font-display text-lg font-bold text-indigo">{nextAction.label}</p>
            <p className="text-sm text-muted">{nextAction.hint}</p>
          </div>
          {nextAction.id === "published" ? (
            <form action={actionPublishDraft}>
              <input type="hidden" name="draftId" value={draft.id} />
              <button type="submit" className="btn-primary !py-2 text-sm">
                Publish now →
              </button>
            </form>
          ) : nextAction.id === "verified" || nextAction.id === "email_verified" ? (
            <Link href={`/claim/verify/${draft.id}`} className="btn-primary !py-2 text-sm">
              Verify →
            </Link>
          ) : nextAction.id === "claimed" ? (
            <Link href={`/claim/preview/${draft.id}`} className="btn-primary !py-2 text-sm">
              Claim →
            </Link>
          ) : (
            <a href="#profile" className="btn-secondary !py-2 text-sm">
              Edit profile
            </a>
          )}
        </div>
      ) : (
        <div className="card-surface p-5 text-sm text-emerald-800">
          Card looks complete. Share{" "}
          <Link href={`/c/${draft.slug}`} className="font-semibold text-violet underline">
            /c/{draft.slug}
          </Link>{" "}
          or{" "}
          <Link href="/billing" className="font-semibold text-violet underline">
            upgrade to Plus
          </Link>{" "}
          for shortlink + QR.
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <section id="profile" className="card-surface p-6">
          <h2 className="font-display text-xl font-bold text-indigo">Edit profile</h2>
          <form action={actionUpdateDashboardProfile} className="mt-4 grid gap-3 sm:grid-cols-2">
            <input type="hidden" name="draftId" value={draft.id} />
            <label className="text-sm sm:col-span-2">
              <span className="font-semibold text-indigo">Display name</span>
              <input
                name="displayName"
                defaultValue={draft.displayName}
                className="mt-1 w-full rounded-xl border border-border px-3 py-2"
              />
            </label>
            <label className="text-sm sm:col-span-2">
              <span className="font-semibold text-indigo">Title</span>
              <input
                name="title"
                defaultValue={draft.title}
                className="mt-1 w-full rounded-xl border border-border px-3 py-2"
              />
            </label>
            <label className="text-sm sm:col-span-2">
              <span className="font-semibold text-indigo">Bio</span>
              <textarea
                name="bio"
                rows={3}
                defaultValue={draft.bio}
                className="mt-1 w-full rounded-xl border border-border px-3 py-2"
              />
            </label>
            <label className="text-sm">
              <span className="font-semibold text-indigo">City</span>
              <input
                name="locationCity"
                defaultValue={draft.locationCity}
                className="mt-1 w-full rounded-xl border border-border px-3 py-2"
              />
            </label>
            <label className="text-sm">
              <span className="font-semibold text-indigo">Country</span>
              <input
                name="locationCountry"
                defaultValue={draft.locationCountry}
                className="mt-1 w-full rounded-xl border border-border px-3 py-2"
              />
            </label>
            <label className="text-sm sm:col-span-2">
              <span className="font-semibold text-indigo">Primary specialty</span>
              <select
                name="specialty"
                defaultValue={draft.specialties[0] ?? "lifestyle"}
                className="mt-1 w-full rounded-xl border border-border px-3 py-2"
              >
                {SPECIALTY_TAXONOMY.map((s) => (
                  <option key={s.slug} value={s.slug}>
                    {s.name}
                  </option>
                ))}
              </select>
            </label>
            <button type="submit" className="btn-primary sm:col-span-2 !py-2 text-sm">
              Save profile
            </button>
          </form>
        </section>

        <section className="card-surface p-6">
          <h2 className="font-display text-xl font-bold text-indigo">Checklist</h2>
          <ul className="mt-4 divide-y divide-border">
            {items.map((item) => (
              <li key={item.id} className="flex items-start justify-between gap-3 py-3 text-sm">
                <div>
                  <p className={`font-semibold ${item.done ? "text-emerald-700" : "text-indigo"}`}>
                    {item.done ? "✓ " : "○ "}
                    {item.label}
                  </p>
                  <p className="text-xs text-muted">{item.hint}</p>
                </div>
                <span className="shrink-0 text-xs font-bold text-muted">{item.weight}%</span>
              </li>
            ))}
          </ul>

          <div className="mt-6 space-y-2">
            <Link href={`/claim/preview/${draft.id}`} className="btn-secondary flex w-full !py-2 text-sm">
              View draft card
            </Link>
            {draft.stage === "published" ? (
              <Link href={`/c/${draft.slug}`} className="btn-primary flex w-full !py-2 text-sm">
                Open live card →
              </Link>
            ) : null}
            <Link href="/payments" className="block text-center text-xs font-semibold text-violet hover:underline">
              Protected payments (escrow)
            </Link>
            <Link href="/billing" className="block text-center text-xs font-semibold text-violet hover:underline">
              Upgrade for shortlink + QR
            </Link>
          </div>
        </section>
      </div>

      {social ? (
        <section className="card-surface p-6">
          <h2 className="font-display text-xl font-bold text-indigo">Social accounts</h2>
          <p className="mt-1 text-sm text-muted">
            Connecting a network does not change the profile layout. Follower and like counts replace the current
            figure only after that network returns both.
          </p>
          {params.social === "connected" || params.social === "synced" ? (
            <p className="mt-3 text-sm font-semibold text-emerald-700">The network returned a follower count and likes.</p>
          ) : null}
          {params.social === "disconnected" ? (
            <p className="mt-3 text-sm font-semibold text-emerald-700">Disconnected. Further sync has stopped.</p>
          ) : null}
          {!social.creatorId ? (
            <p className="mt-4 text-sm text-muted">Publish your card before connecting a network.</p>
          ) : (
            <div className="mt-4 space-y-4">
              <div className="rounded-xl bg-lavender/40 p-4 text-sm text-indigo">
                <p className="font-semibold">Terms {social.policy.version}</p>
                <p className="mt-2 whitespace-pre-wrap">{social.policy.termsText}</p>
                <p className="mt-3 font-semibold">Policy</p>
                <p className="mt-2 whitespace-pre-wrap">{social.policy.policyText}</p>
              </div>
              {social.accounts.map((account) => (
                <div key={account.platform} className="rounded-xl border border-border p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-semibold text-indigo">{account.name}</p>
                    <p className="text-xs text-muted">
                      {account.live && account.followers != null && account.likes != null
                        ? `${formatFollowers(account.followers)} followers · ${formatFollowers(account.likes)} likes`
                        : account.ready
                          ? "Waiting for the network"
                          : "Not ready in admin"}
                    </p>
                  </div>
                  {account.lastError ? <p className="mt-2 text-xs text-amber-800">{account.lastError}</p> : null}
                  <form action={actionConnectSocial} className="mt-3 flex flex-wrap items-center gap-3">
                    <input type="hidden" name="platform" value={account.platform} />
                    <label className="flex items-start gap-2 text-xs text-indigo">
                      <input type="checkbox" name="acceptTerms" className="mt-0.5 accent-violet" required />
                      I agree to the Influrios social integration terms and policy ({social.policy.version}).
                    </label>
                    <button type="submit" className="btn-primary !py-1.5 text-xs">
                      Connect {account.name}
                    </button>
                  </form>
                  {account.status === "connected" ? (
                    <div className="mt-2 flex gap-2">
                      <form action={actionRefreshSocial}>
                        <input type="hidden" name="platform" value={account.platform} />
                        <button type="submit" className="btn-secondary !py-1.5 text-xs">Sync now</button>
                      </form>
                      <form action={actionDisconnectSocial}>
                        <input type="hidden" name="platform" value={account.platform} />
                        <button type="submit" className="btn-secondary !py-1.5 text-xs">Disconnect</button>
                      </form>
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </section>
      ) : null}
    </div>
  );
}
