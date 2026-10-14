import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
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
    const runbook = readFileSync("docs/deploy/STAGING_LAUNCH_INTEGRATIONS.md", "utf8");
    assert.match(runbook, /2026-10-12/);
    assert.match(runbook, /secrets\.authConfigured` true/);
    // E2 complete: sign-off SMTP cell holds mail_test + claim_verification evidence ids.
    assert.match(runbook, /\| SMTP \| `mail_test`=`cmv6wje8100a3o6018frdtn0r`/);
    assert.match(runbook, /claim_verification_email`=`cmv6evovt005jod0130bnxspo`/);
    assert.equal(pkg.scripts["staging:e2-smtp-evidence"], "bash scripts/staging-e2-smtp-evidence.sh");
    assert.equal(existsSync("scripts/staging-e2-smtp-evidence.sh"), true);
    assert.equal(pkg.scripts["staging:e4-stripe-evidence"], "bash scripts/staging-e4-stripe-evidence.sh");
    assert.equal(pkg.scripts["staging:e4-stripe-duplicate"], "bash scripts/staging-e4-stripe-evidence.sh --prove-duplicate");
    assert.equal(existsSync("scripts/staging-e4-stripe-evidence.sh"), true);
    assert.match(runbook, /### E4 progress \(Stripe sandbox\)/);
    assert.match(runbook, /staging:e4-stripe-evidence/);
    assert.match(runbook, /staging:e4-stripe-duplicate/);
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
