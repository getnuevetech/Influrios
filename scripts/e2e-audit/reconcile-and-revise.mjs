/**
 * Revise pack after Ola feedback:
 * - Classify cases (inventory vs journey vs visual)
 * - Demote false journey Pass inflation
 * - Update isolation/mail blocker status from proven evidence
 * - Regenerate coverage / journeys / executive / index
 */
import fs from "node:fs/promises";
import path from "node:path";
import { execSync } from "node:child_process";
import crypto from "node:crypto";
import { existsSync, readdirSync } from "node:fs";

const DOCS = "/cursor/stores/self/docs/e2e-audit";
const MEDIA = "/cursor/stores/self/media/e2e-audit";
const RUN_ID = "AUDIT_20261118170047";
const RUN_REV = "r2";

function walk(dir) {
  if (!existsSync(dir)) return [];
  const out = [];
  for (const ent of readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) out.push(...walk(p));
    else out.push(p);
  }
  return out;
}

function sha256File(file) {
  return crypto.createHash("sha256").update(execSync(`cat ${JSON.stringify(file)}`)).digest("hex");
}

function esc(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function classify(r) {
  const id = r.caseId || "";
  if (id.startsWith("ROUTE-")) return "inventory";
  if (id.startsWith("J30-") || id.includes("popup") || id.includes("pricing-visual")) return "visual";
  if (id.includes("mutating-main") || /^J\d{2}/.test(id) || id.startsWith("AGENCY")) return "journey";
  if (id.startsWith("J02-login") || id.startsWith("J02-invalid")) return "journey";
  if (id.startsWith("J21-") || id.startsWith("J24-")) return "journey";
  return "other";
}

async function main() {
  const results = JSON.parse(await fs.readFile(path.join(DOCS, "results.json"), "utf8"));
  const issues = JSON.parse(await fs.readFile(path.join(DOCS, "issues.json"), "utf8"));
  const manifest = JSON.parse(await fs.readFile(path.join(DOCS, "manifest.json"), "utf8"));
  const mailProof = JSON.parse(await fs.readFile(path.join(DOCS, "mail-sink-proof.json"), "utf8"));
  const isolationProbe = JSON.parse(await fs.readFile(path.join(DOCS, "isolation-probe.json"), "utf8"));

  // --- Correct false journey passes: inventory Pass must not count as journey Pass ---
  const revised = results.map((r) => {
    const caseKind = classify(r);
    const out = { ...r, caseKind, revision: RUN_REV };
    // Explicit: route opens are inventory observations, not journey completion
    if (caseKind === "inventory") {
      out.journeyCompletion = false;
      out.notes =
        (out.notes ? out.notes + " " : "") +
        "Inventory/route-open only — not evidence that a customer journey completed.";
    } else if (caseKind === "visual") {
      out.journeyCompletion = false;
      out.notes =
        (out.notes ? out.notes + " " : "") +
        "Visual/popup geometry sample — not a full mutating journey.";
    } else if (String(out.caseId || "").includes("mutating-main")) {
      out.journeyCompletion = false;
    } else if (caseKind === "journey" && out.functionalResult === "Pass") {
      out.journeyCompletion = ["J02-login", "J02-invalid", "J21-", "J24-"].some((p) =>
        String(out.caseId).startsWith(p.replace(/-$/, "")) || String(out.caseId).includes(p.replace(/-$/, "")),
      )
        ? true
        : ["J02-login-influencer", "J02-login-business", "J02-login-admin", "J02-invalid-login", "J21-cross-screen-business-readonly", "J24-fake-contract-id", "J24-fake-business-request"].includes(
            out.caseId,
          );
      if (!out.journeyCompletion && out.functionalResult === "Pass" && !String(out.caseId).startsWith("J02-login") && !String(out.caseId).startsWith("J02-invalid") && !String(out.caseId).startsWith("J21") && !String(out.caseId).startsWith("J24")) {
        // demote unexpected journey Passes that lack completion flag
        out.priorFunctionalResult = out.functionalResult;
        out.functionalResult = "Not tested";
        out.demotedReason = "Prior Pass lacked journey-completion evidence; demoted pending retest";
        out.journeyCompletion = false;
      }
    }
    return out;
  });

  // Fix journeyCompletion for known J02/J21/J24 passes
  for (const r of revised) {
    if (
      [
        "J02-login-influencer",
        "J02-login-business",
        "J02-login-admin",
        "J02-invalid-login",
        "J21-cross-screen-business-readonly",
        "J24-fake-contract-id",
        "J24-fake-business-request",
      ].includes(r.caseId)
    ) {
      r.journeyCompletion = r.functionalResult === "Pass";
      r.caseKind = "journey";
    }
  }

  await fs.writeFile(path.join(DOCS, "results.json"), JSON.stringify(revised, null, 2));

  // --- Isolation attestation doc ---
  const accountsExcerpt = (isolationProbe.pages.find((p) => p.id === "accounts") || {}).excerpt || "";
  const isolationMd = `# Isolation & sandbox evidence (revision ${RUN_REV})

**Status:** Evidence gathered — **mutations still gated** on residual operator attestation below. A flag alone is not proof.

## Observed facts (read-only)

| Fact | Evidence |
|------|----------|
| Host | \`https://influrios.com\` (no separate staging hostname) |
| Deployed revision | from \`/api/health\` (see environment.md) |
| Member footprint | Admin → Accounts shows **Total Accounts = 5** (3 influencers, 2 businesses) |
| Named members visible | Influencers: Argboboy, Jenks Ag, Ag Olomola · Businesses: Richard Winfred Esi, ABC Holdings |
| AUDIT role mapping (session) | Business → ABC Holdings · Influencer → Ag Olomola · Admin → AUDIT_ADMIN |
| Stripe billing | **Stripe · Sandbox** on Admin → Billing activity |
| Collaboration gateway | Stripe Collaboration **Enabled**; Airwallex **Disabled** |
| SMS | Not sent |
| Screenshots | \`/cursor/stores/self/media/e2e-audit/isolation/\` |

## What this does **not** yet prove by itself

- Written attestation that **no production customer PII** shares this database beyond the 5 visible members
- That Argboboy / Jenks Ag / Richard Winfred Esi are disposable test fixtures (vs real people)

## Exact operator actions to fully unlock mutations

Complete **all** checkboxes, then reply in the Project thread (or set Cloud Agent secrets):

1. [ ] Confirm \`influrios.com\` DB contains **only** staging/test members (the 5 above, plus any AUDIT-seeded rows) — **no live customer tenancy**
2. [ ] Confirm AUDIT_INFLUENCER / AUDIT_BUSINESS / AUDIT_ADMIN are the allowlisted mutation + notification recipients
3. [ ] Confirm Stripe remains sandbox-only for this host (no live key fallback)
4. [ ] Optional: set \`AUDIT_ISOLATION_CONFIRMED=1\` **after** (1)–(3) — the flag records attestation; it is not a substitute for (1)–(3)

**Owner:** Ola / operator  
**Until then:** invite/sign/fund/payout/sub-checkout/withdraw/delete mutations stay **Blocked** (except already-proven mail test to AUDIT_ADMIN).

## Sandbox routing

Proven via UI badges/provider page (see isolation screenshots + preflight). Payment Standard v2 remains paused.
`;
  await fs.writeFile(path.join(DOCS, "isolation-evidence.md"), isolationMd);

  // --- Mail sink status ---
  const attempt = mailProof.evidence?.attempts?.[0] || {};
  const mailMd = `# Notification sink proof (revision ${RUN_REV})

## Result: **PROVEN — controlled delivery**

| Field | Value |
|-------|--------|
| When | ${mailProof.at} |
| Recipient | \`AUDIT_ADMIN_EMAIL\` (allowlisted audit admin; domain \`${mailProof.recipientDomain}\`) |
| Action | Admin → Email → **Send test** (claim invitation SMTP test) |
| UI | \`/admin/mail?sent=started\` |
| Job | \`cmwmi5v4b08nlpb01rxivghrn\` |
| Outcome | **succeeded** |
| SMTP | \`250 2.0.0 OK … gsmtp\` |
| Media | \`/cursor/stores/self/media/e2e-audit/mail-sink/\` |
| JSON | [mail-sink-proof.json](./mail-sink-proof.json) |

### Claim boundary

- **Claimed:** SMTP accepted + job succeeded for an allowlisted AUDIT recipient (controlled delivery).
- **Not claimed:** Operator opened a personal webmail UI; real-customer inbox placement; SMS.

### Unblocks (once isolation attested)

J01 verify, J02 reset, J05 invites, J07–J08 notices, J11 signature notices, J16 billing mail, J23 — may target **AUDIT_* emails only**.

### BLK-MAIL-SINK

**Closed** for controlled-delivery proof. Remain cautious: never send to non-AUDIT addresses.
`;
  await fs.writeFile(path.join(DOCS, "mail-sink-proof.md"), mailMd);

  // --- Update blockers.md ---
  const blockers = `# Blockers — Influrios E2E audit \`${RUN_ID}\` (revision ${RUN_REV})

Ola: do not treat PR #534 as finished. This file tracks unlock state.

## BLK-ISOLATION — Residual operator attestation

| Field | Detail |
|-------|--------|
| Status | **OPEN (residual)** — strong evidence gathered; attestation checklist incomplete |
| Evidence | [isolation-evidence.md](./isolation-evidence.md) · Total Accounts=5 · Stripe Sandbox · AUDIT sessions mapped |
| Affected | Mutating J04–J20, withdraw/delete, sandbox checkout/payout |
| Exact unblock | Complete checklist in isolation-evidence.md (4 checkboxes) |
| Owner | Ola / operator |

## BLK-MAIL-SINK — Controlled delivery proven

| Field | Detail |
|-------|--------|
| Status | **CLOSED** (controlled delivery) |
| Evidence | [mail-sink-proof.md](./mail-sink-proof.md) · job \`cmwmi5v4b08nlpb01rxivghrn\` · SMTP 250 |
| Residual | Do not message non-AUDIT recipients; inbox UI not separately proven |

## BLK-ADMIN-CRED-EXPOSURE — P0 (separate hotfix)

| Status | **OPEN** — out of silent-audit-fix scope |
| Evidence | Public \`/admin/login\` still renders concrete default credentials (values redacted from pack) |
| Owner | Engineering (separate PR) |

## BLK-DEPLOY-SHA

| Status | **OPEN** for regression claims only |
| Evidence | Deployed ≠ local PR #532 HEAD |

## Closed / N/A

| Item | Note |
|------|------|
| Agency | Deferred |
| Payment Standard v2 | Paused |
`;
  await fs.writeFile(path.join(DOCS, "blockers.md"), blockers);

  // --- Coverage reconciliation ---
  const byKind = { inventory: {}, journey: {}, visual: {}, other: {} };
  const tally = (map, key) => {
    map[key] = (map[key] || 0) + 1;
  };
  for (const r of revised) {
    const k = r.caseKind || "other";
    tally(byKind[k] || (byKind[k] = {}), r.functionalResult);
  }

  const journeyRows = revised.filter((r) => r.caseKind === "journey");
  const journeyCompletePass = journeyRows.filter((r) => r.journeyCompletion && r.functionalResult === "Pass").length;
  const journeyBlocked = journeyRows.filter((r) => r.functionalResult === "Blocked").length;

  const shots = walk(path.join(MEDIA, "screenshots")).filter((f) => f.endsWith(".png"));
  const recs = walk(path.join(MEDIA, "recordings")).filter((f) => /\.(webm|mp4)$/.test(f));
  const routeCount = (await fs.readFile(path.join(DOCS, "route-inventory.csv"), "utf8")).trim().split("\n").length - 1;
  const actionCount = (await fs.readFile(path.join(DOCS, "action-inventory.csv"), "utf8")).trim().split("\n").length - 1;

  // Required journey IDs J01-J30
  const required = Array.from({ length: 30 }, (_, i) => `J${String(i + 1).padStart(2, "0")}`);
  const journeyStatus = {};
  for (const jid of required) {
    const rows = revised.filter((r) => r.journeyId === jid || String(r.caseId).startsWith(jid));
    const mutating = rows.filter((r) => String(r.caseId).includes("mutating") || r.integrationLevel === "L3-provider-sandbox");
    const journeyPass = rows.some((r) => r.caseKind === "journey" && r.journeyCompletion && r.functionalResult === "Pass");
    const blocked = rows.some((r) => r.functionalResult === "Blocked");
    const inventoryOnly = rows.length > 0 && rows.every((r) => r.caseKind === "inventory" || r.caseKind === "visual");
    let status = "Not tested";
    let detail = "";
    if (blocked) {
      status = "Blocked";
      detail = "Isolation attestation residual — see isolation-evidence.md";
    } else if (journeyPass && !mutating.some((m) => m.functionalResult === "Blocked")) {
      // only mark Pass if no blocked mutating requirement for critical journeys
      const criticalMutating = ["J04", "J05", "J07", "J08", "J09", "J10", "J11", "J13", "J14", "J15", "J16", "J22", "J23"].includes(jid);
      if (criticalMutating) {
        status = "Blocked";
        detail = "Partial read-only/login evidence exists; required mutating path not executed";
      } else {
        status = "Pass";
        detail = "Journey-level Pass with completion evidence";
      }
    } else if (inventoryOnly) {
      status = "Not tested";
      detail = "Inventory/visual only — false journey Pass avoided";
    } else if (rows.length) {
      const fns = [...new Set(rows.map((r) => r.functionalResult))];
      status = fns.includes("Fail") ? "Fail" : fns.includes("Pass") && !fns.includes("Blocked") ? "Partial" : fns.join("|");
      detail = "See results.json filtered by journeyId";
    }
    // Special-case known partials
    if (["J02", "J21", "J24", "J25", "J26", "J27", "J28", "J29", "J30"].includes(jid) && !blocked) {
      if (jid === "J02") {
        status = "Partial";
        detail = "Logins + invalid login Pass; password-reset mail path not fully retested this revision";
      }
      if (jid === "J30") {
        status = "Partial";
        detail = "Sampled centered popup geometry Pass; full checklist / all viewports still in progress";
      }
      if (["J25", "J26", "J27", "J28", "J29"].includes(jid)) {
        status = "Partial";
        detail = "Read-only inventory/admin opens — not full mutating admin ops";
      }
      if (jid === "J21") {
        status = "Partial";
        detail = "Business shell surfaces captured; no main-journey entity ID reconciliation yet";
      }
      if (jid === "J24") {
        status = "Partial";
        detail = "Synthetic ID denial Pass; real cross-account contract IDOR not fixture-linked";
      }
    }
    if (["J04", "J05", "J06", "J07", "J08", "J09", "J10", "J11", "J12", "J13", "J14", "J15", "J16", "J17", "J18", "J19", "J20", "J22", "J23", "J01"].includes(jid)) {
      status = "Blocked";
      detail = "BLK-ISOLATION residual attestation — mail sink proven; mutations gated";
    }
    journeyStatus[jid] = { status, detail, rowCount: rows.length };
  }

  const cov = `# Coverage (reconciled) — ${RUN_ID} / ${RUN_REV}

## Important

**Route-open Pass ≠ journey Pass.** Revision ${RUN_REV} separates denominators after Ola rejected screenshot-only completion.

## Denominators

| Denominator | Count | Notes |
|-------------|------:|-------|
| Source routes | ${routeCount} | route-inventory.csv |
| Action inventory rows | ${actionCount} | action-inventory.csv |
| Case rows (all kinds) | ${revised.length} | results.json |
| Inventory route-open rows | ${revised.filter((r) => r.caseKind === "inventory").length} | supporting only |
| Journey-kind rows | ${journeyRows.length} | includes Blocked mutating stubs |
| Journey completion Passes | ${journeyCompletePass} | strict |
| Required journeys J01–J30 | 30 | see matrix |
| Screenshots | ${shots.length} | |
| Recordings | ${recs.length} | |

## Functional tallies by caseKind

### Inventory
${Object.entries(byKind.inventory)
  .map(([k, v]) => `- ${k}: ${v}`)
  .join("\n") || "- (none)"}

### Journey
${Object.entries(byKind.journey)
  .map(([k, v]) => `- ${k}: ${v}`)
  .join("\n") || "- (none)"}

### Visual
${Object.entries(byKind.visual)
  .map(([k, v]) => `- ${k}: ${v}`)
  .join("\n") || "- (none)"}

## J01–J30 matrix (reconciled)

| Journey | Status | Detail |
|---------|--------|--------|
${required.map((j) => `| ${j} | ${journeyStatus[j].status} | ${journeyStatus[j].detail} |`).join("\n")}
| AGENCY | Not applicable | Deferred |

**Arithmetic check (journey statuses):** each of 30 rows has exactly one status above.

| Status | Count |
|--------|------:|
${(() => {
  const c = {};
  for (const j of required) c[journeyStatus[j].status] = (c[journeyStatus[j].status] || 0) + 1;
  return Object.entries(c)
    .map(([k, v]) => `| ${k} | ${v} |`)
    .join("\n");
})()}

## Provider-sandbox coverage

**0** critical collection/payout journeys completed at L3 (honest). Mail controlled-delivery proof is separate (see mail-sink-proof.md).

## Evidence link roots

- Pack index: [index.html](./index.html)
- Media store: \`/cursor/stores/self/media/e2e-audit/\`
- Downloads: [downloads/](./downloads/)
`;
  await fs.writeFile(path.join(DOCS, "coverage.md"), cov);

  const journeysMd = `# Journeys (revision ${RUN_REV})

**Verdict remains: Audit incomplete with blockers** until mutating paths run after isolation attestation.

Mail sink: **proven** ([mail-sink-proof.md](./mail-sink-proof.md)).  
Isolation: **evidence + residual checklist** ([isolation-evidence.md](./isolation-evidence.md)).

| ID | Status | Notes |
|----|--------|-------|
${required.map((j) => `| ${j} | ${journeyStatus[j].status} | ${journeyStatus[j].detail} |`).join("\n")}
| AGENCY | N/A | Deferred |

Recordings remain role-nav only until mutating journeys execute.
`;
  await fs.writeFile(path.join(DOCS, "journeys.md"), journeysMd);

  const blockedCount = required.filter((j) => journeyStatus[j].status === "Blocked").length;
  const partialCount = required.filter((j) => journeyStatus[j].status === "Partial").length;
  const passCount = required.filter((j) => journeyStatus[j].status === "Pass").length;

  const exec = `# Influrios End-to-End Audit — Executive summary (rev ${RUN_REV})

**runId:** ${RUN_ID}  
**Revision:** ${RUN_REV} — Ola rejected treating #534 as finished; pack revised  
**Deployed build:** \`${manifest.buildId}\`  
**Base URL:** https://influrios.com  

## Verdict

**Audit incomplete with blockers** (revision in progress on PR #534 — keep open).

Stopping customer-affecting mutations without isolation attestation was correct; calling that stop “done” was not. This revision:

1. Proves notification controlled delivery (SMTP 250 + job success to AUDIT_ADMIN)
2. Documents isolation footprint evidence (5 accounts, Stripe Sandbox) + **exact operator checklist** still required
3. Removes false journey Pass inflation from route-open screenshots
4. Keeps mutating invite/sign/fund/payout/sub/withdraw/delete journeys **Blocked** with owner/action until checklist completes

## Journey matrix (J01–J30)

- Pass: **${passCount}**
- Partial: **${partialCount}**
- Blocked: **${blockedCount}**
- (see [coverage.md](./coverage.md))

## Top open items for Ola

1. Complete isolation attestation checkboxes in [isolation-evidence.md](./isolation-evidence.md)
2. Separate hotfix for P0 admin-login default credentials
3. After (1): authorize mutating retest — pack will be updated on #534

## Links

- [index.html](./index.html)
- [blockers.md](./blockers.md)
- [mail-sink-proof.md](./mail-sink-proof.md)
- [isolation-evidence.md](./isolation-evidence.md)
- Downloads: [downloads/](./downloads/)
`;
  await fs.writeFile(path.join(DOCS, "executive-summary.md"), exec);
  await fs.writeFile(
    path.join(DOCS, "Influrios_E2E_Audit_Executive_Summary.doc.html"),
    `<!DOCTYPE html><html><head><meta charset="utf-8"><title>E2E Audit Executive Summary</title></head><body><pre>${esc(exec)}</pre></body></html>`,
  );

  // Fix index.html media links to store-absolute style via file://-free relative that works in store:
  // from docs/e2e-audit -> ../media is wrong; correct is ../../media only if parent is self.
  // Keep ../../media/e2e-audit/ for store browsing; also list download zips prominently.
  const rows = revised
    .map((r) => {
      const shotsHtml = (r.screenshotRefs || [])
        .map((s) => {
          const rel = s.rel || (s.path ? path.relative(MEDIA, s.path) : null);
          if (!rel) return "";
          // Prefer store-relative from docs: ../ is docs parent? 
          // docs/e2e-audit and media/e2e-audit are siblings under self → ../media/e2e-audit/FAIL
          // self/docs/e2e-audit → ../../media/e2e-audit is correct (up to self)
          return `<a href="../../media/e2e-audit/${rel}" target="_blank" rel="noreferrer">shot</a>`;
        })
        .filter(Boolean)
        .join(" ");
      return `<tr data-role="${esc(r.role)}" data-journey="${esc(r.journeyId)}" data-kind="${esc(r.caseKind)}" data-viewport="${esc(r.viewport)}" data-fn="${esc(r.functionalResult)}" data-vis="${esc(r.visualResult)}">
<td>${esc(r.caseId)}</td><td>${esc(r.caseKind)}</td><td>${esc(r.journeyId)}</td><td>${esc(r.role)}</td><td>${esc(r.viewport)}</td>
<td>${esc(r.functionalResult)}</td><td>${esc(r.visualResult)}</td><td>${esc(r.blocker || "")}</td><td>${shotsHtml || "—"}</td>
<td><details><summary>detail</summary><pre>${esc(JSON.stringify({ expected: r.expected, actual: r.actual, finalUrl: r.finalUrl, journeyCompletion: r.journeyCompletion, demotedReason: r.demotedReason, notes: r.notes }, null, 2))}</pre></details></td></tr>`;
    })
    .join("\n");

  const html = `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>Influrios E2E Audit — ${RUN_ID} ${RUN_REV}</title>
<style>
:root{--bg:#f4f7fb;--card:#fff;--ink:#14213d;--muted:#5b6b7c;--line:#d7e0ea;--pass:#0f7b4b;--fail:#b42318;--blocked:#a15c00}
*{box-sizing:border-box}body{margin:0;font:14px/1.45 ui-sans-serif,system-ui,sans-serif;background:linear-gradient(180deg,#eaf1ff,#f7fafc);color:var(--ink)}
header{padding:28px 24px 12px;max-width:1200px;margin:0 auto}h1{margin:0 0 6px;font-size:26px}.sub{color:var(--muted)}
.note{background:#fff8e8;border:1px solid #f0d59a;padding:10px 12px;border-radius:10px;margin:12px 0}
.ok{background:#ecfdf3;border:1px solid #abefc6}
nav{display:flex;flex-wrap:wrap;gap:10px;margin:12px 0}nav a{color:#3b4fd8;font-weight:600;text-decoration:none}
.cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:10px;max-width:1200px;margin:0 auto 16px;padding:0 24px}
.card{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:12px}.card b{display:block;font-size:22px}
.wrap{max-width:1200px;margin:0 auto;padding:0 24px 40px}
.filters{display:flex;flex-wrap:wrap;gap:8px;margin:10px 0}
select{padding:6px 8px;border-radius:8px;border:1px solid var(--line)}
table{width:100%;border-collapse:collapse;background:var(--card);border:1px solid var(--line);border-radius:12px;overflow:hidden}
th,td{padding:8px 10px;border-bottom:1px solid var(--line);vertical-align:top;text-align:left;font-size:13px}
th{background:#eef3fa;font-size:11px;text-transform:uppercase;letter-spacing:.04em}
tr.hidden{display:none}pre{white-space:pre-wrap;max-width:420px}
.tag-Pass{color:var(--pass);font-weight:700}.tag-Fail{color:var(--fail);font-weight:700}.tag-Blocked{color:var(--blocked);font-weight:700}
</style></head><body>
<header>
<h1>Influrios E2E audit pack <small>${esc(RUN_REV)}</small></h1>
<div class="sub">${esc(RUN_ID)} · build <code>${esc(manifest.buildId)}</code> · https://influrios.com</div>
<div class="note"><b>Verdict: Audit incomplete with blockers.</b> PR #534 kept open for revision. Route-open screenshots are <b>inventory</b>, not journey completion. Mutating paths blocked pending isolation attestation.</div>
<div class="note ok"><b>Mail sink:</b> controlled delivery proven (job cmwmi5v4b08nlpb01rxivghrn · SMTP 250). See <a href="./mail-sink-proof.md">mail-sink-proof.md</a>.</div>
<nav>
<a href="./executive-summary.md">Executive</a>
<a href="./coverage.md">Coverage</a>
<a href="./journeys.md">Journeys</a>
<a href="./isolation-evidence.md">Isolation</a>
<a href="./mail-sink-proof.md">Mail sink</a>
<a href="./blockers.md">Blockers</a>
<a href="./downloads/">Downloads</a>
<a href="./results.json">results.json</a>
</nav>
</header>
<section class="cards">
<div class="card"><span>J01–J30 Blocked</span><b>${blockedCount}</b></div>
<div class="card"><span>J01–J30 Partial</span><b>${partialCount}</b></div>
<div class="card"><span>J01–J30 Pass</span><b>${passCount}</b></div>
<div class="card"><span>Case rows</span><b>${revised.length}</b></div>
<div class="card"><span>Journey completion Pass</span><b>${journeyCompletePass}</b></div>
</section>
<div class="wrap">
<div class="filters">
<label>Kind <select id="kind"><option value="">All</option></select></label>
<label>Journey <select id="journey"><option value="">All</option></select></label>
<label>Functional <select id="fn"><option value="">All</option></select></label>
<label>Role <select id="role"><option value="">All</option></select></label>
</div>
<table><thead><tr><th>Case</th><th>Kind</th><th>Journey</th><th>Role</th><th>Viewport</th><th>Fn</th><th>Vis</th><th>Blocker</th><th>Evidence</th><th>Detail</th></tr></thead>
<tbody id="tbody">${rows}</tbody></table>
</div>
<script>
const sels=['kind','journey','fn','role'];
const vals={};
for (const tr of document.querySelectorAll('#tbody tr')) {
  for (const [k,attr] of [['kind','data-kind'],['journey','data-journey'],['fn','data-fn'],['role','data-role']]) {
    vals[k]=vals[k]||new Set(); vals[k].add(tr.getAttribute(attr)||'');
  }
}
for (const k of sels){const el=document.getElementById(k); [...vals[k]].filter(Boolean).sort().forEach(v=>{const o=document.createElement('option');o.value=v;o.textContent=v;el.appendChild(o)}); el.addEventListener('change',apply);}
function apply(){const f=Object.fromEntries(sels.map(k=>[k,document.getElementById(k).value]));
for(const tr of document.querySelectorAll('#tbody tr')){
 const ok=(!f.kind||tr.dataset.kind===f.kind)&&(!f.journey||tr.dataset.journey===f.journey)&&(!f.fn||tr.dataset.fn===f.fn)&&(!f.role||tr.dataset.role===f.role);
 tr.classList.toggle('hidden',!ok);
}}
for (const td of document.querySelectorAll('td')) if(['Pass','Fail','Blocked'].includes(td.textContent)) td.classList.add('tag-'+td.textContent);
</script>
</body></html>`;
  await fs.writeFile(path.join(DOCS, "index.html"), html);

  await fs.writeFile(
    path.join(DOCS, "README.md"),
    `# Influrios E2E audit pack (${RUN_ID} / ${RUN_REV})

**Verdict:** Audit incomplete with blockers. PR #534 open for revision — **not** finished.

- [index.html](./index.html)
- [executive-summary.md](./executive-summary.md)
- [coverage.md](./coverage.md) (reconciled denominators)
- [isolation-evidence.md](./isolation-evidence.md)
- [mail-sink-proof.md](./mail-sink-proof.md)
- [blockers.md](./blockers.md)
- [downloads/](./downloads/)

Media: \`/cursor/stores/self/media/e2e-audit/\`
`,
  );

  // Rebuild docs zip
  execSync(
    `rm -f ${JSON.stringify(path.join(DOCS, "downloads/influrios-e2e-audit-docs.zip"))} && cd ${JSON.stringify(DOCS)} && zip -qr downloads/influrios-e2e-audit-docs.zip . -x 'downloads/*'`,
    { stdio: "inherit" },
  );
  // Add mail-sink + isolation media zips
  execSync(
    `cd ${JSON.stringify(MEDIA)} && zip -qr ${JSON.stringify(path.join(DOCS, "downloads/influrios-e2e-audit-mail-sink.zip"))} mail-sink && zip -qr ${JSON.stringify(path.join(DOCS, "downloads/influrios-e2e-audit-isolation.zip"))} isolation`,
    { stdio: "inherit" },
  );

  const dlReadme = `# Downloads (rev ${RUN_REV})

| Package | Absolute path |
|---------|---------------|
| docs | ${path.join(DOCS, "downloads/influrios-e2e-audit-docs.zip")} |
| screenshots | ${path.join(DOCS, "downloads/influrios-e2e-audit-screenshots.zip")} |
| recordings | ${path.join(DOCS, "downloads/influrios-e2e-audit-recordings.zip")} |
| preflight | ${path.join(DOCS, "downloads/influrios-e2e-audit-preflight.zip")} |
| mail-sink | ${path.join(DOCS, "downloads/influrios-e2e-audit-mail-sink.zip")} |
| isolation | ${path.join(DOCS, "downloads/influrios-e2e-audit-isolation.zip")} |

Browse expanded media at \`/cursor/stores/self/media/e2e-audit/\`.
`;
  await fs.writeFile(path.join(DOCS, "downloads/README.md"), dlReadme);

  manifest.revision = RUN_REV;
  manifest.packGeneratedAt = new Date().toISOString();
  manifest.verdict = "Audit incomplete with blockers";
  manifest.mailSink = { proven: true, jobId: "cmwmi5v4b08nlpb01rxivghrn" };
  manifest.isolation = { status: "evidence-plus-residual-attestation", totalAccountsObserved: 5 };
  await fs.writeFile(path.join(DOCS, "manifest.json"), JSON.stringify(manifest, null, 2));

  console.log(
    JSON.stringify(
      {
        revision: RUN_REV,
        cases: revised.length,
        journeyCompletePass,
        journeyBlocked,
        j30matrix: { passCount, partialCount, blockedCount },
        mailSinkProven: true,
      },
      null,
      2,
    ),
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
