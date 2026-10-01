"use client";

import { useEffect, useId, useRef, useState } from "react";
import { samePlace } from "@/lib/place-names";

type PlaceHit = { name: string; country: string };

const PLACEHOLDERS = new Set(["Your city", "Your country"]);

function shown(value: string) {
  return PLACEHOLDERS.has(value.trim()) ? "" : value;
}

async function suggest(kind: "country" | "city", q: string, country: string, signal: AbortSignal) {
  const url = new URL("/api/places", window.location.origin);
  url.searchParams.set("kind", kind);
  url.searchParams.set("q", q);
  if (country) url.searchParams.set("country", country);
  const response = await fetch(url, { signal });
  if (!response.ok) return [] as PlaceHit[];
  const body = (await response.json()) as { results?: PlaceHit[] };
  return body.results ?? [];
}

export function PlaceFields({
  cityName,
  countryName,
  defaultCity = "",
  defaultCountry = "",
  cityLabel = "City",
  countryLabel = "Country",
  className = "",
}: {
  cityName: string;
  countryName: string;
  defaultCity?: string;
  defaultCountry?: string;
  cityLabel?: string;
  countryLabel?: string;
  className?: string;
}) {
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [country, setCountry] = useState(shown(defaultCountry));
  const [city, setCity] = useState(shown(defaultCity));
  const [countryPicked, setCountryPicked] = useState(Boolean(shown(defaultCountry)));
  const [countryHits, setCountryHits] = useState<PlaceHit[]>([]);
  const [cityHits, setCityHits] = useState<PlaceHit[]>([]);
  const [open, setOpen] = useState<"country" | "city" | null>(null);

  useEffect(() => {
    function onPointer(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(null);
    }
    document.addEventListener("mousedown", onPointer);
    return () => document.removeEventListener("mousedown", onPointer);
  }, []);

  useEffect(() => {
    if (open !== "country" || country.trim().length < 1) {
      setCountryHits([]);
      return;
    }
    const controller = new AbortController();
    const timer = setTimeout(() => {
      suggest("country", country, "", controller.signal)
        .then(setCountryHits)
        .catch(() => undefined);
    }, 160);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [country, open]);

  useEffect(() => {
    const min = countryPicked && country.trim() ? 1 : 2;
    if (open !== "city" || city.trim().length < min) {
      setCityHits([]);
      return;
    }
    const controller = new AbortController();
    const timer = setTimeout(() => {
      suggest("city", city, countryPicked ? country : "", controller.signal)
        .then(setCityHits)
        .catch(() => undefined);
    }, 160);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [city, country, countryPicked, open]);

  function pickCountry(name: string) {
    const changed = !samePlace(name, country);
    setCountry(name);
    setCountryPicked(true);
    setCountryHits([]);
    setOpen(null);
    if (changed) setCity("");
  }

  function pickCity(hit: PlaceHit) {
    setCity(hit.name);
    setCityHits([]);
    setOpen(null);
    if (!countryPicked || !country.trim()) {
      setCountry(hit.country);
      setCountryPicked(true);
    }
  }

  const inputClass =
    "mt-1 w-full rounded-xl border border-border bg-white px-3 py-2 text-sm font-normal text-indigo outline-none focus:ring-2 focus:ring-violet";

  return (
    <div ref={rootRef} className={className}>
      <label className="relative block text-sm">
        <span className="font-semibold text-indigo">{countryLabel}</span>
        <input
          name={countryName}
          value={country}
          autoComplete="off"
          role="combobox"
          aria-expanded={open === "country"}
          aria-controls={`${listId}-country`}
          placeholder="Search countries"
          onChange={(event) => {
            setCountry(event.target.value);
            setCountryPicked(false);
            setOpen("country");
          }}
          onFocus={() => setOpen("country")}
          className={inputClass}
        />
        {open === "country" && countryHits.length > 0 ? (
          <ul id={`${listId}-country`} role="listbox" className="absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded-xl border border-border bg-white py-1 shadow-lg">
            {countryHits.map((hit) => (
              <li key={hit.name}>
                <button
                  type="button"
                  className="block w-full px-3 py-2 text-left text-sm text-indigo hover:bg-[#F4F0FF]"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => pickCountry(hit.name)}
                >
                  {hit.name}
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </label>
      <label className="relative block text-sm">
        <span className="font-semibold text-indigo">{cityLabel}</span>
        <input
          name={cityName}
          value={city}
          autoComplete="off"
          role="combobox"
          aria-expanded={open === "city"}
          aria-controls={`${listId}-city`}
          placeholder={countryPicked && country ? `Search cities in ${country}` : "Search cities"}
          onChange={(event) => {
            setCity(event.target.value);
            setOpen("city");
          }}
          onFocus={() => setOpen("city")}
          className={inputClass}
        />
        {open === "city" && cityHits.length > 0 ? (
          <ul id={`${listId}-city`} role="listbox" className="absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded-xl border border-border bg-white py-1 shadow-lg">
            {cityHits.map((hit) => (
              <li key={`${hit.name}-${hit.country}`}>
                <button
                  type="button"
                  className="block w-full px-3 py-2 text-left text-sm text-indigo hover:bg-[#F4F0FF]"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => pickCity(hit)}
                >
                  {hit.name}
                  {countryPicked ? null : <span className="text-muted"> · {hit.country}</span>}
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </label>
    </div>
  );
}
