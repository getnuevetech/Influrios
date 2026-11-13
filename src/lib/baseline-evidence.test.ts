import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { baselineExitCode, baselineReport, classifyAvailability, classifyDeployedRevision } from "@/lib/baseline-evidence";
import { readDeploymentRevision } from "@/lib/deployment-revision";
import { releaseStagingFixtures, stagingFixturePlan, stagingFixturesMayRun, provisionStagingFixtures } from "@/lib/staging-fixtures";
import { prisma } from "@/lib/db";

const LIVE_HEALTH = {
  requestError: null,
  status: 200,
  body: JSON.stringify({
    ok: true,
    status: "ok",
    checks: { web: { ok: true }, db: { ok: true, latencyMs: 0 } },
    secrets: { authConfigured: true },
    ts: "2026-11-13T21:37:04.255Z",
  }),
};

describe("deployment baseline", () => {
  it("ignores a revision that is not a git SHA", () => {
    assert.equal(readDeploymentRevision(""), null);
    assert.equal(readDeploymentRevision("latest"), null);
    assert.equal(readDeploymentRevision("455865506fd0b2dd312ab8092ec22fd8bf84884c"), "455865506fd0b2dd312ab8092ec22fd8bf84884c");
  });

  it("records a gateway outage as Fail and does not call it a pass", () => {
    const row = classifyAvailability({ requestError: null, status: 502, body: "<html>502</html>" });
    assert.equal(row.mark, "Fail");
    assert.equal(row.actual.includes("502"), true);
    const revision = classifyDeployedRevision({ requestError: null, status: 502, body: "" }, "4558655");
    assert.equal(revision.mark, "Not run");
  });

  it("does not treat a healthy payload without a revision as a confirmed SHA", () => {
    const rows = baselineReport({
      snapshot: LIVE_HEALTH,
      expectedRevision: "455865506fd0b2dd312ab8092ec22fd8bf84884c",
      env: {},
      fixtures: { confirm: false, appHost: "influrios.com" },
    });
    const byId = Object.fromEntries(rows.map((item) => [item.id, item.mark]));
    assert.equal(byId.availability, "Pass");
    assert.equal(byId["deployed-sha"], "Not run");
    assert.equal(rows.find((item) => item.id === "deployed-sha")?.actual.includes("not confirmed"), true);
    assert.equal(byId["auth-configured"], "Pass");
    assert.equal(byId["stripe-sandbox-env"], "Not run");
    assert.equal(byId.fixtures, "Not run");
    assert.equal(baselineExitCode(rows), 1);
  });

  it("passes the SHA only when the published value matches", () => {
    const body = JSON.stringify({ ...JSON.parse(LIVE_HEALTH.body), revision: "455865506fd0b2dd312ab8092ec22fd8bf84884c" });
    const match = classifyDeployedRevision({ requestError: null, status: 200, body }, "4558655");
    assert.equal(match.mark, "Pass");
    assert.equal(baselineExitCode([match]), 0);
    const miss = classifyDeployedRevision({ requestError: null, status: 200, body }, "1944bfaa60aba64da1bbb2a0067b83e873c71f02");
    assert.equal(miss.mark, "Fail");
  });

  it("does not print a live Stripe key", () => {
    const rows = baselineReport({
      snapshot: LIVE_HEALTH,
      expectedRevision: null,
      env: { stripeSecretKey: "sk_live_secret_value" },
      fixtures: { confirm: true, appHost: "influrios.com" },
    });
    const stripe = rows.find((item) => item.id === "stripe-sandbox-env");
    assert.equal(stripe?.mark, "Fail");
    assert.equal(JSON.stringify(rows).includes("sk_live_secret_value"), false);
    const fixtures = rows.find((item) => item.id === "fixtures");
    assert.equal(fixtures?.mark, "Blocked");
  });

  it("refuses public hosts and lists the required disposable accounts", () => {
    assert.equal(stagingFixturesMayRun({ confirm: true, appHost: "influrios.com" }).ok, false);
    assert.equal(stagingFixturesMayRun({ confirm: true, appHost: "127.0.0.1:3000" }).ok, true);
    const plan = stagingFixturePlan("base1234");
    const kinds = plan.map((item) => item.kind);
    assert.deepEqual(kinds, [
      "business-a",
      "business-b",
      "influencer-a",
      "influencer-b",
      "agency-owner",
      "agency-manager",
      "agency-member",
      "agency-dual",
      "admin-super",
      "admin-restricted",
    ]);
    assert.equal(plan.every((item) => item.email.endsWith("@example.com")), true);
  });

  it("publishes revision from the image env and the deploy script", () => {
    const health = readFileSync("src/app/api/health/route.ts", "utf8");
    assert.match(health, /readDeploymentRevision/);
    assert.match(health, /INFLURIOS_REVISION/);
    const deploy = readFileSync("deploy/scripts/deploy.sh", "utf8");
    assert.match(deploy, /export INFLURIOS_REVISION="\$\(git rev-parse HEAD\)"/);
    const image = readFileSync("Dockerfile", "utf8");
    assert.match(image, /ENV INFLURIOS_REVISION=/);
  });

  it("creates and removes the disposable roster when a database is configured", async (t) => {
    if (!process.env.DATABASE_URL) {
      t.skip("DATABASE_URL is not set");
      return;
    }
    const stamp = `b${Date.now().toString(36)}`.slice(0, 12);
    try {
      const created = await provisionStagingFixtures(stamp);
      assert.equal(created.emails.length, 10);
      const dual = created.emails.find((value) => value.includes("agency-dual"));
      const seats = await prisma.agencySeat.findMany({ where: { email: dual } });
      assert.equal(seats.length, 2);
      assert.equal(new Set(seats.map((seat) => seat.workspaceId)).size, 2);
      const restrictedEmail = created.emails.find((value) => value.includes("admin-restricted"));
      assert.ok(restrictedEmail);
      const restricted = await prisma.adminUser.findUnique({
        where: { email: restrictedEmail },
        include: { role: true },
      });
      assert.equal(restricted?.role.system, false);
      assert.deepEqual(restricted?.role.permissions, ["invitations.view"]);
      const businesses = await prisma.user.count({
        where: { email: { in: created.emails }, role: "BUSINESS" },
      });
      assert.equal(businesses, 2);
    } finally {
      await releaseStagingFixtures(stamp);
      const left = await prisma.user.count({ where: { email: { contains: `staging.${stamp}.` } } });
      assert.equal(left, 0);
    }
  });
});
