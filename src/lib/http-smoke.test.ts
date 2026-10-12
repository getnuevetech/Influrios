import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import {
  HTTP_SMOKE_ROUTES,
  assertSmokeCatalog,
  runLiveSmoke,
  smokeBaseUrl,
  smokeLiveEnabled,
} from "./http-smoke";
import { brandedFallbackHtml } from "./short-link";

describe("L2 HTTP smoke catalog", () => {
  it("includes critical landing / claim / collab / resolver paths", () => {
    const gate = assertSmokeCatalog();
    assert.equal(gate.ok, true);
    assert.ok(HTTP_SMOKE_ROUTES.some((route) => route.id === "landing"));
    assert.ok(HTTP_SMOKE_ROUTES.some((route) => route.path.startsWith("/api/short/resolve")));
  });

  it("treats live smoke as opt-in via SMOKE_BASE_URL + SMOKE_LIVE", () => {
    assert.equal(smokeBaseUrl({}), null);
    assert.equal(smokeLiveEnabled({ SMOKE_BASE_URL: "https://example.test" }), false);
    assert.equal(
      smokeLiveEnabled({ SMOKE_BASE_URL: "https://example.test/", SMOKE_LIVE: "1" }),
      true,
    );
  });

  it("runs a mocked live smoke pass", async () => {
    const results = await runLiveSmoke({
      baseUrl: "https://smoke.test",
      routes: [
        { id: "landing", path: "/", name: "Home", expectStatus: [200], expectBody: "Influrios", live: true },
        { id: "miss", path: "/nope", name: "Miss", expectStatus: [200], expectBody: "ok", live: true },
      ],
      fetchImpl: async (input) => {
        const url = String(input);
        if (url.endsWith("/")) {
          return new Response("<html>Influrios</html>", { status: 200 });
        }
        return new Response("nope", { status: 404 });
      },
    });
    assert.equal(results[0]?.ok, true);
    assert.equal(results[1]?.ok, false);
    assert.match(results[1]?.error || "", /status/);
  });
});

describe("staging evidence probe", () => {
  it("runs with node and does not call tsx", () => {
    const pkg = JSON.parse(readFileSync("package.json", "utf8")) as { scripts: Record<string, string> };
    assert.equal(pkg.scripts["staging:evidence-probe"], "node scripts/staging-evidence-probe.mjs");
    const probe = readFileSync("scripts/staging-evidence-probe.mjs", "utf8");
    assert.equal(probe.includes("tsx"), false);
    const result = spawnSync("node", ["scripts/staging-evidence-probe.mjs", "http://127.0.0.1:9"], {
      encoding: "utf8",
      timeout: 15000,
    });
    assert.equal(result.error, undefined);
    assert.match(result.stdout, /Phase M staging evidence probe/);
    assert.match(result.stdout, /operator-only/);
    assert.match(result.stdout, /does not mark Phase M complete/);
    assert.equal(result.status, 1);
  });
});

describe("branded short-link failure page (W5)", () => {
  it("includes Influrios CTA and optional outcome marker", () => {
    const html = brandedFallbackHtml("Link not found", "That Influrios short link does not exist.", {
      canonicalOrigin: "https://influrios.com",
      outcome: "not_found",
      ctaLabel: "Open Influrios",
    });
    assert.match(html, /Open Influrios/);
    assert.match(html, /href="https:\/\/influrios\.com"/);
    assert.match(html, /data-resolve-outcome="not_found"/);
    assert.match(html, /That Influrios short link does not exist/);
    assert.match(html, /Influencer profiles and collaborations live on Influrios/);
    assert.equal(html.includes("Sofia Carter"), false);
    assert.equal(html.includes("Georgia"), false);
  });
});
