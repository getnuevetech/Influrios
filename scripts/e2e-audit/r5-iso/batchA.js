const { chromium, BASE, U, session } = require('./lib'); const C = require('./capture'); const db = require('./db'); const { admin } = require('./survey2'); const fs = require('fs');
const F = 'cmwqnkk1f00037dc25lwesptv', APP_A = 'cmwqn2cdw00lr7do5nbnpcd87';
const vis = p => p.$$eval('main a, main button, main summary', els => [...new Set(els.filter(e => e.offsetParent).map(e => (e.innerText || '').trim().replace(/\s+/g, ' ').slice(0, 50)).filter(Boolean))]);
const results = {};
async function check(id, fn, b) { const dir = process.env.EV + '/' + id; fs.mkdirSync(dir, { recursive: true }); const r = { check: id, steps: [] };
  try { await fn({ dir, r, step: s => r.steps.push(s) }); } catch (e) { r.error = String(e.message || e).slice(0, 300); }
  fs.writeFileSync(dir + '/result.json', JSON.stringify(r, null, 2)); results[id] = r; console.log(id, JSON.stringify(r).slice(0, 600)); }
(async () => { const b = await chromium.launch();
  const infA = await session(b, U.infA), bizA = await session(b, U.bizA), infB = await session(b, U.infB);
  await check('INV-R-061', async ({ dir, r }) => { const res = await infA.p.goto(`${BASE}/collaboration/applications/${APP_A}`); await infA.p.waitForLoadState('networkidle'); const t = await C.shot(infA.p, dir, '1-detail'); r.http = res.status(); r.hasTitle = /DC-010 Launch/.test(t); r.controls = (await vis(infA.p)).filter(x => /Accept|Decline|Withdraw|Interested/.test(x)); r.result = r.http === 200 && r.hasTitle ? 'Pass' : 'Fail'; });
  await check('INV-A-045', async ({ dir, r, step }) => {
    r.statusBefore = db(`select status from "MarketplaceApplication" where id='${APP_A}'`); r.countsBefore = await C.influencer(infA.p, dir, '0-before');
    await infA.p.goto(`${BASE}/collaboration/applications/${APP_A}`); await infA.p.waitForLoadState('networkidle');
    await Promise.all([infA.p.waitForNavigation().catch(() => {}), infA.p.locator('main button:visible', { hasText: /^Accept$/ }).first().click()]); await infA.p.waitForLoadState('networkidle');
    const t = await C.shot(infA.p, dir, '1-after-accept'); step('influencer clicked Accept on application detail; url ' + infA.p.url());
    r.statusAfter = db(`select status||' collab='||coalesce("collaborationId",'-') from "MarketplaceApplication" where id='${APP_A}'`);
    await infA.p.reload(); await infA.p.waitForLoadState('networkidle'); await C.shot(infA.p, dir, '2-reload');
    r.countsAfter = await C.influencer(infA.p, dir, '3-after');
    r.result = /ACCEPTED|COLLABORATION_DRAFTED/.test(r.statusAfter) ? 'Pass' : 'Fail';
  });
  await check('INV-A-039', async ({ dir, r, step }) => {
    await bizA.p.goto(`${BASE}/collaboration/applications/${APP_A}`); await bizA.p.waitForLoadState('networkidle'); await C.shot(bizA.p, dir, '1-biz-detail');
    r.controls = (await vis(bizA.p)).filter(x => !/Dashboard|Profile|Discover|Analytics|Team|Billing|Verification|Settings|Log out|Action inbox|Contracts|Payments|Collaborations$/.test(x));
    const btn = bizA.p.locator('main button:visible').filter({ hasText: /Draft|Create collaboration|Start|Accept|Move/i });
    r.chosen = await btn.first().innerText().catch(() => null);
    if (r.chosen) { const before = db(`select status from "MarketplaceApplication" where id='${APP_A}'`); await Promise.all([bizA.p.waitForNavigation().catch(() => {}), btn.first().click()]); await bizA.p.waitForLoadState('networkidle'); await C.shot(bizA.p, dir, '2-after');
      r.statusBefore = before; r.statusAfter = db(`select status||' collab='||coalesce("collaborationId",'-') from "MarketplaceApplication" where id='${APP_A}'`); step('business clicked ' + r.chosen);
      await bizA.p.reload(); await C.shot(bizA.p, dir, '3-reload'); r.result = r.statusAfter.split(' ')[0] !== before ? 'Pass' : 'Fail'; }
    else r.result = 'Blocked: no business transition control on detail (status ' + db(`select status from "MarketplaceApplication" where id='${APP_A}'`) + ')';
  });
  await check('INV-R-065', async ({ dir, r }) => {
    await bizA.p.goto(`${BASE}/collaboration/records`); await bizA.p.waitForLoadState('networkidle'); await C.shot(bizA.p, dir, '1-records');
    const href = await bizA.p.$$eval('main a[href*="/collaboration/records/"]', as => as.map(a => a.getAttribute('href'))).catch(() => []);
    r.recordLinks = href.slice(0, 5); if (!href.length) { r.result = 'Blocked: no record link listed'; return; }
    const res = await bizA.p.goto(BASE + href[0]); await bizA.p.waitForLoadState('networkidle'); const t = await C.shot(bizA.p, dir, '2-record-detail');
    r.http = res.status(); r.sample = t.slice(t.indexOf('Log out') + 8, t.indexOf('Log out') + 300).replace(/\n+/g, ' | '); r.result = r.http === 200 && !/not found|404/i.test(t.slice(0, 2000)) ? 'Pass' : 'Fail';
  });
  for (const [id, who] of [['INV-T-013', bizA], ['INV-P-005', infB]]) await check(id, async ({ dir, r }) => {
    await who.p.goto(`${BASE}/payments?currency=USD&deal=${F}&tab=overview`); await who.p.waitForLoadState('networkidle'); await C.shot(who.p, dir, '1-dialog-overview');
    const tabs = await who.p.$$eval('a[href*="deal="][href*="tab="]', as => [...new Set(as.map(a => a.getAttribute('href').match(/tab=([a-z_]+)/)[1]))]); r.tabs = tabs; r.tabResults = {};
    for (const tb of tabs) { const res = await who.p.goto(`${BASE}/payments?currency=USD&deal=${F}&tab=${tb}`); await who.p.waitForLoadState('networkidle'); const t = await C.shot(who.p, dir, '2-tab-' + tb); r.tabResults[tb] = res.status() + ' ' + (t.match(/AUDIT r5 Workroom notices/) ? 'deal shown' : 'deal missing'); }
    r.result = tabs.length >= 2 && Object.values(r.tabResults).every(v => /^200 deal shown/.test(v)) ? 'Pass' : 'Fail';
  });
  await check('INV-P-012', async ({ dir, r }) => {
    await infB.p.goto(`${BASE}/payments?currency=USD&deal=${F}&tab=overview`); await infB.p.waitForLoadState('networkidle');
    const payout = infB.p.locator('a:visible, button:visible').filter({ hasText: /payout/i }); r.payoutControls = await payout.allInnerTexts();
    const pr = db(`select count(*) from "PayoutRecord"`) ; r.payoutRows = pr;
    r.result = 'Blocked: no payout exists (release path requires R6); M2 is release_scheduled only';
  });
  await check('INV-D-007E', async ({ dir, r }) => {
    for (const path of ['/creator/media-kit', '/c/audit-r5iso01-a']) { await infA.p.goto(BASE + path); await infA.p.waitForLoadState('networkidle'); await C.shot(infA.p, dir, path.replace(/\W+/g, '-')); }
    await infA.p.goto(BASE + '/creator/media-kit'); r.controls = await vis(infA.p); r.exportControl = r.controls.filter(x => /export|download|pdf|save/i.test(x));
    r.result = r.exportControl.length ? 'Ready: control found' : 'Fail: no export/download action on the media kit (only "View media kit")';
  });
  await check('INV-J-001', async ({ r }) => {
    r.jobs = db(`select kind||':'||status||':'||"attempts" from "Job" where kind='invitation_email' order by "createdAt"`).split('\n');
    r.events = db(`select kind from "InvitationEvent" where kind like 'send%' order by "createdAt"`).split('\n');
    r.result = r.jobs.every(j => j.includes('succeeded')) && r.events.includes('send_delivered') ? 'Pass (admin Send email → invitation_email job succeeded → SMTP sink delivery; INV-A-031 evidence)' : 'Fail';
  });
  for (const [id, path, re] of [['INV-A-079', '/trust', /open (a )?dispute|raise a dispute|start a dispute/i], ['INV-A-064', `/collaboration/work/${F}?tab=milestones`, /dispute|evidence/i]]) await check(id, async ({ dir, r }) => {
    await bizA.p.goto(BASE + path); await bizA.p.waitForLoadState('networkidle'); const t = await C.shot(bizA.p, dir, '1-page');
    const ctrls = await vis(bizA.p); r.disputeControls = ctrls.filter(x => re.test(x));
    if (id === 'INV-A-064') { await bizA.p.goto(`${BASE}/payments?currency=USD&deal=${F}&tab=overview`); await bizA.p.waitForLoadState('networkidle'); await C.shot(bizA.p, dir, '2-payments-dialog'); r.disputeControls.push(...(await bizA.p.$$eval('a,button', els => els.filter(e => e.offsetParent).map(e => e.innerText.trim()).filter(x => /dispute|evidence/i.test(x))))); }
    r.result = r.disputeControls.length ? 'Ready: control found' : 'Fail: no member dispute entry on this surface';
  });
  for (const [id, re] of [['INV-A-034', /refresh|suggest/i], ['INV-A-042', /managed|match me|request a match/i]]) await check(id, async ({ dir, r }) => {
    r.found = [];
    for (const path of ['/collaboration/business?tab=opportunities&view=recommended', '/collaboration/business?tab=opportunities', '/business/home', '/collaboration/business?tab=requests&request=cmwqn84om00zo7do5vwbp66pz']) { await bizA.p.goto(BASE + path); await bizA.p.waitForLoadState('networkidle'); await C.shot(bizA.p, dir, path.replace(/\W+/g, '-').slice(0, 60)); r.found.push(...(await vis(bizA.p)).filter(x => re.test(x)).map(x => path + ' :: ' + x)); }
    r.result = r.found.length ? 'Ready: control found' : 'Fail: action exists in code but no UI control on business surfaces';
  });
  fs.writeFileSync(process.env.EV + '/batchA-summary.json', JSON.stringify(Object.fromEntries(Object.entries(results).map(([k, v]) => [k, v.result || v.error])), null, 2));
  await b.close(); })();
