"use client";

/**
 * Changing the influencer reloads the wizard so that person's accepted request
 * fills the title, deliverables, value, and currency.
 */
export function ContractInfluencerField({
  creatorSlug,
  options,
  requests,
  applicationId,
}: {
  creatorSlug: string;
  applicationId: string;
  options: { slug: string; label: string }[];
  requests: { id: string; title: string }[];
}) {
  function open(next: { creator?: string; application?: string }) {
    const url = new URL(window.location.href);
    const creator = (next.creator ?? creatorSlug).trim();
    if (creator) url.searchParams.set("creator", creator);
    else url.searchParams.delete("creator");
    if (next.application) url.searchParams.set("application", next.application);
    else url.searchParams.delete("application");
    for (const key of ["title", "scope", "commercial", "gross", "currency", "brief"]) {
      url.searchParams.delete(key);
    }
    window.location.assign(`${url.pathname}?${url.searchParams.toString()}`);
  }

  return (
    <>
      <label className="mt-4 block text-sm font-semibold text-indigo">
        Influencer
        <select
          name="creatorSlug"
          required
          defaultValue={creatorSlug}
          onChange={(event) => open({ creator: event.target.value })}
          className="mt-1 w-full rounded-xl border border-border px-3 py-2 font-normal outline-none focus:ring-2 focus:ring-violet"
        >
          <option value="">Select influencer…</option>
          {options.map((option) => (
            <option key={option.slug} value={option.slug}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
      {requests.length > 1 ? (
        <label className="mt-4 block text-sm font-semibold text-indigo">
          Accepted request
          <select
            name="sourceApplicationId"
            defaultValue={applicationId}
            onChange={(event) => open({ creator: creatorSlug, application: event.target.value })}
            className="mt-1 w-full rounded-xl border border-border px-3 py-2 font-normal outline-none focus:ring-2 focus:ring-violet"
          >
            {requests.map((request) => (
              <option key={request.id} value={request.id}>
                {request.title}
              </option>
            ))}
          </select>
        </label>
      ) : null}
    </>
  );
}
