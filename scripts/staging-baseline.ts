/**
 * Step 1 baseline. Records what the public host actually returns.
 * A missing revision is Not run, not Pass. A gateway 502/503/504 is Fail.
 * This script does not create accounts unless STAGING_FIXTURES=1 and the host is localhost.
 * It does not call Stripe, SMTP, or payout providers.
 */
import { baselineExitCode, baselineReport, formatBaselineReport, type BaselineRow } from "../src/lib/baseline-evidence";
import { provisionStagingFixtures, stagingFixturesMayRun } from "../src/lib/staging-fixtures";

const app = (process.env.STAGING_URL || "https://influrios.com").replace(/\/$/, "");

function hostOf(url: string): string | null {
  try {
    return new URL(url).host;
  } catch {
    return null;
  }
}

async function main() {
  let status: number | null = null;
  let body = "";
  let requestError: string | null = null;
  try {
    const response = await fetch(`${app}/api/health`, {
      redirect: "manual",
      signal: AbortSignal.timeout(20_000),
      headers: { "user-agent": "influrios-baseline/1.0" },
    });
    status = response.status;
    body = await response.text();
  } catch (error) {
    requestError = error instanceof Error ? error.message : "request failed";
  }

  const confirm = process.env.STAGING_FIXTURES === "1";
  const rows: BaselineRow[] = baselineReport({
    snapshot: { requestError, status, body },
    expectedRevision: process.env.EXPECTED_REVISION ?? null,
    env: {
      stripeSecretKey: process.env.STRIPE_SECRET_KEY,
      smtpHost: process.env.SMTP_HOST,
    },
    fixtures: { confirm, appHost: hostOf(app) },
  });

  console.log(`Baseline ${app}`);
  console.log(formatBaselineReport(rows));

  const gate = stagingFixturesMayRun({ confirm, appHost: hostOf(app) });
  if (confirm && gate.ok) {
    const stamp = (process.env.STAGING_FIXTURE_STAMP || "").trim().toLowerCase();
    if (!stamp) {
      console.log("\nFixtures: Blocked. Set STAGING_FIXTURE_STAMP to 4-12 letters or digits.");
      process.exitCode = 1;
    } else {
      const created = await provisionStagingFixtures(stamp);
      console.log(`\nFixtures created for stamp ${created.stamp}. Emails use example.com. No mail was sent.`);
    }
  } else if (confirm && !gate.ok) {
    console.log(`\nFixtures: ${gate.reason}`);
  }

  if (baselineExitCode(rows) !== 0 || rows.some((item) => item.mark === "Blocked" && confirm)) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "baseline failed");
  process.exit(1);
});
