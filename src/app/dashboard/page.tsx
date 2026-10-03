import Link from "next/link";
import { redirect } from "next/navigation";
import {
  actionPublishDraft,
  actionUpdateDashboardProfile,
  actionUpdateProfileMedia,
} from "@/app/claim/actions";
import { actionConnectSocial, actionDisconnectSocial, actionRefreshSocial } from "@/app/dashboard/social-actions";
import { actionChangeShortSlug } from "@/app/dashboard/short-actions";
import { actionConfirmSpecialties } from "@/app/dashboard/specialty-actions";
import { classifyProfileTopics } from "@/lib/ai-runtime";
import { isPlanCode } from "@/lib/entitlements";
import { entitlementsForPlan } from "@/lib/entitlements-db";
import { ensureCreatorShortLink, primaryShortHost } from "@/lib/short-link";
import {
  completenessFor,
  getCreatorSessionDraft,
} from "@/lib/claim";
import { getInfluencerIdentity } from "@/lib/landing-pages";
import { socialConnectState } from "@/lib/social-connect";
import { PlaceFields } from "@/components/place-fields";
import { getDirectory } from "@/lib/directory";
import { formatFollowers, SPECIALTY_TAXONOMY } from "@/lib/seed-data";
import { actionAddOwnEvidence, actionOpenOwnDispute, actionRequestOwnChangeOrder, actionSubmitOwnMilestone } from "@/app/dashboard/funding-actions";
import { readFxSnapshot } from "@/lib/fx-share";
import { formatMoney } from "@/lib/money";
import { listFundingsForCreator, marketplaceConfig } from "@/lib/marketplace-ledger";
import { scheduleLabel } from "@/lib/schedule";
import { listDisputeReasons } from "@/lib/milestone-disputes";
import Image from "next/image";
import { BRAND_AVATARS, BRAND_BANNERS } from "@/lib/profile-media";

export const dynamic = "force-dynamic";
export const metadata = { title: "Influencer dashboard" };

type Props = {
  searchParams: Promise<{ published?: string; saved?: string; error?: string; social?: string }>;
};

