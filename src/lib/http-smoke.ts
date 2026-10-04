/**
 * L2 — release smoke catalog.
 * Offline tests always validate the catalog. Live HTTP checks run when SMOKE_BASE_URL is set
 * (staging/CI against a booted app): `SMOKE_BASE_URL=https://… npm test -- http-smoke`.
 */

export type SmokeRoute = {
  id: string;
  path: string;
  /** Human label for checklist / failures. */
  name: string;
  expectStatus: number[];
  /** Substring or RegExp source matched against response body (HTML/JSON text). */
  expectBody?: string;
  /** Skip live fetch unless SMOKE_LIVE=1 (keeps default CI offline-only). */
  live?: boolean;
};

/** Critical public + resolver paths for per-release smoke (plan L2). */
export const HTTP_SMOKE_ROUTES: SmokeRoute[] = [
  { id: "landing", path: "/", name: "Homepage landing", expectStatus: [200], expectBody: "Influrios", live: true },
  { id: "discover", path: "/discover", name: "Discover directory", expectStatus: [200], expectBody: "Discover", live: true },
  { id: "claim", path: "/claim", name: "Claim funnel entry", expectStatus: [200], expectBody: "Claim", live: true },
  {
    id: "collaboration",
    path: "/collaboration",
    name: "Collaboration landing",
    expectStatus: [200],
    expectBody: "Collaboration",
    live: true,
  },
  { id: "pricing", path: "/pricing", name: "Pricing", expectStatus: [200], expectBody: "Plan", live: true },
  {
    id: "short_resolve_root",
    path: "/api/short/resolve?path=/&host=inflr.me",
    name: "Short-link resolver root",
    expectStatus: [200],
    expectBody: "Influrios",
    live: true,
  },
];

export function smokeBaseUrl(env: NodeJS.ProcessEnv = process.env): string | null {
  const raw = String(env.SMOKE_BASE_URL || "").trim();
  if (!raw) return null;
  return raw.replace(/\/$/, "");
}

export function smokeLiveEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return Boolean(smokeBaseUrl(env) && (env.SMOKE_LIVE === "1" || env.SMOKE_LIVE === "true"));
}

export function assertSmokeCatalog(routes: SmokeRoute[] = HTTP_SMOKE_ROUTES): {
  ok: true;
} | { ok: false; error: string } {
  if (!routes.length) return { ok: false, error: "Smoke catalog is empty." };
  const ids = new Set<string>();
  for (const route of routes) {
    if (!route.id || !route.path || !route.name) {
      return { ok: false, error: `Smoke route missing id/path/name: ${JSON.stringify(route)}` };
    }
    if (ids.has(route.id)) return { ok: false, error: `Duplicate smoke route id: ${route.id}` };
    ids.add(route.id);
    if (!route.expectStatus.length) {
      return { ok: false, error: `Smoke route ${route.id} needs expectStatus` };
    }
  }
  const required = ["landing", "discover", "claim", "collaboration", "short_resolve_root"];
  for (const id of required) {
    if (!ids.has(id)) return { ok: false, error: `Missing required smoke route: ${id}` };
  }
  return { ok: true };
}

export type SmokeFetchResult = {
  id: string;
  ok: boolean;
  status: number;
  error?: string;
};

export async function runLiveSmoke(input: {
  baseUrl: string;
  routes?: SmokeRoute[];
  fetchImpl?: typeof fetch;
}): Promise<SmokeFetchResult[]> {
  const routes = (input.routes ?? HTTP_SMOKE_ROUTES).filter((route) => route.live !== false);
  const fetchImpl = input.fetchImpl ?? fetch;
  const results: SmokeFetchResult[] = [];
  for (const route of routes) {
    const url = `${input.baseUrl}${route.path.startsWith("/") ? route.path : `/${route.path}`}`;
    try {
      const response = await fetchImpl(url, {
        redirect: "manual",
        headers: { accept: "text/html,application/json" },
      });
      const status = response.status;
      let body = "";
      try {
        body = await response.text();
      } catch {
        body = "";
      }
      const statusOk = route.expectStatus.includes(status);
      const bodyOk = route.expectBody ? body.includes(route.expectBody) : true;
      results.push({
        id: route.id,
        ok: statusOk && bodyOk,
        status,
        error: !statusOk
          ? `expected status ${route.expectStatus.join("|")}, got ${status}`
          : !bodyOk
            ? `body missing “${route.expectBody}”`
            : undefined,
      });
    } catch (error) {
      results.push({
        id: route.id,
        ok: false,
        status: 0,
        error: error instanceof Error ? error.message : "fetch failed",
      });
    }
  }
  return results;
}
