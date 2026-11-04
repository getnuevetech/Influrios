import { actionSaveDiscoveryFacets } from "@/app/dashboard/facet-actions";
import { actionSaveProfileNotes } from "@/app/dashboard/offer-actions";

export function DiscoveryFacetForm({
  draftId,
  contentStyles,
  commercialModes,
  selectedStyles,
  selectedModes,
}: {
  draftId: string;
  contentStyles: { slug: string; name: string }[];
  commercialModes: { slug: string; name: string }[];
  selectedStyles: string[];
  selectedModes: string[];
}) {
  if (!contentStyles.length && !commercialModes.length) return null;
  return (
    <div>
      <h2 className="font-display text-xl font-bold text-indigo">Content style and commercial mode</h2>
      <p className="mt-2 text-sm text-muted">
        Update several selections here, then save once. Overview only shows the chips you picked.
      </p>
      <form action={actionSaveDiscoveryFacets} className="mt-4 grid gap-4 sm:grid-cols-2">
        <input type="hidden" name="draftId" value={draftId} />
        <fieldset>
          <legend className="text-sm font-semibold text-indigo">Content style</legend>
          <ul className="mt-2 space-y-2">
            {contentStyles.map((row) => (
              <li key={row.slug}>
                <label className="flex items-center gap-2 text-sm text-indigo">
                  <input
                    type="checkbox"
                    name="contentStyle"
                    value={row.slug}
                    defaultChecked={selectedStyles.includes(row.slug)}
                    className="h-4 w-4 rounded accent-[#633CFF]"
                  />
                  {row.name}
                </label>
              </li>
            ))}
          </ul>
        </fieldset>
        <fieldset>
          <legend className="text-sm font-semibold text-indigo">Commercial mode</legend>
          <ul className="mt-2 space-y-2">
            {commercialModes.map((row) => (
              <li key={row.slug}>
                <label className="flex items-center gap-2 text-sm text-indigo">
                  <input
                    type="checkbox"
                    name="commercialMode"
                    value={row.slug}
                    defaultChecked={selectedModes.includes(row.slug)}
                    className="h-4 w-4 rounded accent-[#633CFF]"
                  />
                  {row.name}
                </label>
              </li>
            ))}
          </ul>
        </fieldset>
        <button type="submit" className="btn-primary sm:col-span-2 !py-2 text-sm">
          Save choices
        </button>
      </form>
    </div>
  );
}

export function ProfileNotesForm({
  draftId,
  offer,
  offerDetails,
  need,
  needDetails,
}: {
  draftId: string;
  offer: string;
  offerDetails: string;
  need: string;
  needDetails: string;
}) {
  return (
    <div>
      <h2 className="font-display text-xl font-bold text-indigo">I offer and I need</h2>
      <p className="mt-2 text-sm text-muted">Edit collaboration notes for your public profile.</p>
      <form action={actionSaveProfileNotes} className="mt-4 grid gap-3 sm:grid-cols-2">
        <input type="hidden" name="draftId" value={draftId} />
        <label className="text-sm sm:col-span-2">
          <span className="font-semibold text-indigo">I offer</span>
          <input name="offer" defaultValue={offer} className="mt-1 w-full rounded-xl border border-border px-3 py-2" />
        </label>
        <label className="text-sm sm:col-span-2">
          <span className="font-semibold text-indigo">Offer details</span>
          <textarea
            name="offerDetails"
            rows={3}
            defaultValue={offerDetails}
            className="mt-1 w-full rounded-xl border border-border px-3 py-2"
          />
        </label>
        <label className="text-sm sm:col-span-2">
          <span className="font-semibold text-indigo">I need</span>
          <input name="need" defaultValue={need} className="mt-1 w-full rounded-xl border border-border px-3 py-2" />
        </label>
        <label className="text-sm sm:col-span-2">
          <span className="font-semibold text-indigo">Need details</span>
          <textarea
            name="needDetails"
            rows={3}
            defaultValue={needDetails}
            className="mt-1 w-full rounded-xl border border-border px-3 py-2"
          />
        </label>
        <button type="submit" className="btn-primary sm:col-span-2 !py-2 text-sm">
          Save offer and need
        </button>
      </form>
    </div>
  );
}
