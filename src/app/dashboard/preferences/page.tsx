import { DiscoveryFacetForm, ProfileNotesForm } from "@/components/creator-profile/forms";
import { ManagedIntrosPanel } from "@/components/creator-profile/managed-intros-panel";
import { CreatorProfileShell, ProfileFlash } from "@/components/creator-profile/profile-shell";
import { SpecialtyPicker } from "@/components/creator-profile/specialty-picker";
import { loadCreatorProfileBundle } from "@/lib/creator-profile-data";

export const dynamic = "force-dynamic";
export const metadata = { title: "Opportunities & preferences" };

type Props = {
  searchParams: Promise<{ saved?: string; error?: string; tab?: string }>;
};

export default async function ProfilePreferencesPage({ searchParams }: Props) {
  const params = await searchParams;
  const data = await loadCreatorProfileBundle();
  const {
    draft,
    score,
    specialtyGroups,
    specialtyCap,
    topics,
    suggestionRows,
    optIn,
    activeIntros,
    historyIntros,
    contentStyles,
    commercialModes,
  } = data;

  const introTab =
    params.tab === "active" || params.tab === "history" || params.tab === "preferences"
      ? params.tab
      : "preferences";

  return (
    <CreatorProfileShell
      draft={draft}
      score={score}
      title="Opportunities & preferences"
      subtitle="Specialties, commercial mode, managed introductions, and collaboration notes."
      flash={<ProfileFlash params={params} />}
    >
      <section id="specialties" className="card-surface space-y-4 p-6">
        <div>
          <h2 className="font-display text-xl font-bold text-indigo">Specialties & niches</h2>
          <p className="mt-2 text-sm text-muted">
            Overview shows a few chips. Edit opens a searchable picker with groups, selected-only filter, and
            clear/reset. This plan keeps {specialtyCap}{" "}
            {specialtyCap === 1 ? "specialty" : "specialties"}.
          </p>
          {topics.source === "provider" ? (
            <p className="mt-2 text-[12px] text-muted">Provider suggestions are available in the picker.</p>
          ) : (
            <p className="mt-2 text-[12px] text-muted">
              Keyword suggestions from your profile text appear in the picker. They save only when you confirm.
            </p>
          )}
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
            A real matching workflow — preferences, active introductions, and history — not a long checkbox list on
            Overview.
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
