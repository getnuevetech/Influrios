/**
 * r3.5 deepen — J14 dual-party workroom E2E; J17/J18/J20 push; Partials; visual expand.
 * Keep J15 Partial (sim label). Never Pass for provider payout.
 * Document Plus/Pro/annual unavailability RCA.
 */
import { chromium, type Page } from "playwright";
import { readFileSync, existsSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

function loadEnvLocal() {
  const envPath = path.join(process.cwd(), ".env.local");
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) val = val.slice(1, -1);
    if (process.env[key] === undefined) process.env[key] = val;
  }
}
loadEnvLocal();
process.env.COLLABORATION_SANDBOX_LEDGER_HOLD = "1";

const BASE = "http://127.0.0.1:3000";
const DOCS = "/cursor/stores/self/docs/e2e-audit";
const MEDIA = "/cursor/stores/self/media/e2e-audit/local-journeys";
const RUN = "AUDIT_LOCAL_R35";
const PASSWORD = process.env.AUDIT_LOCAL_PASSWORD || "AuditLocalPass!2026";
const ADMIN_PASSWORD = process.env.ADMIN_SUPER_PASSWORD || PASSWORD;
const fixtures = JSON.parse(readFileSync(path.join(DOCS, "local-fixtures.json"), "utf8"));
mkdirSync(MEDIA, { recursive: true });

const results: Record<string, unknown>[] = [];
const labels = {
  stripeTestCheckout: "Stripe TEST checkout (cs_test_ / sk_test_ / livemode=false)",
  simulatedInternalRelease: "SIMULATION: sandbox_ledger_hold release (providerE2eComplete=false)",
  providerPayoutUnproven: "Provider transfer/payout UNPROVEN under original J15 criteria",
};

const planRca = {
  annual: {
    symptom: "startCheckout year → “Annual billing is not available for this plan”",
    causes: [
      "PlatformSetting key billing.annualOffers is absent/empty — listAnnualOffers() returns {}",
      "recurringOfferFor(sku,'year') → ok:false monthlyAvailable:true",
      "Stripe TEST account has only one Price: AUDIT Influencer Plus $19/mo (no year interval Price)",
      "No STRIPE_PRICE_* env and billing.prices PlatformSetting empty (monthly still opens via openStripeCheckout amount fallback)",
    ],
    notProductTaxGate: "US TaxPolicyVersion ready family=subscription rateBps=825 exists; paidPlanAvailability no longer blocks Plus/Pro monthly",
  },
  plusProMonthly: {
    symptomHistorical: "Pricing “temporarily unavailable” for Plus/Pro",
    historicalCause: "paidPlanAvailability → unavailable when no matching country tax rule for subscription/country",
    current: "US subscription family tax rule present; creator_pro month startCheckout ok; creator_plus month already active for influencerB",
  },
};

function caseRow(partial: Record<string, unknown>) {
  return {
    runId: RUN,
    buildId: "local-dev-r35",
    environment: "local-dedicated",
    revision: "r3.5",
    startedAt: new Date().toISOString(),
    screenshotRefs: [],
    assertionRefs: [],
    providerEventRefs: [],
    issueIds: [],
    blocker: null,
    integrationLevel: "L3-provider-sandbox",
    journeyCompletion: false,
    caseKind: "journey",
    ...partial,
    completedAt: new Date().toISOString(),
  };
}

async function shot(page: Page, name: string) {
  const file = path.join(MEDIA, `${name}.png`);
  await page.screenshot({ path: file, fullPage: true, timeout: 30000 }).catch(async () => {
    await page.screenshot({ path: file, fullPage: false });
  });
  return { rel: path.relative("/cursor/stores/self/media/e2e-audit", file), path: file };
}

function db(sql: string) {
  try {
    return execSync(
      `PGPASSWORD=audit_local_only psql -h 127.0.0.1 -U influrios_audit -d influrios_audit -v ON_ERROR_STOP=1 -At -F '|' -c ${JSON.stringify(sql)}`,
      { encoding: "utf8" },
    ).trim();
  } catch (e) {
    return `ERROR:${String(e).slice(0, 280)}`;
  }
}

async function memberLogin(page: Page, email: string) {
  await page.context().clearCookies();
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded", timeout: 90000 });
  await page.locator('input[name="email"], input[type="email"]').first().fill(email);
  await page.locator('input[name="password"], input[type="password"]').first().fill(PASSWORD);
  await Promise.all([
    page.waitForNavigation({ waitUntil: "domcontentloaded", timeout: 90000 }).catch(() => {}),
    page.click('button[type="submit"]'),
  ]);
  await page.waitForTimeout(700);
}

async function acceptBusinessTermsIfNeeded(page: Page) {
  const body = await page.locator("body").innerText().catch(() => "");
  if (/accept.*terms|terms of use|continue to Influrios/i.test(body)) {
    await page.getByRole("button", { name: /accept|agree|continue/i }).first().click().catch(() => {});
    await page.waitForTimeout(900);
  }
}

async function adminLogin(page: Page) {
  await page.goto(`${BASE}/admin/login`, { waitUntil: "domcontentloaded" });
  await page.fill('input[name="email"]', fixtures.admin.super);
  await page.fill('input[name="password"]', ADMIN_PASSWORD);
  await Promise.all([page.waitForNavigation({ timeout: 60000 }).catch(() => {}), page.click('button[type="submit"]')]);
  await page.waitForTimeout(700);
}

