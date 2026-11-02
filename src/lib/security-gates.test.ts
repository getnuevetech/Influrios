import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { describe, it } from "node:test";

function src(path: string) {
  return readFileSync(path, "utf8");
}

describe("W0–W2 security gates", () => {
  it("keeps /payments signed-in and scoped (no global listFundings)", () => {
    const layout = src("src/app/payments/layout.tsx");
    const page = src("src/app/payments/page.tsx");
    const actions = src("src/app/payments/actions.ts");
    assert.match(layout, /getAccountSession/);
    assert.match(layout, /redirect\("\/login\?next=\/payments/);
    assert.match(page, /listFundingsForBusiness|listFundingsForCreator/);
    assert.equal(page.includes("listFundings()"), false);
    assert.equal(page.includes("actionCreateDeal"), false);
    assert.match(page, /Start funding|signed collaboration contract/i);
    assert.match(actions, /assertFundingAccess/);
    assert.match(actions, /Fund from a signed/);
  });

  it("keeps Start funding business-only on signed contracts", () => {
    const detail = src("src/app/collaboration/contracts/[id]/page.tsx");
    assert.match(detail, /canStartFunding = Boolean\(party && party\.role === "business"\)/);
    assert.match(detail, /Start funding/);
    assert.equal(detail.includes("Request funding"), false);
    const wizard = src("src/app/collaboration/contract/page.tsx");
    assert.match(wizard, /requireBusinessSession\("\/collaboration\/contract"\)/);
    assert.match(wizard, /Start funding →/);
  });

  it("persists auth lockouts and gates soft collab layouts", () => {
    assert.match(src("prisma/schema.prisma"), /model AuthLockout/);
    assert.equal(existsSync("prisma/migrations/20261102040000_auth_lockout/migration.sql"), true);
    assert.match(src("src/lib/auth-lockout.ts"), /prisma\.authLockout/);
    assert.match(src("src/app/collaboration/contract/layout.tsx"), /requireBusinessSession/);
    for (const file of [
      "src/app/collaboration/applications/layout.tsx",
      "src/app/collaboration/contracts/layout.tsx",
      "src/app/collaboration/team/layout.tsx",
    ]) {
      assert.match(src(file), /redirect\(/);
    }
    const exportRoute = src("src/app/api/intelligence/export/route.ts");
    assert.match(exportRoute, /isBusinessRole/);
    assert.match(exportRoute, /intelligence-export/);
    assert.match(exportRoute, /429/);
  });

  it("records host 502 recovery and fails E6 script without health", () => {
    const runbook = src("docs/deploy/STAGING_LAUNCH_INTEGRATIONS.md");
    assert.match(runbook, /Host outage \(2026-11-02\)/);
    assert.match(runbook, /502 Bad Gateway/);
    assert.match(runbook, /\*\*recovered\*\*/);
    assert.match(runbook, /8\/8 auto checks pass/);
    assert.match(runbook, /Signature did not match/);
    assert.match(runbook, /Start funding/);
    const e6 = src("scripts/staging-e6-marketplace-evidence.sh");
    assert.match(e6, /\/api\/health/);
    assert.match(e6, /ERROR: web is not healthy/);
    assert.match(src("deploy/scripts/diagnose-502.sh"), /staging-evidence-probe/);
  });

  it("sets Secure on account session cookies over HTTPS", () => {
    const accounts = src("src/lib/accounts.ts");
    assert.match(accounts, /cookieIsSecure/);
    assert.match(accounts, /secure:\s*cookieIsSecure/);
  });
});
