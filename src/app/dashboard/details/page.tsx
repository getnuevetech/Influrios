import Image from "next/image";
import {
  actionUpdateDashboardProfile,
  actionUpdateProfileMedia,
} from "@/app/claim/actions";
import { DiscoveryFacetForm, ProfileNotesForm } from "@/components/creator-profile/forms";
import { ManagedIntrosPanel } from "@/components/creator-profile/managed-intros-panel";
import { CreatorProfileShell, ProfileFlash } from "@/components/creator-profile/profile-shell";
import { SpecialtyPicker } from "@/components/creator-profile/specialty-picker";
import { ContactAddressFields } from "@/components/contact-address-fields";
import { PlaceFields } from "@/components/place-fields";
import { loadCreatorProfileBundle } from "@/lib/creator-profile-data";
import { BIO_MIN_CHARS } from "@/lib/onboarding";
import { BRAND_AVATARS, resolveDisplayBanner } from "@/lib/profile-media";

export const dynamic = "force-dynamic";
export const metadata = { title: "Details & Preferences" };

type Props = {
  searchParams: Promise<{ saved?: string; error?: string; published?: string; tab?: string }>;
};

export default async function ProfileDetailsPage({ searchParams }: Props) {
  const params = await searchParams;
  const data = await loadCreatorProfileBundle();
  const {
    draft,
    score,
    selfDescriptions,
    specialtyGroups,
    specialtyCap,
    topics,
    suggestionRows,
    optIn,
    activeIntros,
    historyIntros,
    contentStyles,
    commercialModes,
    primaryNiche,
    kycVerified,
    planCode,
  } = data;
  const introTab =
    params.tab === "active" || params.tab === "history" || params.tab === "preferences"
      ? params.tab
      : "preferences";

  return (
    <CreatorProfileShell
      draft={draft}
      score={score}
      primaryNiche={primaryNiche}
      planLabel={planCode}
      kycVerified={kycVerified}
      flash={<ProfileFlash params={params} />}
    >
      <section id="profile" className="card-surface space-y-6 p-6">
        <div>
          <h2 className="font-display text-xl font-bold text-indigo">Profile photo &amp; banner</h2>
          <p className="mt-1 text-sm text-muted">
            New profiles start with Influrios brand art. Choosing a gender below updates the default avatar
            automatically. Upload your own photo or banner anytime.
          </p>
          <div className="mt-4 overflow-hidden rounded-2xl border border-border">
            <div className="relative h-28 w-full bg-[#EEF2FF]">
              <Image
                src={resolveDisplayBanner({ seed: draft.slug, coverImage: draft.coverImage })}
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
              </div>
            </div>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <form
              action={actionUpdateProfileMedia}
              encType="multipart/form-data"
              className="space-y-2 rounded-xl border border-border p-3"
            >
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
            <form
              action={actionUpdateProfileMedia}
              encType="multipart/form-data"
              className="space-y-2 rounded-xl border border-border p-3"
            >
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
                required
                defaultValue={draft.title.trim() ? draft.title : ""}
                className="mt-1 w-full rounded-xl border border-border px-3 py-2"
              >
                <option value="">Choose how you describe yourself</option>
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
              <span className="mt-1 block text-xs font-normal text-muted">
                At least {BIO_MIN_CHARS} characters. A brief sentence about what you create is enough.
              </span>
            </label>
            <div className="sm:col-span-2">
              <p className="text-sm font-semibold text-indigo">Contact address</p>
              <div className="mt-2">
                <ContactAddressFields
                  defaultLine1={draft.addressLine1 ?? ""}
                  defaultLine2={draft.addressLine2 ?? ""}
                  defaultPostal={draft.postalCode ?? ""}
                />
              </div>
            </div>
            <PlaceFields
              cityName="locationCity"
              stateName="locationState"
              countryName="locationCountry"
              defaultCity={draft.locationCity}
              defaultState={draft.locationState ?? ""}
              defaultCountry={draft.locationCountry}
              className="contents"
            />
            <label className="text-sm sm:col-span-2">
              <span className="font-semibold text-indigo">Primary specialty</span>
              <select
                name="specialty"
                defaultValue={draft.specialties[0] ?? ""}
                className="mt-1 w-full rounded-xl border border-border px-3 py-2"
              >
                <option value="">Choose a specialty</option>
                {specialtyGroups.map((group) => (
                  <optgroup key={group.slug} label={group.name}>
                    <option value={group.slug}>{group.name}</option>
                    {group.children
                      .filter((child) => child.active)
                      .map((child) => (
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

      <section id="specialties" className="card-surface space-y-4 p-6">
        <div>
          <h2 className="font-display text-xl font-bold text-indigo">Specialties & niches</h2>
          <p className="mt-2 text-sm text-muted">
            Overview shows selected chips only. Edit opens a searchable picker with groups, selected-only filter,
            and clear/reset. This plan keeps {specialtyCap}{" "}
            {specialtyCap === 1 ? "specialty" : "specialties"}.
          </p>
          {topics.providerError ? (
            <p className="mt-2 text-sm text-amber-800">
              The provider did not answer. The rules result is shown instead.
            </p>
          ) : null}
        </div>
        <SpecialtyPicker
          draftId={draft.id}
          specialtyCap={specialtyCap}
          groups={specialtyGroups}
          selected={draft.specialties}
          suggested={[...suggestionRows.values()]}
        />
      </section>

      <section id="introductions" className="card-surface space-y-4 p-6">
        <div>
          <h2 className="font-display text-xl font-bold text-indigo">Managed introductions</h2>
          <p className="mt-2 text-sm text-muted">
            Preferences, active introductions, and history — not a long checkbox list on Overview.
          </p>
        </div>
        <ManagedIntrosPanel
          openToManaged={optIn?.openToManaged === true}
          niches={optIn?.niches ?? []}
          targetingNotes={optIn?.targetingNotes ?? ""}
          updatedAt={optIn?.updatedAt}
          groups={specialtyGroups}
          activeIntros={activeIntros}
          historyIntros={historyIntros}
          initialTab={introTab}
        />
      </section>

      <section id="style" className="card-surface p-6">
        <DiscoveryFacetForm
          draftId={draft.id}
          contentStyles={contentStyles}
          commercialModes={commercialModes}
          selectedStyles={draft.contentStyles ?? []}
          selectedModes={draft.commercialModes ?? []}
        />
      </section>

      <section id="offer-need" className="card-surface p-6">
        <ProfileNotesForm
          draftId={draft.id}
          offer={draft.offer ?? ""}
          offerDetails={draft.offerDetails ?? ""}
          need={draft.need ?? ""}
          needDetails={draft.needDetails ?? ""}
        />
      </section>
    </CreatorProfileShell>
  );
}
