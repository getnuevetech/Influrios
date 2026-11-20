/**
 * Generate browsable pack docs + checksums + zips for Ola review.
 */
import fs from "node:fs/promises";
import { createWriteStream, existsSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { execSync } from "node:child_process";

const DOCS = "/cursor/stores/self/docs/e2e-audit";
const MEDIA = "/cursor/stores/self/media/e2e-audit";
const RUN_ID = "AUDIT_20261118170047";

function sha256(buf) {
  return crypto.createHash("sha256").update(buf).digest("hex");
}

async function sha256File(file) {
  const buf = await fs.readFile(file);
  return sha256(buf);
}

function walk(dir) {
  const out = [];
  if (!existsSync(dir)) return out;
  for (const ent of readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) out.push(...walk(p));
    else out.push(p);
  }
  return out;
}

function esc(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

async function main() {
  const results = JSON.parse(await fs.readFile(path.join(DOCS, "results.json"), "utf8"));
  const issues = JSON.parse(await fs.readFile(path.join(DOCS, "issues.json"), "utf8"));
  const manifest = JSON.parse(await fs.readFile(path.join(DOCS, "manifest.json"), "utf8"));

  const byFn = {};
  const byVis = {};
  const byJourney = {};
  for (const r of results) {
    byFn[r.functionalResult] = (byFn[r.functionalResult] || 0) + 1;
    byVis[r.visualResult] = (byVis[r.visualResult] || 0) + 1;
    const j = r.journeyId || "unknown";
    byJourney[j] = byJourney[j] || { total: 0, pass: 0, fail: 0, blocked: 0, nt: 0, na: 0 };
    byJourney[j].total++;
    const key =
      r.functionalResult === "Pass"
        ? "pass"
        : r.functionalResult === "Fail"
          ? "fail"
          : r.functionalResult === "Blocked"
            ? "blocked"
            : r.functionalResult === "Not applicable"
              ? "na"
              : "nt";
    byJourney[j][key]++;
  }

  // coverage.md
  const routeCount = (await fs.readFile(path.join(DOCS, "route-inventory.csv"), "utf8")).trim().split("\n").length - 1;
  const actionCount = (await fs.readFile(path.join(DOCS, "action-inventory.csv"), "utf8")).trim().split("\n").length - 1;
  const shots = walk(path.join(MEDIA, "screenshots")).filter((f) => f.endsWith(".png"));
  const recs = walk(path.join(MEDIA, "recordings")).filter((f) => f.endsWith(".webm") || f.endsWith(".mp4"));
  const preflight = walk(path.join(MEDIA, "preflight")).filter((f) => f.endsWith(".png"));

  const coverage = `# Coverage — ${RUN_ID}

## Denominators

| Denominator | Count | Notes |
|-------------|------:|-------|
| Source routes (\`page.tsx\`) | ${routeCount} | See route-inventory.csv |
| Seeded unique actions | ${actionCount} | See action-inventory.csv |
| Case results this run | ${results.length} | results.json |
| Journey IDs touched | ${Object.keys(byJourney).length} | J01–J30 + AGENCY + inventory |
| Screenshots | ${shots.length} | media/e2e-audit/screenshots |
| Preflight shots | ${preflight.length} | media/e2e-audit/preflight |
| Recordings | ${recs.length} | role desktop nav webm |

## Functional outcomes

| Result | Count |
|--------|------:|
${Object.entries(byFn)
  .map(([k, v]) => `| ${k} | ${v} |`)
  .join("\n")}

**Check:** Pass+Fail+Blocked+Not tested+Not applicable = **${Object.values(byFn).reduce((a, b) => a + b, 0)}** (must equal ${results.length}).

## Visual outcomes

| Result | Count |
|--------|------:|
${Object.entries(byVis)
  .map(([k, v]) => `| ${k} | ${v} |`)
  .join("\n")}

## By journey

| Journey | Total | Pass | Fail | Blocked | Not tested | N/A |
|---------|------:|-----:|-----:|--------:|-----------:|----:|
${Object.entries(byJourney)
  .sort((a, b) => String(a[0]).localeCompare(String(b[0])))
  .map(([j, c]) => `| ${j} | ${c.total} | ${c.pass} | ${c.fail} | ${c.blocked} | ${c.nt} | ${c.na} |`)
  .join("\n")}

## Integration levels

- **L1 visual/nav:** route opens, popup geometry, pricing visuals
- **L2 app-internal:** authenticated role logins, invalid login, cross-screen read-only
- **L3 provider-sandbox:** **not executed** this run — blocked by BLK-ISOLATION / BLK-MAIL-SINK

Provider-sandbox coverage: **0 / required critical collection+payout journeys** (honestly blocked).

## Exclusions

- Agency workflows: deferred (Not applicable)
- Payment Standard v2: paused — not enabled to force passes
- Mutating sandbox checkout/signing/invite/withdraw: blocked pending isolation + mail sink
- Screenshot-count % is **not** used as end-to-end completion

## Manual review

Popup geometry cases under J30 were inspected via bounding-box assertions + screenshots. Recordings show role shell navigation; they are **not** substitutes for blocked mutating journeys.
`;
  await fs.writeFile(path.join(DOCS, "coverage.md"), coverage);

  // journeys.md
  const journeys = `# Journeys — ${RUN_ID}

Build: \`${manifest.buildId}\` · Base: ${manifest.baseUrl}

## Verdict inputs

Critical mutating journeys (J04–J15, J16 checkout, J22–J23 delivery) are **Blocked** pending isolation/mail-sink confirmation. Read-only navigation, login, pricing visual, and centered-popup checks ran against the live deployment.

## Journey status

| ID | Title | Functional | Integration | Notes |
|----|-------|------------|-------------|-------|
| J01 | Signup + email verification | Blocked | — | BLK-MAIL-SINK; public signup route captured |
| J02 | Login / reset / session | Partial Pass | L2 | Role logins Pass; invalid login Pass; reset mail Blocked |
| J03 | Profile / discovery | Pass (read-only) | L1/L2 | Dashboard/discover/card routes captured |
| J04 | Create/edit/publish request | Blocked | — | BLK-ISOLATION; list+New Request popup geometry Pass |
| J05 | Invite/accept | Blocked | — | BLK-MAIL-SINK |
| J06 | Response review | Blocked | — | BLK-ISOLATION |
| J07 | Delete unaccepted | Blocked | — | BLK-ISOLATION |
| J08 | Withdraw accepted | Blocked | — | BLK-ISOLATION |
| J09 | Protect signed/funded | Blocked | — | BLK-ISOLATION |
| J10 | Prepare agreement | Blocked (mutating) | L1 | Contracts lists captured |
| J11 | Dual sign | Blocked | — | In-app signing primary (admin copy); mutating Blocked |
| J12 | Signing failures | Blocked | — | |
| J13 | Collab checkout | Blocked | — | Stripe Sandbox labeled in admin |
| J14 | Milestone revise/approve | Blocked | — | |
| J15 | Payout release | Blocked | — | Airwallex disabled; Stripe Collaboration enabled |
| J16 | Sub purchases | Blocked (mutating) | L1 | Pricing Monthly/Annual visual Pass; existing AUDIT subs visible |
| J17 | Subscriber changes | Blocked | — | |
| J18 | Discounts | Blocked (mutating) | L1 | Admin discounts surface opened |
| J19 | Tax config | Blocked (mutating) | L1 | Tax edit popup centered Pass |
| J20 | Quote→charge | Blocked | — | |
| J21 | Cross-screen consistency | Pass (limited) | L2 | Business shell surfaces captured; no main-journey entity IDs |
| J22 | Messaging | Blocked (send) | L1 | Messages route opened |
| J23 | Notifications lifecycle | Blocked | — | BLK-MAIL-SINK; SMTP Ready |
| J24 | Permissions | Not tested (fixture gap) | — | No business contract deep link on list |
| J25 | Admin accounts/access | Pass (read-only) | L1/L2 | Accounts/access routes + view popup centered |
| J26 | Plans/config | Pass (read-only) | L1 | Plans edit popup centered |
| J27 | CMS/queues | Pass (read-only) | L1 | Homepage + jobs opened; retry not executed |
| J28 | AI/matching | Pass (inventory) | L1 | Admin AI + matching pages opened |
| J29 | Remaining routes | Pass (inventory opens) | L1 | Public+role inventories |
| J30 | Visual popup checklist | Pass (sampled) | L1 | Business/admin/influencer dialogs centered desktop; business mobile full-bleed |
| AGENCY | Agency workflow | N/A | — | Deferred; /agency + admin/agency inventoried |

## Recordings

| File | Role |
|------|------|
${recs.map((f) => `| ${path.relative(MEDIA, f)} | ${path.basename(f)} |`).join("\n")}

Screenshot alone ≠ completed mutating journey. Blocked rows are intentional.
`;
  await fs.writeFile(path.join(DOCS, "journeys.md"), journeys);

  // executive summary md (legacy .doc requested — provide .md + html; .doc optional via html)
  const execSummary = `# Influrios End-to-End Audit — Executive summary

**runId:** ${RUN_ID}  
**Deployed build:** \`${manifest.buildId}\`  
**Base URL:** ${manifest.baseUrl}  
**Date:** 2026-11-18 (UTC)

## Verdict

**Audit incomplete with blockers.**

The browsable pack covers preflight, route/action inventory, authenticated read-only navigation across Public/Influencer/Business/Admin, centered-popup geometry samples (Pass on sampled dialogs), and login/pricing checks. Critical sandbox mutating journeys (invite → sign → fund → milestone → payout, subscription checkout, notification interception) were **not** executed because staging isolation and a proven mail sink were not confirmed.

## Counts

- Cases: **${results.length}**
- Functional Pass: **${byFn.Pass || 0}** · Fail: **${byFn.Fail || 0}** · Blocked: **${byFn.Blocked || 0}** · Not tested: **${byFn["Not tested"] || 0}** · N/A: **${byFn["Not applicable"] || 0}**
- Issues: **${issues.length}** (P0: ${issues.filter((i) => i.severity === "P0").length})
- Screenshots: ${shots.length} · Recordings: ${recs.length}

## Top blockers / defects

1. **BLK-ISOLATION** — confirm isolated staging or set \`AUDIT_ISOLATION_CONFIRMED=1\`
2. **BLK-MAIL-SINK** — provide allowlisted sink + interception proof
3. **ISSUE-P0-ADMIN-LOGIN-DEFAULT-CREDS** — remove concrete default admin credentials from \`/admin/login\` (separate hotfix; not silently fixed in this audit)
4. **BLK-DEPLOY-SHA** — deployed \`ada9c7f5\` ≠ local PR #532 HEAD

## Completed vs incomplete

| Completed (evidence-backed) | Incomplete / blocked |
|-----------------------------|----------------------|
| Preflight provider labeling (Stripe Sandbox, SMTP Ready, in-app signing) | J01 verify, J05–J08 notices |
| Role logins + invalid login | J04–J15 mutating main collaboration |
| Route inventory opens (128 source routes mapped; audited subset executed) | J16–J20 sandbox money matrix |
| J30 centered popup samples Pass | Provider-sandbox checkout/payout proof |
| Agency deferred labeled | End-to-end verified gate |

## Next actions for Ola

1. Confirm isolation + mail allowlist (unblocks mutating suite).  
2. Authorize separate P0 admin-login credential hotfix.  
3. Re-run mutating journeys on confirmed staging; refresh pack.

Full pack index: [index.html](./index.html)
`;
  await fs.writeFile(path.join(DOCS, "executive-summary.md"), execSummary);
  // Simple legacy-friendly HTML doc stand-in (reviewers can open/download); true .doc binary omitted to avoid credential tooling issues
  await fs.writeFile(
    path.join(DOCS, "Influrios_E2E_Audit_Executive_Summary.doc.html"),
    `<!DOCTYPE html><html><head><meta charset="utf-8"><title>E2E Audit Executive Summary</title></head><body><pre>${esc(execSummary)}</pre></body></html>`,
  );

  // fixture instructions
  await fs.writeFile(
    path.join(DOCS, "fixtures-and-run.md"),
    `# Fixtures & run instructions

## Run

- runId: \`${RUN_ID}\`
- Harness (agent store): \`/cursor/stores/self/internal/e2e-audit-work/\`
- Secrets: \`AUDIT_*\` (never commit). Optional: \`MAIL_SINK_TO\`, \`AUDIT_ISOLATION_CONFIRMED=1\`, \`AUDIT_BASE_URL\`

## Fixtures used

| Alias | Source | Notes |
|-------|--------|-------|
| AUDIT influencer/business/admin | Cloud Agent secrets | Existing accounts; not freshly seeded this run |
| AUDIT_<runId> namespace seeds | **Not created** | Blocked by BLK-ISOLATION |
| Main campaign entity | **Not created** | Requires UI mutations after isolation confirm |

Auth storage kept under \`/tmp/e2e-audit/auth\` (not in pack).
`,
  );

  // checksums for media
  const checksumLines = [];
  for (const f of [...shots, ...recs, ...preflight].sort()) {
    const h = await sha256File(f);
    checksumLines.push(`${h}  ${path.relative(MEDIA, f)}`);
  }
  await fs.writeFile(path.join(MEDIA, "SHA256SUMS.txt"), checksumLines.join("\n") + "\n");
  await fs.writeFile(path.join(DOCS, "SHA256SUMS-media.txt"), checksumLines.join("\n") + "\n");

  // index.html browsable
  const rows = results
    .map((r) => {
      const shotsHtml = (r.screenshotRefs || [])
        .map((s) => {
          const rel = s.rel || (s.path ? path.relative(MEDIA, s.path) : null);
          if (!rel) return "";
          return `<a href="../../media/e2e-audit/${rel}" target="_blank">shot</a>`;
        })
        .filter(Boolean)
        .join(" ");
      return `<tr data-role="${esc(r.role)}" data-journey="${esc(r.journeyId)}" data-viewport="${esc(r.viewport)}" data-fn="${esc(r.functionalResult)}" data-vis="${esc(r.visualResult)}">
<td>${esc(r.caseId)}</td><td>${esc(r.journeyId)}</td><td>${esc(r.role)}</td><td>${esc(r.viewport)}</td>
<td>${esc(r.functionalResult)}</td><td>${esc(r.visualResult)}</td><td>${esc(r.integrationLevel)}</td>
<td>${esc(r.blocker || "")}</td><td>${shotsHtml}</td>
<td><details><summary>detail</summary><pre>${esc(JSON.stringify({ expected: r.expected, actual: r.actual, finalUrl: r.finalUrl, assertions: r.assertionRefs }, null, 2))}</pre></details></td>
</tr>`;
    })
    .join("\n");

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>Influrios E2E Audit Pack — ${RUN_ID}</title>
<style>
:root{--bg:#f4f7fb;--card:#fff;--ink:#14213d;--muted:#5b6b7c;--line:#d7e0ea;--pass:#0f7b4b;--fail:#b42318;--blocked:#a15c00;--nt:#4b5563}
*{box-sizing:border-box}body{margin:0;font:14px/1.45 ui-sans-serif,system-ui,sans-serif;background:linear-gradient(180deg,#eaf1ff,#f7fafc);color:var(--ink)}
header{padding:28px 24px 12px;max-width:1200px;margin:0 auto}h1{margin:0 0 6px;font-size:28px}
.sub{color:var(--muted)}nav{display:flex;flex-wrap:wrap;gap:10px;margin:14px 0}
nav a{color:#3b4fd8;text-decoration:none;font-weight:600}.cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:10px;max-width:1200px;margin:0 auto 18px;padding:0 24px}
.card{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:12px}.card b{display:block;font-size:22px}
.wrap{max-width:1200px;margin:0 auto;padding:0 24px 40px}
.filters{display:flex;flex-wrap:wrap;gap:8px;margin:10px 0 14px}
select{padding:6px 8px;border-radius:8px;border:1px solid var(--line);background:#fff}
table{width:100%;border-collapse:collapse;background:var(--card);border:1px solid var(--line);border-radius:12px;overflow:hidden}
th,td{padding:8px 10px;border-bottom:1px solid var(--line);vertical-align:top;text-align:left}th{background:#eef3fa;font-size:12px;text-transform:uppercase;letter-spacing:.04em}
tr.hidden{display:none}pre{white-space:pre-wrap;max-width:420px}.tag-Pass{color:var(--pass);font-weight:700}.tag-Fail{color:var(--fail);font-weight:700}.tag-Blocked{color:var(--blocked);font-weight:700}
.note{background:#fff8e8;border:1px solid #f0d59a;padding:10px 12px;border-radius:10px;margin:10px 0}
</style>
</head>
<body>
<header>
  <h1>Influrios E2E audit pack</h1>
  <div class="sub">${esc(RUN_ID)} · build <code>${esc(manifest.buildId)}</code> · ${esc(manifest.baseUrl)}</div>
  <div class="note"><b>Verdict: Audit incomplete with blockers.</b> Mutating sandbox journeys stopped for isolation/mail-sink. Screenshot ≠ completed critical journey. Agency deferred; Payment v2 paused.</div>
  <nav>
    <a href="./executive-summary.md">Executive summary</a>
    <a href="./environment.md">Environment</a>
    <a href="./blockers.md">Blockers</a>
    <a href="./journeys.md">Journeys</a>
    <a href="./coverage.md">Coverage</a>
    <a href="./route-inventory.csv">Routes CSV</a>
    <a href="./action-inventory.csv">Actions CSV</a>
    <a href="./issues.csv">Issues CSV</a>
    <a href="./results.json">results.json</a>
    <a href="./downloads/">Downloads</a>
  </nav>
</header>
<section class="cards">
  <div class="card"><span>Cases</span><b>${results.length}</b></div>
  <div class="card"><span>Pass</span><b>${byFn.Pass || 0}</b></div>
  <div class="card"><span>Blocked</span><b>${byFn.Blocked || 0}</b></div>
  <div class="card"><span>Fail</span><b>${byFn.Fail || 0}</b></div>
  <div class="card"><span>P0 issues</span><b>${issues.filter((i) => i.severity === "P0").length}</b></div>
  <div class="card"><span>Screenshots</span><b>${shots.length}</b></div>
  <div class="card"><span>Recordings</span><b>${recs.length}</b></div>
</section>
<div class="wrap">
  <div class="filters">
    <label>Role <select id="role"><option value="">All</option></select></label>
    <label>Journey <select id="journey"><option value="">All</option></select></label>
    <label>Viewport <select id="viewport"><option value="">All</option></select></label>
    <label>Functional <select id="fn"><option value="">All</option></select></label>
    <label>Visual <select id="vis"><option value="">All</option></select></label>
  </div>
  <table>
    <thead><tr><th>Case</th><th>Journey</th><th>Role</th><th>Viewport</th><th>Fn</th><th>Vis</th><th>Level</th><th>Blocker</th><th>Shots</th><th>Detail</th></tr></thead>
    <tbody id="tbody">${rows}</tbody>
  </table>
</div>
<script>
const sels=['role','journey','viewport','fn','vis'];
const vals={};
for (const tr of document.querySelectorAll('tbody tr')) {
  for (const [k,attr] of [['role','data-role'],['journey','data-journey'],['viewport','data-viewport'],['fn','data-fn'],['vis','data-vis']]) {
    vals[k]=vals[k]||new Set(); vals[k].add(tr.getAttribute(attr)||'');
  }
}
for (const k of sels) {
  const el=document.getElementById(k);
  [...vals[k]].filter(Boolean).sort().forEach(v=>{const o=document.createElement('option');o.value=v;o.textContent=v;el.appendChild(o)});
  el.addEventListener('change', apply);
}
function apply(){
  const f=Object.fromEntries(sels.map(k=>[k,document.getElementById(k).value]));
  for (const tr of document.querySelectorAll('#tbody tr')) {
    const ok = (!f.role||tr.dataset.role===f.role)&&(!f.journey||tr.dataset.journey===f.journey)&&(!f.viewport||tr.dataset.viewport===f.viewport)&&(!f.fn||tr.dataset.fn===f.fn)&&(!f.vis||tr.dataset.vis===f.vis);
    tr.classList.toggle('hidden', !ok);
  }
}
for (const td of document.querySelectorAll('td')) {
  if (['Pass','Fail','Blocked'].includes(td.textContent)) td.classList.add('tag-'+td.textContent);
}
</script>
</body></html>`;
  await fs.writeFile(path.join(DOCS, "index.html"), html);

  // README
  await fs.writeFile(
    path.join(DOCS, "README.md"),
    `# Influrios E2E audit pack (${RUN_ID})

**Verdict:** Audit incomplete with blockers.

Browse: [index.html](./index.html)  
Executive: [executive-summary.md](./executive-summary.md)  
Environment / blockers: [environment.md](./environment.md) · [blockers.md](./blockers.md)

Media: \`/cursor/stores/self/media/e2e-audit/\` (screenshots, recordings, preflight, SHA256SUMS.txt)

Downloads: [downloads/](./downloads/)

Agency deferred. Payment Standard v2 paused. No live money / real customer notices executed.
`,
  );

  // zips
  const dl = path.join(DOCS, "downloads");
  await fs.mkdir(dl, { recursive: true });
  const zipDocs = path.join(dl, "influrios-e2e-audit-docs.zip");
  const zipShots = path.join(dl, "influrios-e2e-audit-screenshots.zip");
  const zipRecs = path.join(dl, "influrios-e2e-audit-recordings.zip");
  const zipPre = path.join(dl, "influrios-e2e-audit-preflight.zip");
  execSync(`cd ${JSON.stringify(DOCS)} && zip -qr ${JSON.stringify(zipDocs)} . -x 'downloads/*'`, { stdio: "inherit" });
  execSync(`cd ${JSON.stringify(MEDIA)} && zip -qr ${JSON.stringify(zipShots)} screenshots SHA256SUMS.txt`, { stdio: "inherit" });
  execSync(`cd ${JSON.stringify(MEDIA)} && zip -qr ${JSON.stringify(zipRecs)} recordings`, { stdio: "inherit" });
  execSync(`cd ${JSON.stringify(MEDIA)} && zip -qr ${JSON.stringify(zipPre)} preflight`, { stdio: "inherit" });

  const dlIndex = `# Downloads

| Package | Path | Bytes | SHA-256 |
|---------|------|------:|---------|
${(
    await Promise.all(
      [zipDocs, zipShots, zipRecs, zipPre].map(async (f) => {
        const st = await fs.stat(f);
        const h = await sha256File(f);
        return `| ${path.basename(f)} | ${f} | ${st.size} | \`${h}\` |`;
      }),
    )
  ).join("\n")}

Full media checksums: [../SHA256SUMS-media.txt](../SHA256SUMS-media.txt)
`;
  await fs.writeFile(path.join(dl, "README.md"), dlIndex);

  // update manifest
  manifest.packGeneratedAt = new Date().toISOString();
  manifest.downloads = [zipDocs, zipShots, zipRecs, zipPre];
  manifest.caseCount = results.length;
  await fs.writeFile(path.join(DOCS, "manifest.json"), JSON.stringify(manifest, null, 2));

  console.log(
    JSON.stringify(
      {
        cases: results.length,
        byFn,
        downloads: manifest.downloads.map((d) => path.basename(d)),
        verdict: "Audit incomplete with blockers",
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