export default async function CreatorDashboardPage({ searchParams }: Props) {
  const params = await searchParams;
  const draft = await getCreatorSessionDraft();
  if (!draft) redirect("/claim");
  const [directory, identity] = await Promise.all([
    getDirectory().catch(() => null),
    getInfluencerIdentity().catch(() => null),
  ]);
  const selfDescriptions =
    identity?.selfDescriptions?.length
      ? identity.selfDescriptions
      : ["Influencer", "Content Creator", "Other"];
  const specialtyGroups = (directory?.taxonomy ?? SPECIALTY_TAXONOMY.map((parent) => ({
    slug: parent.slug,
    name: parent.name,
    active: true,
    children: (parent.children ?? []).map((child) => ({ ...child, active: true })),
  }))).filter((parent) => parent.active);
  const social = await socialConnectState(draft.slug).catch(() => null);
  const planCode = isPlanCode(draft.planTier ?? "") ? draft.planTier! : "STARTER";
  const linkLimits = await entitlementsForPlan(planCode).catch(() => null);
  const shortLink = draft.stage === "published" ? await ensureCreatorShortLink(draft.slug).catch(() => null) : null;
  const shortHost = await primaryShortHost().catch(() => "inflr.me");
  const topics = await classifyProfileTopics(`${draft.title}\n${draft.bio}`).catch(() => ({
    suggestions: [],
    source: "fallback" as const,
    providerError: undefined as string | undefined,
  }));
  const suggestionRows = new Map<string, { slug: string; name: string; reason?: string }>();
  for (const item of topics.suggestions) suggestionRows.set(item.slug, item);
  for (const slug of draft.specialties) {
    if (!suggestionRows.has(slug)) suggestionRows.set(slug, { slug, name: slug });
  }
  const specialtyCap = linkLimits?.specialtiesMax ?? 1;
  const [fundings, disputeReasons, marketplace] = await Promise.all([
    listFundingsForCreator(draft.slug).catch(() => []),
    listDisputeReasons().catch(() => []),
    marketplaceConfig().catch(() => null),
  ]);
  const activeReasons = disputeReasons.filter((reason) => reason.active);

  const { score, items } = completenessFor(draft);
  const nextAction = items.find((i) => !i.done);

  return (
    <div className="mx-auto max-w-[90rem] space-y-8 px-4 py-10 sm:px-6 lg:px-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-violet">
            Phase 8 · Influencer dashboard
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
      {params.saved === "1" ? (
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
        <section id="profile" className="card-surface space-y-6 p-6">
          <div>
            <h2 className="font-display text-xl font-bold text-indigo">Profile photo &amp; banner</h2>
            <p className="mt-1 text-sm text-muted">
              New profiles start with Influrios brand art. Set your gender for a matching default avatar, upload your own
              photos, or cycle branded banners anytime.
            </p>
            <div className="mt-4 overflow-hidden rounded-2xl border border-border">
              <div className="relative h-28 w-full bg-[#EEF2FF]">
                <Image
                  src={draft.coverImage || BRAND_BANNERS[0]}
                  alt=""
                  fill
                  className="object-cover"
                  sizes="640px"
                  unoptimized={draft.coverImage?.endsWith(".svg")}
                />
              </div>
              <div className="flex items-end gap-4 bg-white p-4">
                <span className="relative -mt-10 h-20 w-20 overflow-hidden rounded-full ring-4 ring-white">
                  <Image
                    src={draft.image || BRAND_AVATARS.unspecified}
                    alt=""
                    fill
                    className="object-cover"
                    sizes="80px"
                    unoptimized={draft.image?.endsWith(".svg")}
                  />
                </span>
                <div className="min-w-0 flex-1 pb-1">
                  <p className="truncate text-sm font-bold text-indigo">{draft.displayName}</p>
                  <p className="text-xs text-muted">Gender: {draft.gender}</p>
                </div>
              </div>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <form action={actionUpdateProfileMedia} encType="multipart/form-data" className="space-y-2 rounded-xl border border-border p-3">
                <input type="hidden" name="draftId" value={draft.id} />
                <input type="hidden" name="intent" value="avatar" />
                <p className="text-xs font-bold uppercase tracking-wide text-violet">Profile photo</p>
                <input
                  type="file"
                  name="avatar"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  className="block w-full text-xs text-muted file:mr-2 file:rounded-lg file:border-0 file:bg-lavender file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-indigo"
                />
                <button type="submit" className="btn-primary w-full !py-2 text-xs">
                  Upload photo
                </button>
              </form>
              <form action={actionUpdateProfileMedia} encType="multipart/form-data" className="space-y-2 rounded-xl border border-border p-3">
                <input type="hidden" name="draftId" value={draft.id} />
                <input type="hidden" name="intent" value="cover" />
                <p className="text-xs font-bold uppercase tracking-wide text-violet">Banner</p>
                <input
                  type="file"
                  name="cover"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  className="block w-full text-xs text-muted file:mr-2 file:rounded-lg file:border-0 file:bg-lavender file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-indigo"
                />
                <button type="submit" className="btn-primary w-full !py-2 text-xs">
                  Upload banner
                </button>
              </form>
              <form action={actionUpdateProfileMedia} className="space-y-2 rounded-xl border border-border p-3">
                <input type="hidden" name="draftId" value={draft.id} />
                <input type="hidden" name="intent" value="avatar-default" />
                <p className="text-xs font-bold uppercase tracking-wide text-violet">Use brand avatar</p>
                <select
                  name="gender"
                  defaultValue={draft.gender}
                  className="w-full rounded-xl border border-border px-3 py-2 text-sm"
                >
                  <option value="unspecified">Generic Influrios</option>
                  <option value="female">Female default</option>
                  <option value="male">Male default</option>
                </select>
                <button type="submit" className="btn-secondary w-full !py-2 text-xs">
                  Apply default avatar
                </button>
              </form>
              <form action={actionUpdateProfileMedia} className="space-y-2 rounded-xl border border-border p-3">
                <input type="hidden" name="draftId" value={draft.id} />
                <input type="hidden" name="intent" value="cover-next" />
                <p className="text-xs font-bold uppercase tracking-wide text-violet">Brand banner</p>
                <p className="text-xs text-muted">Cycle the Influrios rooftop / lounge banners.</p>
                <button type="submit" className="btn-secondary w-full !py-2 text-xs">
                  Next brand banner
                </button>
              </form>
            </div>
          </div>

          <div>
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
                <span className="font-semibold text-indigo">How do you describe yourself?</span>
                <select
                  name="title"
                  defaultValue={
                    selfDescriptions.includes(draft.title)
                      ? draft.title
                      : draft.title
                        ? draft.title
                        : "Influencer"
                  }
                  className="mt-1 w-full rounded-xl border border-border px-3 py-2"
                >
                  {!selfDescriptions.includes(draft.title) && draft.title ? (
                    <option value={draft.title}>{draft.title} (current)</option>
                  ) : null}
                  {selfDescriptions.map((label) => (
                    <option key={label} value={label}>
                      {label}
                    </option>
                  ))}
                </select>
                <span className="mt-1 block text-xs font-normal text-muted">
                  Platform role stays Influencer. Pick a self-description from the admin-managed list.
                </span>
              </label>
              <label className="text-sm sm:col-span-2">
                <span className="font-semibold text-indigo">Gender (for default avatar)</span>
                <select
                  name="gender"
                  defaultValue={draft.gender}
                  className="mt-1 w-full rounded-xl border border-border px-3 py-2"
                >
                  <option value="unspecified">Prefer not to say / unknown</option>
                  <option value="female">Female</option>
                  <option value="male">Male</option>
                </select>
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
              <PlaceFields
                cityName="locationCity"
                countryName="locationCountry"
                defaultCity={draft.locationCity}
                defaultCountry={draft.locationCountry}
                className="contents"
              />
              <label className="text-sm sm:col-span-2">
                <span className="font-semibold text-indigo">Primary specialty</span>
                <select
                  name="specialty"
                  defaultValue={draft.specialties[0] ?? "lifestyle"}
                  className="mt-1 w-full rounded-xl border border-border px-3 py-2"
                >
                  {specialtyGroups.map((group) => (
                    <optgroup key={group.slug} label={group.name}>
                      <option value={group.slug}>{group.name}</option>
                      {group.children.filter((child) => child.active).map((child) => (
                        <option key={child.slug} value={child.slug}>
                          {child.name}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </label>
              <button type="submit" className="btn-primary sm:col-span-2 !py-2 text-sm">
                Save profile
              </button>
            </form>
          </div>
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

      <section className="card-surface p-6">
        <h2 className="font-display text-xl font-bold text-indigo">Specialty suggestions</h2>
        <p className="mt-2 text-sm text-muted">
          {topics.source === "provider"
            ? "The assigned provider suggested these. They are saved only when you confirm."
            : "These come from the profile text. They are saved only when you confirm."}
          {" "}This plan keeps {specialtyCap} {specialtyCap === 1 ? "specialty" : "specialties"}.
        </p>
        {topics.providerError ? (
          <p className="mt-2 text-sm text-amber-800">The provider did not answer. The keyword list is shown instead.</p>
        ) : null}
        {suggestionRows.size === 0 ? (
          <p className="mt-3 text-sm text-muted">No specialty keywords matched this profile yet.</p>
        ) : (
          <form action={actionConfirmSpecialties} className="mt-4 space-y-2">
            <input type="hidden" name="draftId" value={draft.id} />
            {[...suggestionRows.values()].map((item) => (
              <label key={item.slug} className="flex items-start gap-2 text-sm text-indigo">
                <input
                  type="checkbox"
                  name="specialty"
                  value={item.slug}
                  defaultChecked={draft.specialties.includes(item.slug)}
                />
                <span>
                  <span className="font-semibold">{item.name}</span>
                  {item.reason ? <span className="mt-0.5 block text-xs text-muted">{item.reason}</span> : null}
                </span>
              </label>
            ))}
            <button type="submit" className="btn-secondary !py-2 text-sm">
              Confirm specialties
            </button>
          </form>
        )}
      </section>

      <section className="card-surface p-6">
        <h2 className="font-display text-xl font-bold text-indigo">Your links</h2>
        <p className="mt-2 text-sm text-indigo">
          Canonical profile: influrios.com/c/{draft.slug}
        </p>
        {shortLink && shortLink.status === "active" ? (
          <div className="mt-3 space-y-3 text-sm text-indigo">
            <p>
              Short link: https://{shortHost}/{shortLink.slug}
            </p>
            {linkLimits?.standardQr || linkLimits?.dynamicQr ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={`/api/qr/${draft.slug}?size=160&logo=0`} alt="Influencer Card QR" width={160} height={160} />
            ) : null}
            {linkLimits?.customAlias ? (
              <form action={actionChangeShortSlug} className="space-y-2">
                <p className="text-xs text-muted">
                  Changing this name keeps the printed QR and the previous short link. The old name redirects to the
                  new one.
                </p>
                <input
                  name="slug"
                  defaultValue={shortLink.slug}
                  className="w-full max-w-xs rounded-xl border border-border px-3 py-2"
                />
                <button type="submit" className="btn-secondary !py-1.5 text-xs">
                  Update short link
                </button>
              </form>
            ) : (
              <p className="text-xs text-muted">A custom short name follows the plan entitlement.</p>
            )}
          </div>
        ) : (
          <p className="mt-2 text-sm text-muted">
            This plan uses the canonical profile link. A short link and QR appear when the plan entitlements include them.
          </p>
        )}
      </section>

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
                <p className="font-semibold">Before the network login</p>
                <p className="mt-2">
                  Accepting the Influencer Terms does not authorize a social account. This step explains the permissions
                  and asks you to acknowledge the{" "}
                  <Link href="/legal/connected-social-data-policy" className="font-semibold underline" target="_blank">
                    Connected Social Data & API Policy
                  </Link>
                  . The{" "}
                  <Link href="/legal/social-platform-integration-terms" className="font-semibold underline" target="_blank">
                    Social Platform Integration Terms
                  </Link>{" "}
                  stay a separate agreement.
                </p>
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
                      <span>
                        I acknowledge the Connected Social Data & API Policy and authorize Influrios to start the{" "}
                        {account.name} login
                        {account.scopes ? ` for: ${account.scopes}` : ""}. This is not granted by the Influencer Terms.
                      </span>
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

      <section className="card-surface p-6">
        <h2 className="font-display text-xl font-bold text-indigo">Protected payments</h2>
        <p className="mt-1 text-sm text-muted">
          Submit a milestone after the marketplace provider confirms the prefund. A revision sends it back to you. Approval does not release the money. A change order amends the gross only while the prefund is still waiting for the provider.
        </p>
        {params.saved === "milestone" ? (
          <p className="mt-3 text-sm font-semibold text-emerald-700">Milestone submitted for review.</p>
        ) : null}
        {params.saved === "evidence" ? (
          <p className="mt-3 text-sm font-semibold text-emerald-700">Evidence saved. Nothing was released or refunded.</p>
        ) : null}
        {params.saved === "dispute" ? (
          <p className="mt-3 text-sm font-semibold text-emerald-700">
            Dispute opened. Release waits until it is resolved.
          </p>
        ) : null}
        {params.saved === "change" ? (
          <p className="mt-3 text-sm font-semibold text-emerald-700">
            Change order recorded. The earlier fee snapshot stays on that record. Nothing was held.
          </p>
        ) : null}
        {fundings.length === 0 ? (
          <p className="mt-4 text-sm text-muted">No protected payments for this card yet.</p>
        ) : (
          <ul className="mt-4 space-y-3">
            {fundings.map((funding) => (
              <li key={funding.id} className="rounded-xl border border-border p-4">
                <p className="font-semibold text-indigo">{funding.title}</p>
                <p className="text-xs text-muted">
                  {funding.businessName} · {funding.status.replaceAll("_", " ")} · held{" "}
                  {formatMoney(funding.ledger.heldCents, funding.currency)}
                  {readFxSnapshot(funding.fxSnapshotJson)?.source === "wise" ? " · Wise user rate" : ""}
                  {funding.attributionLabel ? ` · ${funding.attributionLabel}` : ""}
                  {funding.repeatOf ? ` · repeat of ${funding.repeatOf.title}` : ""}
                  {scheduleLabel(funding) ? ` · ${scheduleLabel(funding)}` : ""}
                  {funding.status === "awaiting_provider"
                    ? ` · change orders ${funding.changeOrderCount} of ${funding.changeOrderLimit}`
                    : ""}
                </p>
                {funding.changeOrders.map((order) => (
                  <p key={order.id} className="mt-1 text-xs text-indigo">
                    Change order {formatMoney(order.previousUsdCents)} → {formatMoney(order.nextUsdCents)}. {order.note}
                  </p>
                ))}
                {funding.status === "awaiting_provider" &&
                marketplace?.changeOrdersEnabled !== false &&
                funding.changeOrderCount < funding.changeOrderLimit ? (
                  <form action={actionRequestOwnChangeOrder} className="mt-3 flex flex-wrap items-end gap-2">
                    <input type="hidden" name="fundingId" value={funding.id} />
                    <label className="text-xs font-semibold text-muted">
                      New gross USD
                      <input
                        name="grossUsd"
                        type="number"
                        min={1}
                        step={1}
                        required
                        className="mt-1 w-32 rounded-lg border border-border px-2 py-1 text-sm text-indigo"
                      />
                    </label>
                    <label className="text-xs font-semibold text-muted">
                      What changed
                      <input
                        name="note"
                        required
                        minLength={8}
                        placeholder="What the amendment covers"
                        className="mt-1 w-56 rounded-lg border border-border px-2 py-1 text-sm text-indigo"
                      />
                    </label>
                    <button type="submit" className="btn-secondary !py-1.5 text-xs">
                      Record change order
                    </button>
                  </form>
                ) : null}
                <div className="mt-3 space-y-2">
                  {funding.milestones.map((milestone) => (
                    <div key={milestone.id} className="rounded-lg border border-border px-3 py-2 text-sm">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span>
                          {milestone.title} · {formatMoney(milestone.amountCents, funding.currency)} · {milestone.status}
                          {milestone.refundedCents > 0
                            ? ` · refunded ${formatMoney(milestone.refundedCents, funding.currency)} · ${formatMoney(milestone.amountCents - milestone.refundedCents, funding.currency)} left`
                            : ""}
                          {milestone.revisionCount > 0 ? ` · revision ${milestone.revisionCount} of ${milestone.revisionLimit}` : ""}
                        </span>
                        {funding.status === "held" && milestone.status === "pending" ? (
                          <form action={actionSubmitOwnMilestone}>
                            <input type="hidden" name="fundingId" value={funding.id} />
                            <input type="hidden" name="milestoneId" value={milestone.id} />
                            <button type="submit" className="btn-secondary !py-1.5 text-xs">
                              Submit work
                            </button>
                          </form>
                        ) : null}
                      </div>
                      {milestone.revisionNote && milestone.status === "pending" ? (
                        <p className="mt-1 text-xs text-indigo">Revision: {milestone.revisionNote}</p>
                      ) : null}
                      {funding.status === "held" &&
                      milestone.status !== "released" &&
                      milestone.status !== "refunded" &&
                      activeReasons.length > 0 ? (
                        funding.disputes?.find((dispute) => dispute.milestoneId === milestone.id || dispute.milestoneId == null) ? (
                          <div className="mt-2 space-y-2">
                            {funding.disputes
                              .filter((dispute) => dispute.milestoneId === milestone.id || dispute.milestoneId == null)
                              .map((dispute) => (
                                <div key={dispute.id} className="space-y-2">
                                  <p className="text-xs text-muted">
                                    Dispute open. Release waits until it is resolved.
                                    {dispute.evidenceLimit > 0
                                      ? ` Evidence ${dispute.notes.length} of ${dispute.evidenceLimit}.`
                                      : " No further evidence."}
                                  </p>
                                  {dispute.notes.map((note) => (
                                    <p key={note.id} className="text-xs text-indigo">
                                      {note.author}: {note.body}
                                      {note.url ? (
                                        <>
                                          {" "}
                                          <a href={note.url} className="font-semibold text-violet hover:underline" rel="noreferrer" target="_blank">
                                            Link
                                          </a>
                                        </>
                                      ) : null}
                                    </p>
                                  ))}
                                  {dispute.notes.length < dispute.evidenceLimit ? (
                                    <form action={actionAddOwnEvidence} className="flex flex-wrap items-center gap-2">
                                      <input type="hidden" name="fundingId" value={funding.id} />
                                      <input type="hidden" name="disputeId" value={dispute.id} />
                                      <input name="body" required minLength={8} placeholder="Evidence" className="rounded-lg border border-border px-2 py-1 text-xs" />
                                      <input name="url" placeholder="https link" className="rounded-lg border border-border px-2 py-1 text-xs" />
                                      <button type="submit" className="btn-secondary !py-1.5 text-xs">
                                        Add evidence
                                      </button>
                                    </form>
                                  ) : null}
                                </div>
                              ))}
                          </div>
                        ) : (
                        <form action={actionOpenOwnDispute} className="mt-2 flex flex-wrap items-center gap-2">
                          <input type="hidden" name="fundingId" value={funding.id} />
                          <input type="hidden" name="milestoneId" value={milestone.id} />
                          <select name="reasonId" className="rounded-lg border border-border px-2 py-1 text-xs" required>
                            {activeReasons.map((reason) => (
                              <option key={reason.id} value={reason.id}>
                                {reason.label}
                              </option>
                            ))}
                          </select>
                          <input
                            name="details"
                            required
                            minLength={8}
                            placeholder="What happened"
                            className="rounded-lg border border-border px-2 py-1 text-xs"
                          />
                          <button type="submit" className="btn-secondary !py-1.5 text-xs">
                            Open dispute
                          </button>
                        </form>
                        )
                      ) : null}
                    </div>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
