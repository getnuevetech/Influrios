"use client";

import { useMemo, useState, useTransition } from "react";
import {
  actionGatewayRemovalImpact,
  actionRemoveGateway,
} from "@/app/admin/gateways/actions";

type AltGateway = { id: string; name: string; code: string };

type ImpactCountry = { countryCode: string; countryName: string };

type Impact = {
  providerId: string;
  providerCode: string;
  providerName: string;
  isDefaultBackup: boolean;
  countries: ImpactCountry[];
  blocked: boolean;
  blockers: string[];
};

export function RemoveGatewayButton({
  providerId,
  providerName,
  alternatives,
}: {
  providerId: string;
  providerName: string;
  alternatives: AltGateway[];
}) {
  const [open, setOpen] = useState(false);
  const [impact, setImpact] = useState<Impact | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [replacements, setReplacements] = useState<Record<string, string>>({});
  const [newDefaultId, setNewDefaultId] = useState("");
  const [pending, startTransition] = useTransition();

  const otherGateways = useMemo(
    () => alternatives.filter((gateway) => gateway.id !== providerId),
    [alternatives, providerId],
  );

  function openDialog() {
    setError(null);
    setImpact(null);
    setReplacements({});
    setNewDefaultId("");
    setOpen(true);
    startTransition(async () => {
      try {
        const next = await actionGatewayRemovalImpact(providerId);
        setImpact(next);
        const defaults: Record<string, string> = {};
        for (const country of next.countries) {
          defaults[country.countryCode] = otherGateways[0]?.id ?? "";
        }
        setReplacements(defaults);
        setNewDefaultId(otherGateways[0]?.id ?? "");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not check gateway impact.");
      }
    });
  }

  const replacementsReady =
    !impact ||
    (impact.countries.every((country) => Boolean(replacements[country.countryCode])) &&
      (!impact.isDefaultBackup || Boolean(newDefaultId)));

  return (
    <>
      <button
        type="button"
        onClick={openDialog}
        className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-900 hover:bg-amber-100"
      >
        Remove gateway
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-indigo/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby={`remove-gateway-${providerId}`}
        >
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-[#E4EBFF] bg-white p-5 shadow-xl">
            <h3 id={`remove-gateway-${providerId}`} className="font-display text-lg font-bold text-indigo">
              Remove {providerName}?
            </h3>

            {pending && !impact && !error ? (
              <p className="mt-3 text-sm text-muted">Checking what this gateway affects…</p>
            ) : null}

            {error ? <p className="mt-3 text-sm font-semibold text-amber-800">{error}</p> : null}

            {impact ? (
              <div className="mt-3 space-y-3 text-sm text-muted">
                {impact.blocked ? (
                  <>
                    <p className="font-semibold text-amber-900">
                      Removal is blocked until you replace what this gateway currently covers.
                    </p>
                    {impact.countries.length > 0 ? (
                      <div className="space-y-2 rounded-xl border border-amber-100 bg-amber-50/70 p-3">
                        <p className="font-semibold text-indigo">
                          Affected countries ({impact.countries.length})
                        </p>
                        <p>
                          Removing {impact.providerName} will affect{" "}
                          {impact.countries.map((c) => c.countryName).join(", ")}. Assign each country
                          an alternative gateway before removal is allowed.
                        </p>
                        <div className="space-y-2">
                          {impact.countries.map((country) => (
                            <label
                              key={country.countryCode}
                              className="flex flex-col gap-1 text-indigo sm:flex-row sm:items-center sm:justify-between"
                            >
                              <span className="font-semibold">
                                {country.countryName} ({country.countryCode})
                              </span>
                              <select
                                className="rounded-lg border border-border px-2 py-1"
                                value={replacements[country.countryCode] ?? ""}
                                onChange={(event) =>
                                  setReplacements((prev) => ({
                                    ...prev,
                                    [country.countryCode]: event.target.value,
                                  }))
                                }
                              >
                                <option value="">Choose alternative…</option>
                                {otherGateways.map((gateway) => (
                                  <option key={gateway.id} value={gateway.id}>
                                    {gateway.name}
                                  </option>
                                ))}
                              </select>
                            </label>
                          ))}
                        </div>
                      </div>
                    ) : null}

                    {impact.isDefaultBackup ? (
                      <div className="space-y-2 rounded-xl border border-amber-100 bg-amber-50/70 p-3">
                        <p className="font-semibold text-indigo">Default backup gateway</p>
                        <p>
                          {impact.providerName} is the default backup used when a country gateway fails.
                          Choose another default before removing it.
                        </p>
                        <label className="block font-semibold text-indigo">
                          New default backup
                          <select
                            className="mt-1 w-full rounded-lg border border-border px-2 py-1 font-normal"
                            value={newDefaultId}
                            onChange={(event) => setNewDefaultId(event.target.value)}
                          >
                            <option value="">Choose alternative…</option>
                            {otherGateways.map((gateway) => (
                              <option key={gateway.id} value={gateway.id}>
                                {gateway.name}
                              </option>
                            ))}
                          </select>
                        </label>
                      </div>
                    ) : null}
                  </>
                ) : (
                  <p>
                    No countries or default backup depend on {impact.providerName}. You can remove it
                    now.
                  </p>
                )}

                {otherGateways.length === 0 && impact.blocked ? (
                  <p className="font-semibold text-amber-800">
                    Add another payment gateway first so you have an alternative to assign.
                  </p>
                ) : null}
              </div>
            ) : null}

            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                className="rounded-lg border border-[#E4EBFF] px-3 py-2 text-sm font-semibold text-muted hover:text-indigo"
                onClick={() => setOpen(false)}
                disabled={pending}
              >
                Cancel
              </button>
              {impact && !impact.blocked ? (
                <form action={actionRemoveGateway}>
                  <input type="hidden" name="providerId" value={providerId} />
                  <button
                    type="submit"
                    className="rounded-lg bg-amber-700 px-3 py-2 text-sm font-semibold text-white hover:bg-amber-800"
                    disabled={pending}
                  >
                    Remove gateway
                  </button>
                </form>
              ) : null}
              {impact?.blocked && otherGateways.length > 0 ? (
                <form action={actionRemoveGateway}>
                  <input type="hidden" name="providerId" value={providerId} />
                  {impact.isDefaultBackup ? (
                    <input type="hidden" name="newDefaultProviderId" value={newDefaultId} />
                  ) : null}
                  {impact.countries.map((country) => (
                    <span key={country.countryCode}>
                      <input type="hidden" name="countryCode" value={country.countryCode} />
                      <input
                        type="hidden"
                        name="replacementProviderId"
                        value={replacements[country.countryCode] ?? ""}
                      />
                    </span>
                  ))}
                  <button
                    type="submit"
                    className="rounded-lg bg-amber-700 px-3 py-2 text-sm font-semibold text-white hover:bg-amber-800 disabled:opacity-50"
                    disabled={pending || !replacementsReady}
                  >
                    Replace & remove
                  </button>
                </form>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
