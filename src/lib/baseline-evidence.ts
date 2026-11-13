import { readDeploymentRevision } from "@/lib/deployment-revision";

export type EvidenceMark = "Pass" | "Fail" | "Blocked" | "Not run";

export type BaselineRow = {
  id: string;
  mark: EvidenceMark;
  expected: string;
  actual: string;
};

export type HealthSnapshot = {
  requestError: string | null;
  status: number | null;
  body: string;
};

const GATEWAY = new Set([502, 503, 504]);

function row(id: string, mark: EvidenceMark, expected: string, actual: string): BaselineRow {
  return { id, mark, expected, actual };
}

function parsedHealth(body: string): Record<string, unknown> | null {
  try {
    const value = JSON.parse(body) as unknown;
    if (!value || typeof value !== "object" || Array.isArray(value)) return null;
    return value as Record<string, unknown>;
  } catch {
    return null;
  }
}

export function classifyAvailability(snapshot: HealthSnapshot): BaselineRow {
  const expected = "HTTPS /api/health returns 200 with ok true and the database check ok.";
  if (snapshot.requestError) {
    return row("availability", "Blocked", expected, snapshot.requestError);
  }
  if (snapshot.status == null) {
    return row("availability", "Blocked", expected, "No HTTP status was recorded.");
  }
  if (GATEWAY.has(snapshot.status)) {
    return row(
      "availability",
      "Fail",
      expected,
      `HTTP ${snapshot.status}. The gateway answered and the app did not.`,
    );
  }
  const health = parsedHealth(snapshot.body);
  const db = health?.checks && typeof health.checks === "object" ? (health.checks as { db?: { ok?: unknown } }).db : null;
  const dbOk = db?.ok === true;
  if (snapshot.status === 200 && health?.ok === true && dbOk) {
    return row("availability", "Pass", expected, "HTTP 200, ok true, database check ok.");
  }
  return row(
    "availability",
    "Fail",
    expected,
    `HTTP ${snapshot.status}, ok ${String(health?.ok)}, database ${String(db?.ok)}.`,
  );
}

export function classifyDeployedRevision(snapshot: HealthSnapshot, expectedRevision: string | null): BaselineRow {
  const expected = "The running process publishes the git SHA it was built from.";
  if (snapshot.requestError || snapshot.status == null || GATEWAY.has(snapshot.status)) {
    return row("deployed-sha", "Not run", expected, "Health did not return an app payload.");
  }
  const health = parsedHealth(snapshot.body);
  const observed = readDeploymentRevision(typeof health?.revision === "string" ? health.revision : null);
  const expectedSha = readDeploymentRevision(expectedRevision);
  if (!observed) {
    return row(
      "deployed-sha",
      "Not run",
      expected,
      "The health payload has no revision. The running commit is not confirmed.",
    );
  }
  if (!expectedSha) {
    return row(
      "deployed-sha",
      "Not run",
      expected,
      `The process published ${observed}. No expected SHA was supplied, so it was not compared.`,
    );
  }
  const same = observed === expectedSha || observed.startsWith(expectedSha) || expectedSha.startsWith(observed);
  if (same) {
    return row("deployed-sha", "Pass", expected, `Published ${observed} matches ${expectedSha}.`);
  }
  return row("deployed-sha", "Fail", expected, `Published ${observed}. Expected ${expectedSha}.`);
}

export function classifyAuthConfigured(snapshot: HealthSnapshot): BaselineRow {
  const expected = "Health reports authConfigured true without revealing the secret.";
  if (snapshot.requestError || snapshot.status == null || GATEWAY.has(snapshot.status)) {
    return row("auth-configured", "Not run", expected, "Health did not return an app payload.");
  }
  const health = parsedHealth(snapshot.body);
  const secrets = health?.secrets && typeof health.secrets === "object" ? (health.secrets as { authConfigured?: unknown }) : null;
  if (secrets?.authConfigured === true) {
    return row("auth-configured", "Pass", expected, "authConfigured is true.");
  }
  if (secrets?.authConfigured === false) {
    return row("auth-configured", "Fail", expected, "authConfigured is false.");
  }
  return row("auth-configured", "Not run", expected, "Health did not include secrets.authConfigured.");
}

