import { searchCities, searchCountries } from "@/lib/places";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const kind = url.searchParams.get("kind") === "country" ? "country" : "city";
  const q = url.searchParams.get("q") ?? "";
  const country = url.searchParams.get("country") ?? "";
  const results = kind === "country" ? searchCountries(q) : searchCities(q, country);
  return Response.json({ results });
}