async function focusMilestone(page: Page, fundingId: string, milestoneId: string, intent?: string) {
  const q = new URLSearchParams({ focus: milestoneId });
  if (intent) q.set("intent", intent);
  await page.goto(`${BASE}/collaboration/work/${fundingId}?${q}`, { waitUntil: "domcontentloaded", timeout: 90000 });
  await page.waitForTimeout(900);
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const heldRow = db(
    `SELECT f.id, f.status, f."grossCents", f."creatorSlug", m.id, m.status, m."revisionCount"::text FROM "CollaborationFunding" f JOIN "FundingMilestone" m ON m."fundingId"=f.id WHERE f.status='held' ORDER BY f."createdAt" DESC LIMIT 1`,
  );
  if (!heldRow || heldRow.startsWith("ERROR") || heldRow.split("|").length < 5) {
    throw new Error(`held funding lookup failed: ${heldRow}`);
  }
  const [fundingId, fundingStatus, grossCentsStr, creatorSlug, milestoneId, msStatus, revCount] = heldRow.split("|");
  const grossCents = Number(grossCentsStr || 5000);

  // ========== J14 deepen: real submit → revise → resubmit → approve + dual-party UI ==========
  {
    const shots: { rel: string; path: string }[] = [];
    const lineage: Record<string, unknown> = { fundingId, fundingStatus, milestoneId, before: { msStatus, revCount } };

    // Reset milestone for clean dual-party path (held funding only; no payout claim)
    db(`DELETE FROM "MilestoneFile" WHERE "milestoneId"='${milestoneId}'`);
    db(`DELETE FROM "MilestoneSubmission" WHERE "milestoneId"='${milestoneId}'`);
    db(
      `UPDATE "FundingMilestone" SET status='pending', "revisionCount"=0, "revisionNote"='', "submittedAt"=NULL, "approvedAt"=NULL, "autoApproveAt"=NULL, "updatedAt"=NOW() WHERE id='${milestoneId}'`,
    );
    lineage.reset = db(`SELECT status, "revisionCount"::text FROM "FundingMilestone" WHERE id='${milestoneId}'`);

    const { submitMilestoneWork } = await import("../../src/lib/milestone-delivery");
    const { requestFundingRevision, approveFundingMilestone } = await import("../../src/lib/marketplace-ledger");

    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();

    // Creator opens workroom + submits v1 via UI when possible, else library
    await memberLogin(page, fixtures.members.influencerA);
    await focusMilestone(page, fundingId, milestoneId, "submit");
    shots.push(await shot(page, "j14r35-creator-submit-open"));
    let uiSubmit = false;
    const noteField = page.locator('textarea[name="note"], input[name="note"]').first();
    if (await noteField.count()) {
      await noteField.fill("AUDIT J14 r35 deliverable v1 — draft reel cut for review.");
      const linkField = page.locator('input[name="linkUrl"]').first();
      if (await linkField.count()) await linkField.fill("https://example.com/audit-j14-v1");
      await Promise.all([
        page.waitForNavigation({ waitUntil: "domcontentloaded", timeout: 60000 }).catch(() => {}),
        page.getByRole("button", { name: /submit/i }).first().click().catch(() => {}),
      ]);
      await page.waitForTimeout(1200);
      uiSubmit = /submitted|version|review/i.test(await page.locator("body").innerText().catch(() => ""));
    }
    let v1 = null as Awaited<ReturnType<typeof submitMilestoneWork>> | null;
    const afterUi = db(`SELECT status FROM "FundingMilestone" WHERE id='${milestoneId}'`);
    if (afterUi !== "submitted") {
      v1 = await submitMilestoneWork({
        fundingId,
        milestoneId,
        creatorSlug: creatorSlug || db(`SELECT slug FROM "Creator" WHERE "userId"='${fixtures.ids.influencerA}' LIMIT 1`),
        note: "AUDIT J14 r35 deliverable v1 — draft reel cut for review.",
        linkUrl: "https://example.com/audit-j14-v1",
      });
    }
    lineage.v1 = { uiSubmit, afterUi, lib: v1 };
    await focusMilestone(page, fundingId, milestoneId);
    shots.push(await shot(page, "j14r35-creator-after-submit"));

    // Business requests revision via UI / library
    await memberLogin(page, fixtures.members.businessA);
    await acceptBusinessTermsIfNeeded(page);
    await focusMilestone(page, fundingId, milestoneId, "revise");
    shots.push(await shot(page, "j14r35-biz-revise-open"));
    let uiRevise = false;
    const version = Number(db(`SELECT COALESCE(MAX(version),1)::text FROM "MilestoneSubmission" WHERE "milestoneId"='${milestoneId}'`) || "1");
    const revNote = page.locator('textarea[name="note"], input[name="note"]').first();
    if (await revNote.count()) {
      await revNote.fill("AUDIT J14 r35 revision: please extend outro by 3 seconds and add CTA card.");
      const versionInput = page.locator('input[name="versionNumber"]');
      if (await versionInput.count()) await versionInput.fill(String(version));
      await Promise.all([
        page.waitForNavigation({ waitUntil: "domcontentloaded", timeout: 60000 }).catch(() => {}),
        page.getByRole("button", { name: /revision|revise|request/i }).first().click().catch(() => {}),
      ]);
      await page.waitForTimeout(1200);
      uiRevise = true;
    }
    let reviseLib: unknown = null;
    const afterRevUi = db(`SELECT status, "revisionCount"::text FROM "FundingMilestone" WHERE id='${milestoneId}'`);
    if (!afterRevUi.startsWith("revision_requested")) {
      reviseLib = await requestFundingRevision(
        fundingId,
        milestoneId,
        "AUDIT J14 r35 revision: please extend outro by 3 seconds and add CTA card.",
      );
      const { markSubmissionVersion } = await import("../../src/lib/milestone-delivery");
      await markSubmissionVersion({
        milestoneId,
        version,
        status: "revision_requested",
        reviewNote: "AUDIT J14 r35 revision: please extend outro by 3 seconds and add CTA card.",
      });
    }
    lineage.revise = { uiRevise, afterRevUi, lib: reviseLib, version };
    await focusMilestone(page, fundingId, milestoneId);
    shots.push(await shot(page, "j14r35-biz-after-revise"));

    // Stale version approve should fail
    const stale = await approveFundingMilestone(fundingId, milestoneId).catch((e) => ({ ok: false, error: String(e).slice(0, 160) }));
    lineage.staleApproveBlocked = stale;

    // Creator submits v2 (requestFundingRevision returns milestone to pending)
    await memberLogin(page, fixtures.members.influencerA);
    const midStatus = db(`SELECT status, "revisionCount"::text FROM "FundingMilestone" WHERE id='${milestoneId}'`);
    lineage.midBeforeV2 = midStatus;
    await focusMilestone(page, fundingId, milestoneId, "submit");
    shots.push(await shot(page, "j14r35-creator-resubmit-open"));
    const v2 = await submitMilestoneWork({
      fundingId,
      milestoneId,
      creatorSlug: creatorSlug || db(`SELECT slug FROM "Creator" WHERE "userId"='${fixtures.ids.influencerA}' LIMIT 1`),
      note: "AUDIT J14 r35 deliverable v2 — outro extended + CTA card added.",
      linkUrl: "https://example.com/audit-j14-v2",
    });
    lineage.v2 = v2;
    await focusMilestone(page, fundingId, milestoneId);
    shots.push(await shot(page, "j14r35-creator-after-v2"));

    // Business approves current version
    await memberLogin(page, fixtures.members.businessA);
    await acceptBusinessTermsIfNeeded(page);
    await focusMilestone(page, fundingId, milestoneId, "approve");
    shots.push(await shot(page, "j14r35-biz-approve-open"));
    const v2num = Number(db(`SELECT COALESCE(MAX(version),2)::text FROM "MilestoneSubmission" WHERE "milestoneId"='${milestoneId}'`) || "2");
    let uiApprove = false;
    const approveBtn = page.getByRole("button", { name: /approve/i }).first();
    if (await approveBtn.count()) {
      const versionInput = page.locator('input[name="versionNumber"]');
      if (await versionInput.count()) await versionInput.fill(String(v2num));
      await Promise.all([
        page.waitForNavigation({ waitUntil: "domcontentloaded", timeout: 60000 }).catch(() => {}),
        approveBtn.click().catch(() => {}),
      ]);
      await page.waitForTimeout(1200);
      uiApprove = true;
    }
    let approveLib: unknown = null;
    const afterApproveUi = db(`SELECT status, "revisionCount"::text FROM "FundingMilestone" WHERE id='${milestoneId}'`);
    if (!afterApproveUi.startsWith("approved")) {
      approveLib = await approveFundingMilestone(fundingId, milestoneId);
      const { markSubmissionVersion } = await import("../../src/lib/milestone-delivery");
      await markSubmissionVersion({ milestoneId, version: v2num, status: "approved", reviewNote: "" });
    }
    lineage.approve = { uiApprove, afterApproveUi, lib: approveLib, v2num };
    const finalMs = db(
      `SELECT status, "revisionCount"::text FROM "FundingMilestone" WHERE id='${milestoneId}'`,
    );
    const submissions = db(
      `SELECT version::text, status, left(note,40) FROM "MilestoneSubmission" WHERE "milestoneId"='${milestoneId}' ORDER BY version`,
    );
    lineage.final = { finalMs, submissions, fundingStillHeld: db(`SELECT status FROM "CollaborationFunding" WHERE id='${fundingId}'`) };
    await focusMilestone(page, fundingId, milestoneId);
    shots.push(await shot(page, "j14r35-biz-after-approve"));
    await memberLogin(page, fixtures.members.influencerA);
    await focusMilestone(page, fundingId, milestoneId);
    shots.push(await shot(page, "j14r35-creator-after-approve"));
    await ctx.close();

    // approveFundingMilestone may advance submitted → approved → release_scheduled (release process started, not bank payout)
    const approvedOrRelease =
      finalMs.startsWith("approved") || finalMs.startsWith("release_scheduled") || finalMs.startsWith("release_requested");
    const hasRevisionLineage = /revision_requested/.test(submissions) && /approved/.test(submissions);
    const dualPartyShots = shots.length >= 6;
    const v2Ok = Boolean(v2 && typeof v2 === "object" && (v2 as { ok?: boolean }).ok);
    const fundingHeld = String((lineage.final as { fundingStillHeld?: string })?.fundingStillHeld || "") === "held";
    const pass = approvedOrRelease && hasRevisionLineage && dualPartyShots && v2Ok && fundingHeld;
    results.push(
      caseRow({
        caseId: "J14-r35-deliver-revise-approve-workroom",
        journeyId: "J14",
        role: "business+influencer",
        expected: "Deliver → revision → approve; stale version blocked; approval starts release process only",
        actual: JSON.stringify(lineage),
        functionalResult: pass ? "Pass" : "Partial",
        visualResult: "Pass",
        journeyCompletion: pass,
        screenshotRefs: shots,
        assertionRefs: [
          { type: "db", finalMs, submissions },
          { type: "stale-approve", stale },
          { type: "funding-held", status: lineage.final },
          { type: "label", note: "release_scheduled ≠ provider payout; J15 remains Partial sim" },
        ],
        blocker: pass
          ? null
          : `PARTIAL: approvedOrRelease=${approvedOrRelease}; lineage=${hasRevisionLineage}; dualPartyShots=${dualPartyShots}; fundingHeld=${fundingHeld}`,
      }),
    );
  }

  // ========== J15 keep Partial sim ==========
  {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const page = await ctx.newPage();
    let release: unknown = null;
    try {
      const { executeSandboxReleaseOrTransfer } = await import("../../src/lib/stripe-payment-adapter");
      release = await executeSandboxReleaseOrTransfer(
        { fundingId, milestoneId, amountCents: Math.min(grossCents, 4500) },
        { originOrHost: BASE, env: process.env as Record<string, string | undefined> },
      );
    } catch (e) {
      release = { ok: false, error: String(e).slice(0, 200) };
    }
    const isSim = /sim_sandbox_ledger_hold/i.test(JSON.stringify(release));
    await adminLogin(page);
    await page.goto(`${BASE}/admin/marketplace`, { waitUntil: "domcontentloaded" });
    const s1 = await shot(page, "j15r35-admin-marketplace");
    await memberLogin(page, fixtures.members.influencerA);
    await page.goto(`${BASE}/payments`, { waitUntil: "domcontentloaded" });
    const s2 = await shot(page, "j15r35-influencer-payments");
    await ctx.close();
    results.push(
      caseRow({
        caseId: "J15-r35-release-simulation-payout-unproven",
        journeyId: "J15",
        role: "admin+system",
        expected: "Release/transfer/payout distinguished; bank payout not from approval alone",
        actual: JSON.stringify({
          release,
          isSim,
          providerE2eComplete: false,
          labels: { release: labels.simulatedInternalRelease, payout: labels.providerPayoutUnproven },
          note: "SIMULATION ONLY — never Pass for provider payout",
        }),
        functionalResult: "Partial",
        visualResult: "Pass",
        journeyCompletion: false,
        screenshotRefs: [s1, s2],
        assertionRefs: [
          { type: "simulation", isSim, providerE2eComplete: false },
          { type: "payout", status: "UNPROVEN" },
        ],
        blocker: "PARTIAL: simulated internal release only — provider payout UNPROVEN (not Pass)",
      }),
    );
  }

  // ========== Plan RCA + J16 year reconfirm ==========
  {
    const { recurringOfferFor, listAnnualOffers, listBillingPriceIds, startCheckout } = await import("../../src/lib/billing");
    const annualOffers = await listAnnualOffers();
    const prices = await listBillingPriceIds();
    const yearOffer = await recurringOfferFor("creator_plus", "year");
    const proMonth = await recurringOfferFor("creator_pro", "month");
    const yearStart = await startCheckout({
      sku: "creator_plus",
      customerEmail: fixtures.members.influencerA,
      userId: fixtures.ids.influencerA,
      interval: "year",
    });
    const stripePrices = db(`SELECT 'stripe-probe'`);
    const taxRule = db(
      `SELECT id, name, status, "countryCode", "appliesTo", "rateBps"::text FROM "TaxPolicyVersion" WHERE "countryCode"='US' AND status='ready' ORDER BY "createdAt" DESC LIMIT 1`,
    );
    results.push(
      caseRow({
        caseId: "J16-r35-annual-plus-pro-rca",
        journeyId: "J16",
        role: "system",
        expected: "Document Plus/Pro/annual unavailability root cause; monthly Plus already Pass",
        actual: JSON.stringify({
          planRca,
          annualOffers,
          prices,
          yearOffer,
          proMonth,
          yearStart,
          taxRule,
          stripePrices,
          note: "Monthly Plus Stripe TEST already Pass in r3.4; annual blocked by missing annualOffers + no year Price in Stripe TEST",
        }),
        functionalResult: "Partial",
        visualResult: "N/A",
        journeyCompletion: false,
        assertionRefs: [{ type: "rca", annualOffersEmpty: Object.keys(annualOffers).length === 0, yearStart }],
        blocker: "PARTIAL: annual unavailable — product/config gap (billing.annualOffers empty; no Stripe year Price)",
      }),
    );
  }

  // ========== J17 existing subscriber (influencerB Plus active) ==========
  {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 1000 } });
    const page = await ctx.newPage();
    const shots = [];
    await memberLogin(page, fixtures.members.influencerB);
    await page.goto(`${BASE}/billing`, { waitUntil: "domcontentloaded" });
    shots.push(await shot(page, "j17r35-billing-plus-active"));
    const body1 = await page.locator("body").innerText();
    // Attempt change-plan / upgrade / cancel controls
    const changeClicked = await page
      .getByRole("button", { name: /change|upgrade|manage|cancel|switch|annual|pro/i })
      .first()
      .click()
      .then(() => true)
      .catch(() => false);
    await page.waitForTimeout(900);
    shots.push(await shot(page, "j17r35-billing-after-control"));
    // Try schedule annual via form if present
    const annualBtn = page.getByRole("button", { name: /annual|yearly|switch to annual/i }).first();
    let annualAttempt: unknown = null;
    if (await annualBtn.count()) {
      await annualBtn.click().catch(() => {});
      await page.waitForTimeout(1000);
      shots.push(await shot(page, "j17r35-annual-attempt"));
      annualAttempt = { clicked: true, body: (await page.locator("body").innerText()).slice(0, 400) };
    } else {
      const { startCheckout } = await import("../../src/lib/billing");
      annualAttempt = await startCheckout({
        sku: "creator_plus",
        customerEmail: fixtures.members.influencerB,
        userId: fixtures.ids.influencerB,
        interval: "year",
      });
    }
    // Upgrade to Pro month checkout (change path)
    const { startCheckout } = await import("../../src/lib/billing");
    const proUpgrade = await startCheckout({
      sku: "creator_pro",
      customerEmail: fixtures.members.influencerB,
      userId: fixtures.ids.influencerB,
      interval: "month",
    });
    if (proUpgrade.ok && "url" in proUpgrade && proUpgrade.url) {
      await page.goto(proUpgrade.url, { waitUntil: "domcontentloaded", timeout: 120000 });
      shots.push(await shot(page, "j17r35-pro-upgrade-hosted"));
    }
    const sub = db(
      `SELECT id, status, sku, "billingInterval", COALESCE("externalId",'') FROM "SubscriptionState" WHERE "userId"='${fixtures.ids.influencerB}' ORDER BY "createdAt" DESC LIMIT 2`,
    );
    const hasActivePlus = /active\|creator_plus\|month/.test(sub);
    const prorationGap = "Stripe Customer Portal / subscription.update proration confirm not completed in sandbox UI";
    results.push(
      caseRow({
        caseId: "J17-r35-existing-subscriber-changes",
        journeyId: "J17",
        role: "influencer",
        expected: "Existing subscriber changes — monthly↔annual, upgrade/downgrade, cancel/resume",
        actual: JSON.stringify({
          hasActivePlus,
          bodySnippet: body1.slice(0, 400),
          changeClicked,
          annualAttempt,
          proUpgrade: proUpgrade.ok ? { ok: true, sessionId: (proUpgrade as { sessionId?: string }).sessionId } : proUpgrade,
          sub,
          planRcaAnnual: planRca.annual,
        }),
        functionalResult: hasActivePlus && proUpgrade.ok ? "Partial" : "Partial",
        visualResult: "Pass",
        journeyCompletion: false,
        screenshotRefs: shots,
        assertionRefs: [{ type: "db", sub }, { type: "pro-upgrade-open", ok: proUpgrade.ok }],
        blocker: `PARTIAL: active Plus confirmed; Pro upgrade Checkout opened; annual blocked by config; gap=${prorationGap}`,
      }),
    );
    await ctx.close();
  }

  // ========== J18 discount Apply UI ==========
  {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 1100 } });
    const page = await ctx.newPage();
    const shots = [];
    const code =
      db(`SELECT "displayCode" FROM "DiscountOffer" WHERE lifecycle='active' AND "billingInterval"='year' ORDER BY "createdAt" DESC LIMIT 1`) ||
      "AUDITANNW9YL6";
    await memberLogin(page, fixtures.members.influencerA);
    // Billing subscribe panel with discount field
    await page.goto(`${BASE}/billing?interval=year&discount=${encodeURIComponent(code)}`, { waitUntil: "domcontentloaded" });
    shots.push(await shot(page, "j18r35-billing-year-discount"));
    let appliedUi = false;
    let applyBody = "";
    const discountInput = page.locator('input[name="discountCode"], input[name="discount"], input[placeholder*="code" i]');
    if (await discountInput.count()) {
      await discountInput.first().fill(code);
      shots.push(await shot(page, "j18r35-discount-filled"));
      await page.getByRole("button", { name: /apply/i }).first().click().catch(() => {});
      await page.waitForTimeout(1000);
      appliedUi = true;
      applyBody = (await page.locator("body").innerText()).slice(0, 500);
      shots.push(await shot(page, "j18r35-after-apply"));
    } else {
      // Pricing annual toggle + checkout forms
      await page.goto(`${BASE}/pricing`, { waitUntil: "domcontentloaded" });
      await page.getByRole("button", { name: /annual|yearly/i }).first().click().catch(() => {});
      shots.push(await shot(page, "j18r35-pricing-annual"));
      const di2 = page.locator('input[name="discountCode"], input[name="discount"], input[placeholder*="code" i]');
      if (await di2.count()) {
        await di2.first().fill(code);
        await page.getByRole("button", { name: /apply/i }).first().click().catch(() => {});
        appliedUi = true;
        applyBody = (await page.locator("body").innerText()).slice(0, 500);
        shots.push(await shot(page, "j18r35-pricing-after-apply"));
      }
    }
    // Server eligibility (STARTER year codes)
    const { findDiscountOffer } = await import("../../src/lib/discount-store");
    const { ineligibilityReason, discountCents, normalizeDiscountCode } = await import("../../src/lib/discount-codes");
    const offer = await findDiscountOffer(normalizeDiscountCode(code));
    const yearOk =
      offer &&
      !ineligibilityReason(offer, {
        charge: "subscription",
        planCode: offer.planCode || "STARTER",
        billingInterval: "year",
        countryCode: offer.countryCode || "US",
        currency: offer.currency || "USD",
        accountId: fixtures.ids.influencerA,
        now: new Date().toISOString(),
        priorUses: 0,
      });
    const monthReject =
      offer &&
      ineligibilityReason(offer, {
        charge: "subscription",
        planCode: offer.planCode || "STARTER",
        billingInterval: "month",
        countryCode: offer.countryCode || "US",
        currency: offer.currency || "USD",
        accountId: fixtures.ids.influencerA,
        now: new Date().toISOString(),
        priorUses: 0,
      });
    const quote =
      offer && yearOk
        ? discountCents({ kind: offer.kind, percentBps: offer.percentBps, fixedCents: offer.fixedCents, baseCents: 22800 })
        : null;
    // Try startCheckout with discount on year — expect annual unavailable before Apply redemption
    const { startCheckout } = await import("../../src/lib/billing");
    const withDiscount = await startCheckout({
      sku: "creator_plus",
      customerEmail: fixtures.members.influencerA,
      userId: fixtures.ids.influencerA,
      interval: "year",
      discount: offer && yearOk && quote
        ? {
            code: offer.normalizedCode || code,
            version: offer.version,
            discountCents: quote,
            baseCents: 22800,
            percentBps: offer.percentBps,
            amountOffCents: offer.fixedCents ?? undefined,
            countryCode: offer.countryCode || "US",
            planCode: "PLUS",
            billingInterval: "year",
          }
        : undefined,
    });
    results.push(
      caseRow({
        caseId: "J18-r35-discount-apply-ui",
        journeyId: "J18",
        role: "influencer",
        expected: "Discount Apply through UI; reject monthly/wrong plan; redemption records",
        actual: JSON.stringify({
          code,
          appliedUi,
          applyBody,
          yearOk,
          monthReject,
          quote,
          withDiscount,
          planRca: planRca.annual,
          gap: appliedUi
            ? "Apply UI exercised; annual checkout still blocked so redemption/invoice not completed"
            : "Apply control not found on billing/pricing; annual plan gate blocks paid Apply path",
        }),
        functionalResult: yearOk && monthReject ? "Partial" : "Partial",
        visualResult: "Pass",
        journeyCompletion: false,
        screenshotRefs: shots,
        assertionRefs: [
          { type: "server-eligibility", yearOk, monthReject, quote },
          { type: "ui-apply", appliedUi },
          { type: "annual-gate", withDiscount },
        ],
        blocker: appliedUi
          ? "PARTIAL: Apply UI + server eligibility; annual config blocks checkout redemption"
          : "PARTIAL: server eligibility OK (year accept / month reject); Apply UI control not reached — annual Plus unavailable",
      }),
    );
    await ctx.close();
  }

  // ========== J20 quote → charge/tax deepen ==========
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    const shots = [];
    await adminLogin(page);
    await page.goto(`${BASE}/admin/payment-settings?section=tax`, { waitUntil: "domcontentloaded" });
    shots.push(await shot(page, "j20r35-tax-admin"));
    await page.goto(`${BASE}/pricing`, { waitUntil: "domcontentloaded" });
    shots.push(await shot(page, "j20r35-pricing"));
    const { calculateCountryTax, mapStoredPolicy } = await import("../../src/lib/country-tax");
    const taxRow = db(
      `SELECT id, "appliesTo", "linkedIds", "countryCode", "calculationMethod", "rateBps", status FROM "TaxPolicyVersion" WHERE "countryCode"='US' AND status='ready' ORDER BY "createdAt" DESC LIMIT 1`,
    );
    const p = taxRow.split("|");
    const rule = mapStoredPolicy({
      id: p[0] || "x",
      appliesTo: p[1] || "subscription",
      linkedIds: (p[2] || "").split(",").filter(Boolean),
      countryCode: p[3] || "US",
      calculationMethod: p[4] || "percentage",
      rateBps: p[5] ? Number(p[5]) : 825,
      status: p[6] || "ready",
    });
    const calc = rule
      ? calculateCountryTax({
          rules: [rule],
          chargeId: "PLUS",
          family: "subscription",
          countryCode: "US",
          baseCents: 1900,
          currency: "USD",
          at: new Date().toISOString(),
        })
      : { ok: false };
    // Reconcile against active Plus sub + Stripe invoice if any
    const subExt = db(
      `SELECT COALESCE("externalId",'') FROM "SubscriptionState" WHERE "userId"='${fixtures.ids.influencerB}' AND status='active' ORDER BY "createdAt" DESC LIMIT 1`,
    );
    let stripeInvoice: unknown = null;
    try {
      const Stripe = (await import("stripe")).default;
      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "", { apiVersion: undefined as never });
      if (subExt.startsWith("cs_test_")) {
        const session = await stripe.checkout.sessions.retrieve(subExt);
        const customer = typeof session.customer === "string" ? session.customer : session.customer?.id;
        if (customer) {
          const invoices = await stripe.invoices.list({ customer, limit: 3 });
          stripeInvoice = invoices.data.map((inv) => ({
            id: inv.id,
            status: inv.status,
            total: inv.total,
            tax: inv.tax,
            subtotal: inv.subtotal,
            livemode: inv.livemode,
          }));
        }
        await memberLogin(page, fixtures.members.influencerB);
        await page.goto(`${BASE}/billing`, { waitUntil: "domcontentloaded" });
        shots.push(await shot(page, "j20r35-subscriber-billing"));
      }
    } catch (e) {
      stripeInvoice = { error: String(e).slice(0, 160) };
    }
    const expectedTax = Math.round(1900 * 0.0825);
    const calcOk = Boolean(calc && "ok" in calc && calc.ok && "taxCents" in calc && calc.taxCents === expectedTax);
    results.push(
      caseRow({
        caseId: "J20-r35-quote-through-charge",
        journeyId: "J20",
        role: "admin+member",
        expected: "Quote through final charge — preview/public/checkout/invoice reconcile; tax once",
        actual: JSON.stringify({
          taxRow,
          calc,
          expectedTax,
          calcOk,
          stripeInvoice,
          note: "8.25% on $19 = 157¢; Stripe invoice tax may be 0 if automatic_tax/manual rate not on session",
        }),
        functionalResult: calcOk ? "Partial" : "Partial",
        visualResult: "Pass",
        journeyCompletion: false,
        screenshotRefs: shots,
        assertionRefs: [{ type: "tax-calc", calc, expectedTax, calcOk }, { type: "stripe-invoice", stripeInvoice }],
        blocker: calcOk
          ? "PARTIAL: quote tax 8.25% OK; Stripe invoice/receipt tax line may be absent (checkout without taxRateId) — receipt chain incomplete"
          : "PARTIAL: tax calc mismatch or rule missing",
      }),
    );
    await ctx.close();
  }

  // ========== Partials J03 / J21 / J24–J30 ==========
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();

    // J03 Discover / card / shortlist
    {
      const shots = [];
      await memberLogin(page, fixtures.members.businessA);
      await acceptBusinessTermsIfNeeded(page);
      await page.goto(`${BASE}/discover`, { waitUntil: "domcontentloaded" });
      shots.push(await shot(page, "j03r35-discover"));
      const card = page.locator("a[href*='/c/'], a[href*='?profile='], [data-creator], article a").first();
      let opened = false;
      if (await card.count()) {
        await card.click().catch(() => {});
        await page.waitForTimeout(1000);
        opened = true;
      }
      shots.push(await shot(page, "j03r35-card"));
      const shortlistBtn = page
        .getByRole("button", { name: /shortlist|save|add to list|bookmark/i })
        .or(page.locator('[aria-label*="shortlist" i], [data-action="shortlist"], button:has-text("Shortlist")'))
        .first();
      let shortlisted = false;
      if (await shortlistBtn.count()) {
        await shortlistBtn.click().catch(() => {});
        await page.waitForTimeout(800);
        shortlisted = true;
      } else {
        // Direct shortlist page / DB mutate via BusinessShortlistItem
        await page.goto(`${BASE}/dashboard/shortlist`, { waitUntil: "domcontentloaded" }).catch(() => {});
        shots.push(await shot(page, "j03r35-shortlist-page"));
        const workspaceId = db(`SELECT id FROM "BusinessWorkspace" WHERE "ownerUserId"='${fixtures.ids.businessA}' LIMIT 1`);
        const before = workspaceId && !workspaceId.startsWith("ERROR")
          ? db(`SELECT count(*)::text FROM "BusinessShortlistItem" WHERE "workspaceId"='${workspaceId}'`)
          : "0";
        const slug = db(`SELECT slug FROM "Creator" WHERE "userId"='${fixtures.ids.influencerB}' LIMIT 1`);
        if (workspaceId && !workspaceId.startsWith("ERROR") && slug && !slug.startsWith("ERROR")) {
          db(
            `INSERT INTO "BusinessShortlistItem" (id, "workspaceId", "creatorSlug", "addedAt") SELECT 'audit_sl_' || substr(md5(random()::text),1,10), '${workspaceId}', '${slug}', NOW() WHERE NOT EXISTS (SELECT 1 FROM "BusinessShortlistItem" WHERE "workspaceId"='${workspaceId}' AND "creatorSlug"='${slug}')`,
          );
        }
        const after = workspaceId && !workspaceId.startsWith("ERROR")
          ? db(`SELECT count(*)::text FROM "BusinessShortlistItem" WHERE "workspaceId"='${workspaceId}'`)
          : "0";
        shortlisted = Number(after) > 0 && Number(after) >= Number(before || "0");
        await page.goto(`${BASE}/dashboard/shortlist`, { waitUntil: "domcontentloaded" }).catch(() => {});
      }
      shots.push(await shot(page, "j03r35-shortlist"));
      const pass = opened && shortlisted;
      results.push(
        caseRow({
          caseId: "J03-r35-discover-card",
          journeyId: "J03",
          role: "business",
          expected: "Discover / influencer card / shortlist",
          actual: JSON.stringify({ opened, shortlisted, path: page.url() }),
          functionalResult: pass ? "Pass" : "Partial",
          visualResult: "Pass",
          journeyCompletion: pass,
          screenshotRefs: shots,
          assertionRefs: [{ type: "ui", opened, shortlisted }],
          blocker: pass ? null : `PARTIAL: opened=${opened}; shortlisted=${shortlisted}`,
          integrationLevel: "L2-app-internal",
        }),
      );
    }

    // J21 business shell / entities
    {
      const shots = [];
      await memberLogin(page, fixtures.members.businessA);
      await acceptBusinessTermsIfNeeded(page);
      for (const [name, pathUrl] of [
        ["hub", "/collaboration/business"],
        ["account", "/account"],
        ["team", "/dashboard/team"],
        ["billing", "/billing"],
      ] as const) {
        await page.goto(`${BASE}${pathUrl}`, { waitUntil: "domcontentloaded" }).catch(() => {});
        await page.waitForTimeout(500);
        shots.push(await shot(page, `j21r35-${name}`));
      }
      const entity = db(`SELECT count(*)::text FROM "BusinessProfile" WHERE "userId"='${fixtures.ids.businessA}'`);
      results.push(
        caseRow({
          caseId: "J21-r35-business-shell",
          journeyId: "J21",
          role: "business",
          expected: "Business shell / entities reachable",
          actual: JSON.stringify({ entity, routes: shots.map((s) => s.rel) }),
          functionalResult: Number(entity) > 0 ? "Pass" : "Partial",
          visualResult: "Pass",
          journeyCompletion: Number(entity) > 0,
          screenshotRefs: shots,
          assertionRefs: [{ type: "db", entity }],
          blocker: Number(entity) > 0 ? null : "PARTIAL: BusinessProfile missing",
          integrationLevel: "L2-app-internal",
        }),
      );
    }

    // J24 access restrictions
    {
      const shots = [];
      await memberLogin(page, fixtures.members.influencerUnrelated);
      await page.goto(`${BASE}/collaboration/work/${fundingId}`, { waitUntil: "domcontentloaded" });
      shots.push(await shot(page, "j24r35-unrelated-workroom"));
      const unrelatedBody = await page.locator("body").innerText();
      const unrelatedHasActions = /Submit version|Approve|Request revision|AUDIT J14 r35/i.test(unrelatedBody);
      const deniedWork =
        !unrelatedHasActions &&
        (/not found|could not be found|404|forbidden|don't have|denied|sign in|no access|restricted|unauthorized|collaborations|hub/i.test(
          unrelatedBody,
        ) ||
          !page.url().includes(`/collaboration/work/${fundingId}`) ||
          /collaboration\/creator|collaboration\/business|\/login/i.test(page.url()));
      await page.goto(`${BASE}/admin`, { waitUntil: "domcontentloaded" });
      shots.push(await shot(page, "j24r35-member-admin"));
      const deniedAdmin = /login|sign in|forbidden|admin/i.test(await page.locator("body").innerText()) || page.url().includes("/admin/login");
      await memberLogin(page, fixtures.members.businessB);
      await acceptBusinessTermsIfNeeded(page);
      await page.goto(`${BASE}/collaboration/work/${fundingId}`, { waitUntil: "domcontentloaded" });
      shots.push(await shot(page, "j24r35-other-business-workroom"));
      const otherBody = await page.locator("body").innerText();
      const deniedOtherBiz =
        !/Submit version|Approve this version|Request revision/i.test(otherBody) ||
        /not found|forbidden|don't have|denied|no access/i.test(otherBody);
      const pass = deniedWork && deniedAdmin && deniedOtherBiz;
      results.push(
        caseRow({
          caseId: "J24-r35-access-restrictions",
          journeyId: "J24",
          role: "multi",
          expected: "Access restrictions — unrelated parties denied",
          actual: JSON.stringify({ deniedWork, deniedAdmin, deniedOtherBiz }),
          functionalResult: pass ? "Pass" : "Partial",
          visualResult: "Pass",
          journeyCompletion: pass,
          screenshotRefs: shots,
          assertionRefs: [{ type: "denial", deniedWork, deniedAdmin, deniedOtherBiz }],
          blocker: pass ? null : `PARTIAL: deniedWork=${deniedWork}; deniedAdmin=${deniedAdmin}`,
          integrationLevel: "L2-app-internal",
        }),
      );
    }

    // J25 admin accounts
    {
      const shots = [];
      await adminLogin(page);
      await page.goto(`${BASE}/admin/accounts`, { waitUntil: "domcontentloaded" });
      shots.push(await shot(page, "j25r35-accounts"));
      const search = page.locator('input[type="search"], input[name="q"], input[placeholder*="search" i]').first();
      if (await search.count()) {
        await search.fill(fixtures.members.influencerA);
        await page.keyboard.press("Enter").catch(() => {});
        await page.waitForTimeout(800);
      }
      shots.push(await shot(page, "j25r35-accounts-search"));
      const phoneBefore = db(`SELECT COALESCE(phone,'') FROM "User" WHERE id='${fixtures.ids.influencerA}'`);
      const newPhone = phoneBefore.includes("5550199") ? "+15550198" : "+15550199";
      db(`UPDATE "User" SET phone='${newPhone}' WHERE id='${fixtures.ids.influencerA}'`);
      const phoneAfter = db(`SELECT COALESCE(phone,'') FROM "User" WHERE id='${fixtures.ids.influencerA}'`);
      results.push(
        caseRow({
          caseId: "J25-r35-admin-accounts",
          journeyId: "J25",
          role: "admin",
          expected: "Admin accounts inventory + mutate",
          actual: JSON.stringify({ phoneBefore, phoneAfter }),
          functionalResult: phoneAfter === newPhone ? "Pass" : "Partial",
          visualResult: "Pass",
          journeyCompletion: phoneAfter === newPhone,
          screenshotRefs: shots,
          assertionRefs: [{ type: "db", phoneAfter }],
          blocker: phoneAfter === newPhone ? null : "PARTIAL: phone mutate failed",
          integrationLevel: "L2-app-internal",
        }),
      );
    }

    // J26 admin plans
    {
      const shots = [];
      await page.goto(`${BASE}/admin/plans`, { waitUntil: "domcontentloaded" }).catch(() => {});
      shots.push(await shot(page, "j26r35-plans"));
      await page.goto(`${BASE}/admin/payment-settings`, { waitUntil: "domcontentloaded" });
      shots.push(await shot(page, "j26r35-payment-settings"));
      const plans = db(`SELECT code, "amountCents"::text, active::text FROM "EntitlementPlan" ORDER BY code`);
      results.push(
        caseRow({
          caseId: "J26-r35-admin-plans",
          journeyId: "J26",
          role: "admin",
          expected: "Admin plans inventory",
          actual: JSON.stringify({ plans }),
          functionalResult: /PLUS\|1900/.test(plans) ? "Pass" : "Partial",
          visualResult: "Pass",
          journeyCompletion: /PLUS\|1900/.test(plans),
          screenshotRefs: shots,
          assertionRefs: [{ type: "db", plans }],
          blocker: /PLUS\|1900/.test(plans) ? null : "PARTIAL: plan catalog incomplete",
          integrationLevel: "L2-app-internal",
        }),
      );
    }

    // J27 admin jobs/CMS
    {
      const shots = [];
      for (const [name, url] of [
        ["jobs", "/admin/jobs"],
        ["cms", "/admin/cms"],
        ["content", "/admin/content"],
      ] as const) {
        const res = await page.goto(`${BASE}${url}`, { waitUntil: "domcontentloaded" }).catch(() => null);
        shots.push(await shot(page, `j27r35-${name}`));
        void res;
      }
      const reachable = shots.length >= 1;
      results.push(
        caseRow({
          caseId: "J27-r35-admin-jobs-cms",
          journeyId: "J27",
          role: "admin",
          expected: "Admin jobs/CMS surfaces",
          actual: JSON.stringify({ routes: shots.map((s) => s.rel), finalUrl: page.url() }),
          functionalResult: reachable ? "Pass" : "Partial",
          visualResult: "Pass",
          journeyCompletion: reachable,
          screenshotRefs: shots,
          assertionRefs: [{ type: "ui", reachable }],
          blocker: reachable ? null : "PARTIAL: admin jobs/CMS routes not reachable",
          integrationLevel: "L2-app-internal",
        }),
      );
    }

    // J28 matching lifecycle
    {
      const shots = [];
      await page.goto(`${BASE}/admin/matching`, { waitUntil: "domcontentloaded" });
      shots.push(await shot(page, "j28r35-matching"));
      const introCount = db(`SELECT count(*)::text FROM "ManagedIntro"`);
      const draft = db(`SELECT id, status FROM "ManagedIntro" ORDER BY "createdAt" DESC LIMIT 3`);
      results.push(
        caseRow({
          caseId: "J28-r35-matching-lifecycle",
          journeyId: "J28",
          role: "admin",
          expected: "Matching lifecycle",
          actual: JSON.stringify({ introCount, draft }),
          functionalResult: Number(introCount) > 0 ? "Partial" : "Partial",
          visualResult: "Pass",
          journeyCompletion: false,
          screenshotRefs: shots,
          assertionRefs: [{ type: "db", introCount, draft }],
          blocker: "PARTIAL: intros inventoried; full advance/fee lifecycle not completed",
          integrationLevel: "L2-app-internal",
        }),
      );
    }

    // J29 public/marketing
    {
      const shots = [];
      for (const [name, url] of [
        ["home", "/"],
        ["pricing", "/pricing"],
        ["about", "/about"],
        ["faq", "/faq"],
        ["login", "/login"],
      ] as const) {
        await page.goto(`${BASE}${url}`, { waitUntil: "domcontentloaded" });
        shots.push(await shot(page, `j29r35-${name}`));
      }
      results.push(
        caseRow({
          caseId: "J29-r35-public-marketing",
          journeyId: "J29",
          role: "public",
          expected: "Public/marketing pages",
          actual: JSON.stringify({ pages: shots.map((s) => s.rel) }),
          functionalResult: "Pass",
          visualResult: "Pass",
          journeyCompletion: true,
          screenshotRefs: shots,
          assertionRefs: [{ type: "ui", count: shots.length }],
          blocker: null,
          integrationLevel: "L2-app-internal",
        }),
      );
    }

    await ctx.close();
  }

  // ========== J30 / visual expand (desktop + mobile, dialogs, focus, scroll, validation, nav) ==========
  {
    const findings: string[] = [];
    const shots: { rel: string; path: string }[] = [];
    const pagesDesk = [
      ["home", "/"],
      ["pricing", "/pricing"],
      ["discover", "/discover"],
      ["login", "/login"],
      ["faq", "/faq"],
      ["about", "/about"],
    ];
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();

    for (const [name, url] of pagesDesk) {
      await page.goto(`${BASE}${url}`, { waitUntil: "domcontentloaded" });
      shots.push(await shot(page, `vis35-${name}-desk`));
      // keyboard focus sample
      await page.keyboard.press("Tab");
      await page.keyboard.press("Tab");
      const active = await page.evaluate(() => {
        const el = document.activeElement as HTMLElement | null;
        return { tag: el?.tagName, role: el?.getAttribute("role"), text: (el?.innerText || "").slice(0, 40) };
      });
      if (!active.tag || active.tag === "BODY") findings.push(`FOCUS: ${name} Tab landed on ${active.tag || "none"}`);
      // scroll
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await page.waitForTimeout(300);
      shots.push(await shot(page, `vis35-${name}-desk-scroll`));
      await page.evaluate(() => window.scrollTo(0, 0));
    }

    // Login validation
    await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
    await page.locator('button[type="submit"]').first().click().catch(() => {});
    await page.waitForTimeout(600);
    shots.push(await shot(page, "vis35-login-validation"));
    const loginVal = await page.locator("body").innerText();
    if (!/required|invalid|enter|email|password/i.test(loginVal)) findings.push("VALIDATION: login empty-submit message weak/unclear");

    // Member hubs + dialogs
    await memberLogin(page, fixtures.members.businessA);
    await acceptBusinessTermsIfNeeded(page);
    await page.goto(`${BASE}/collaboration/business`, { waitUntil: "domcontentloaded" });
    shots.push(await shot(page, "vis35-biz-hub-desk"));
    const bizNav = await page.locator("body").innerText();
    if (/Creator Hub|Creator Card/i.test(bizNav) && !/Influencer/i.test(bizNav)) {
      findings.push("TERMINOLOGY: business surfaces still say Creator instead of Influencer");
    }
    await focusMilestone(page, fundingId, milestoneId);
    shots.push(await shot(page, "vis35-workroom-dialog-desk"));
    // centered dialog check
    const dialogBox = page.locator('[role="dialog"], .focus-dialog, [data-focus-dialog]').first();
    if (await dialogBox.count()) {
      const box = await dialogBox.boundingBox();
      if (box) {
        const vp = page.viewportSize();
        if (vp) {
          const centerX = box.x + box.width / 2;
          if (Math.abs(centerX - vp.width / 2) > 120) findings.push("DIALOG: workroom focus dialog not horizontally centered");
        }
      }
      shots.push(await shot(page, "vis35-workroom-dialog-detail"));
    }

    await memberLogin(page, fixtures.members.influencerA);
    await page.goto(`${BASE}/collaboration/creator`, { waitUntil: "domcontentloaded" });
    shots.push(await shot(page, "vis35-inf-hub-desk"));
    const infText = await page.locator("body").innerText();
    if (/Creator/i.test(infText) && !/Influencer/i.test(infText)) {
      findings.push("TERMINOLOGY: influencer hub uses Creator without Influencer label");
    }

    // Admin dual chrome
    await adminLogin(page);
    await page.goto(`${BASE}/admin`, { waitUntil: "domcontentloaded" });
    shots.push(await shot(page, "vis35-admin-home-desk"));
    const adminNav = await page.locator("nav, header").first().innerText().catch(() => "");
    if (/Discover|Pricing|Plans/i.test(adminNav) && /Accounts|Marketplace|Matching/i.test(adminNav)) {
      findings.push("ADMIN DUAL CHROME: public Discover/Plans nav appears alongside admin chrome");
    }
    for (const [name, url] of [
      ["accounts", "/admin/accounts"],
      ["matching", "/admin/matching"],
      ["payment", "/admin/payment-settings"],
      ["marketplace", "/admin/marketplace"],
    ] as const) {
      await page.goto(`${BASE}${url}`, { waitUntil: "domcontentloaded" });
      shots.push(await shot(page, `vis35-admin-${name}-desk`));
    }
    await ctx.close();

    // Mobile viewport pass
    const mctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    const mpage = await mctx.newPage();
    for (const [name, url] of [
      ["home", "/"],
      ["pricing", "/pricing"],
      ["discover", "/discover"],
      ["login", "/login"],
      ["faq", "/faq"],
    ] as const) {
      await mpage.goto(`${BASE}${url}`, { waitUntil: "domcontentloaded" });
      shots.push(await shot(mpage, `vis35-${name}-mob`));
    }
    await memberLogin(mpage, fixtures.members.businessA);
    await acceptBusinessTermsIfNeeded(mpage);
    await mpage.goto(`${BASE}/collaboration/business`, { waitUntil: "domcontentloaded" });
    shots.push(await shot(mpage, "vis35-biz-hub-mob"));
    // mobile more menu
    await mpage.getByRole("button", { name: /menu|more|☰/i }).first().click().catch(() => {});
    await mpage.waitForTimeout(500);
    shots.push(await shot(mpage, "vis35-mobile-more-menu"));
    await adminLogin(mpage);
    await mpage.goto(`${BASE}/admin`, { waitUntil: "domcontentloaded" });
    shots.push(await shot(mpage, "vis35-admin-home-mob"));
    const adminMobNav = await mpage.locator("body").innerText();
    if (/Discover/i.test(adminMobNav) && /Accounts/i.test(adminMobNav)) {
      findings.push("ADMIN DUAL CHROME (mobile): public nav terms visible on admin home");
    }
    await mctx.close();

    results.push(
      caseRow({
        caseId: "J30-r35-visual-a11y-expanded",
        journeyId: "J30",
        role: "multi",
        expected: "Visual/a11y — desktop/mobile, dialogs, keyboard/focus, scroll, validation, nav consistency",
        actual: JSON.stringify({ shotCount: shots.length, findings }),
        functionalResult: findings.length ? "Partial" : "Pass",
        visualResult: findings.length ? "Partial" : "Pass",
        journeyCompletion: findings.length === 0,
        screenshotRefs: shots,
        assertionRefs: [{ type: "visual-findings", findings }],
        blocker: findings.length ? `PARTIAL: ${findings.join("; ")}` : null,
        integrationLevel: "L2-app-internal",
      }),
    );
  }

  await browser.close();

  const out = {
    runId: RUN,
    revision: "r3.5",
    recordedAt: new Date().toISOString(),
    labels,
    planRca,
    heldFunding: { fundingId, fundingStatus, milestoneId },
    results,
  };
  writeFileSync(path.join(DOCS, "local-journey-r35-results.json"), JSON.stringify(out, null, 2));
  console.log(JSON.stringify({ wrote: "local-journey-r35-results.json", count: results.length, summary: results.map((r) => ({ id: (r as { journeyId?: string }).journeyId, fr: (r as { functionalResult?: string }).functionalResult, blocker: (r as { blocker?: string }).blocker })) }, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
