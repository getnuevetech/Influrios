import { searchCities, searchCountries, searchStates } from "@/lib/places";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const kindRaw = url.searchParams.get("kind");
  const kind = kindRaw === "country" || kindRaw === "state" ? kindRaw : "city";
  const q = url.searchParams.get("q") ?? "";
  const country = url.searchParams.get("country") ?? "";
  const results =
    kind === "country" ? searchCountries(q) : kind === "state" ? searchStates(q, country) : searchCities(q, country);
  return Response.json({ results });
}