/** Local process only. Never prints a key and never calls a provider. */
export function classifySandboxEnv(env: { stripeSecretKey?: string; smtpHost?: string }): BaselineRow[] {
  const stripe = (env.stripeSecretKey ?? "").trim();
  const stripeExpected = "This process has a Stripe test key. The value is not printed and Stripe is not called.";
  let stripeRow: BaselineRow;
  if (!stripe) {
    stripeRow = row("stripe-sandbox-env", "Not run", stripeExpected, "STRIPE_SECRET_KEY is not set in this process.");
  } else if (stripe.startsWith("sk_test_") || stripe.startsWith("rk_test_")) {
    stripeRow = row("stripe-sandbox-env", "Pass", stripeExpected, "A Stripe test key is present. It was not sent anywhere.");
  } else if (stripe.startsWith("sk_live_") || stripe.startsWith("rk_live_")) {
    stripeRow = row("stripe-sandbox-env", "Fail", stripeExpected, "A live Stripe key is present. It was not sent anywhere.");
  } else {
    stripeRow = row("stripe-sandbox-env", "Not run", stripeExpected, "STRIPE_SECRET_KEY is set but is not a recognized test or live key.");
  }
  const smtpExpected = "This process has an SMTP host for test mail. Mail is not sent.";
  const smtpRow = (env.smtpHost ?? "").trim()
    ? row("smtp-env", "Pass", smtpExpected, "SMTP_HOST is set. No message was sent.")
    : row("smtp-env", "Not run", smtpExpected, "SMTP_HOST is not set in this process.");
  return [stripeRow, smtpRow];
}

export function classifyFixtureRequest(input: { confirm: boolean; appHost: string | null }): BaselineRow {
  const expected = "Disposable accounts are created only on localhost, never on the public host.";
  if (!input.confirm) {
    return row("fixtures", "Not run", expected, "STAGING_FIXTURES is not 1. No accounts were created.");
  }
  const host = (input.appHost ?? "").toLowerCase().split(":")[0];
  if (host === "127.0.0.1" || host === "localhost") {
    return row("fixtures", "Pass", expected, "Fixture creation was requested against localhost.");
  }
  return row("fixtures", "Blocked", expected, `Refused to create accounts for host ${host || "(none)"}.`);
}

export function baselineReport(input: {
  snapshot: HealthSnapshot;
  expectedRevision: string | null;
  env: { stripeSecretKey?: string; smtpHost?: string };
  fixtures: { confirm: boolean; appHost: string | null };
}): BaselineRow[] {
  return [
    classifyAvailability(input.snapshot),
    classifyDeployedRevision(input.snapshot, input.expectedRevision),
    classifyAuthConfigured(input.snapshot),
    ...classifySandboxEnv(input.env),
    classifyFixtureRequest(input.fixtures),
  ];
}

/** Fail, or an unconfirmed deployed SHA, is an incomplete baseline. Other Not run rows stay visible and do not change this code. */
export function baselineExitCode(rows: readonly BaselineRow[]): number {
  const revision = rows.find((item) => item.id === "deployed-sha");
  if (rows.some((item) => item.mark === "Fail")) return 1;
  if (revision && revision.mark !== "Pass") return 1;
  return 0;
}

export function formatBaselineReport(rows: readonly BaselineRow[]): string {
  const lines = ["| Check | Result | Expected | Actual |", "|-------|--------|----------|--------|"];
  for (const item of rows) {
    lines.push(`| ${item.id} | ${item.mark} | ${item.expected.replace(/\|/g, "/")} | ${item.actual.replace(/\|/g, "/")} |`);
  }
  return lines.join("\n");
}
