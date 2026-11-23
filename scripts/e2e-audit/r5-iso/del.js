const { chromium, BASE, U, session } = require('./lib'); const C = require('./capture'); const db = require('./db'); const fs = require('fs');
const dir = process.env.EV + '/C015-A053-CHAIN'; const r = JSON.parse(fs.readFileSync(dir + '/result.json')); const brief = r.app[1];
(async () => { const b = await chromium.launch(); const biz = await session(b, U.bizA); const p = biz.p;
  await p.goto(`${BASE}/collaboration/business?tab=requests`); await p.waitForLoadState('networkidle');
  const rowMenu = p.locator(`summary[aria-label="More actions"]`); const n = await rowMenu.count(); let idx = -1;
  for (let i = 0; i < n; i++) { const txt = await rowMenu.nth(i).evaluate(el => (el.closest('tr, li, article, div.rounded-2xl') || el.parentElement.parentElement).innerText); if (/C-015 Delete/.test(txt)) { idx = i; break; } }
  r.rowFound = idx >= 0; if (idx < 0) throw new Error('row not found');
  await rowMenu.nth(idx).click(); await p.waitForTimeout(300); await C.shot(p, dir, '4-row-menu');
  const del = rowMenu.nth(idx).locator('xpath=..').locator('button', { hasText: 'Delete request' }); r.deleteVisible = await del.count();
  await Promise.all([p.waitForNavigation().catch(() => {}), del.first().click()]); await p.waitForLoadState('networkidle');
  const t = await C.shot(p, dir, '5-after-delete'); r.deleteUrl = p.url(); r.deleteMsg = decodeURIComponent((p.url().match(/error=([^&]+)/) || [, ''])[1]) || (t.match(/[^\n]*(cannot|signed|can't|not deleted|closed|kept)[^\n]*/i) || [null])[0];
  r.requestStillExists = db(`select count(*) from "MarketplaceBusinessRequest" where "briefId"='${brief}'`); r.requestStatus = db(`select status from "MarketplaceBusinessRequest" where "briefId"='${brief}'`);
  r.c015 = r.requestStillExists === '1' ? 'Pass (delete refused; signed request kept)' : 'Fail: signed request deleted';
  fs.writeFileSync(dir + '/result.json', JSON.stringify(r, null, 2)); console.log(JSON.stringify({ discountLine: r.discountLine, totalBefore: r.totalBefore, totalAfter: r.totalAfter, discountDb: r.discountDb, contract: r.contract, deleteVisible: r.deleteVisible, deleteMsg: r.deleteMsg, requestStillExists: r.requestStillExists, requestStatus: r.requestStatus, c015: r.c015 }, null, 1)); await b.close(); })().catch(e => { console.error('ERR', e.message); process.exit(1); });
