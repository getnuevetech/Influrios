const { chromium, BASE, U, session } = require('./lib'); const C = require('./capture'); const db = require('./db'); const { createRequest } = require('./wizard'); const fs = require('fs');
const dir = process.env.EV + '/C015-A053-CHAIN'; fs.mkdirSync(dir, { recursive: true }); const r = { steps: [] }; const step = s => { r.steps.push(s); console.log(s); };
async function signAs(p, who, name, cid) {
  await p.goto(`${BASE}/collaboration/contracts/${cid}`); await p.waitForLoadState('networkidle');
  await p.locator('input[name=typedName]:visible').fill(name); const cv = p.locator('canvas:visible').first(); await cv.scrollIntoViewIfNeeded(); await p.waitForTimeout(300); const bx = await cv.boundingBox();
  await p.mouse.move(bx.x + 20, bx.y + bx.height / 2); await p.mouse.down(); for (let i = 1; i <= 12; i++) await p.mouse.move(bx.x + 20 + i * (bx.width - 40) / 12, bx.y + bx.height / 2 + (i % 2 ? -20 : 20), { steps: 4 }); await p.mouse.up();
  for (const c of await p.locator('form input[type=checkbox]:visible').all()) await c.check().catch(() => {});
  await Promise.all([p.waitForNavigation().catch(() => {}), p.locator('form button[type=submit]:visible').filter({ hasText: /Sign agreement now/ }).first().click()]); await p.waitForLoadState('networkidle');
  const t = await C.shot(p, dir, `sign-${who}`); return (t.match(/Status:[^\n]*/) || [null])[0];
}
(async () => { const b = await chromium.launch(); const biz = await session(b, U.bizA), inf = await session(b, U.infB);
  await createRequest(biz.p, dir, { title: 'AUDIT r5 C-015 Delete', slugs: ['audit-r5iso01-b'] }); step('wizard invite to influencer B');
  const app = db(`select id||'|'||"briefId" from "MarketplaceApplication" where "toSlug"='audit-r5iso01-b' and status='REQUESTED' order by "createdAt" desc limit 1`).split('|'); r.app = app;
  await inf.p.goto(`${BASE}/collaboration/applications/${app[0]}`); await inf.p.waitForLoadState('networkidle');
  await Promise.all([inf.p.waitForNavigation().catch(() => {}), inf.p.locator('main button:visible', { hasText: /^Accept$/ }).first().click()]); step('influencer accepted on detail page (current product; P1-AUD-10)');
  await biz.p.goto(`${BASE}/collaboration/applications/${app[0]}`); await biz.p.waitForLoadState('networkidle');
  await Promise.all([biz.p.waitForNavigation().catch(() => {}), biz.p.getByText('Create the agreement').first().click()]); await biz.p.waitForLoadState('networkidle');
  const url = biz.p.url().replace(/&step=\w+/, '') + '&jurisdiction=US&serviceLevel=discovery&step=preview'; await biz.p.goto(url); await biz.p.waitForLoadState('networkidle'); await biz.p.waitForTimeout(1200);
  await biz.p.selectOption('select[name=payoutMethod]', 'local_bank'); for (const n of ['feeDisclosureAccepted', 'partyAccepted']) await biz.p.check(`input[name=${n}]`);
  await C.shot(biz.p, dir, '1-wizard'); await Promise.all([biz.p.waitForNavigation().catch(() => {}), biz.p.click('button[name=intent]:has-text("Send for signature")')]); await biz.p.waitForLoadState('networkidle');
  const cid = db(`select id from "ContractDocument" order by "createdAt" desc limit 1`); r.contractId = cid; step('agreement sent: ' + biz.p.url());
  // INV-A-053: apply discount on the agreement
  await biz.p.goto(`${BASE}/collaboration/contracts/${cid}`); await biz.p.waitForLoadState('networkidle'); const before = await C.shot(biz.p, dir, '2-before-discount');
  r.totalBefore = (before.match(/(You pay|Total you pay|Business pays)[^\n]*\n?[^\n]*/) || [null])[0];
  const add = biz.p.getByText('Add discount code').first();
  if (await add.count()) { await add.click(); await biz.p.waitForTimeout(400); await biz.p.locator('input:visible').filter({ hasNot: biz.p.locator('[name]') }).last().fill('AUDITR5TEN').catch(async () => { await biz.p.locator('input:not([name]):visible').last().fill('AUDITR5TEN'); });
    await biz.p.locator('button:visible', { hasText: /^Apply/ }).first().click(); await biz.p.waitForTimeout(2000); await biz.p.reload(); await biz.p.waitForLoadState('networkidle');
    const after = await C.shot(biz.p, dir, '3-after-discount'); r.discountLine = (after.match(/[^\n]*(AUDITR5TEN|discount)[^\n]*/gi) || []).slice(0, 4); r.totalAfter = (after.match(/(You pay|Total you pay|Business pays)[^\n]*\n?[^\n]*/) || [null])[0];
    r.discountDb = db(`select "reservedCount"||'/'||"redeemedCount" from "DiscountOffer" where "displayCode"='AUDITR5TEN'`); step('discount applied on agreement');
  } else r.discountLine = ['no Add discount code control on agreement page'];
  r.signBiz = await signAs(biz.p, 'business', 'Dana Audit Business', cid); r.signInf = await signAs(inf.p, 'influencer', 'Bea Audit Influencer', cid);
  r.contract = db(`select status from "ContractDocument" where id='${cid}'`); step('both signed: ' + r.contract);
  // INV-C-015: try to delete the signed request
  await biz.p.goto(`${BASE}/collaboration/business?tab=requests`); await biz.p.waitForLoadState('networkidle');
  const row = biz.p.locator('main').locator(':text("AUDIT r5 C-015 Delete")').first(); r.requestListed = await row.count();
  await biz.p.goto(`${BASE}/collaboration/business?tab=requests&request=${app[1]}`); await biz.p.waitForLoadState('networkidle'); await C.shot(biz.p, dir, '4-request');
  const menu = biz.p.locator('summary:visible, button:visible').filter({ hasText: '···' }).first(); if (await menu.count()) { await menu.click(); await biz.p.waitForTimeout(300); }
  const del = biz.p.locator('button:visible', { hasText: 'Delete request' }).first(); r.deleteVisible = await del.count();
  if (r.deleteVisible) { await Promise.all([biz.p.waitForNavigation().catch(() => {}), del.click()]); await biz.p.waitForLoadState('networkidle'); }
  const t = await C.shot(biz.p, dir, '5-after-delete'); r.deleteUrl = biz.p.url(); r.deleteMsg = (t.match(/[^\n]*(cannot|signed|can't|not deleted|close|kept|refused)[^\n]*/i) || [null])[0];
  r.requestStillExists = db(`select count(*) from "MarketplaceBusinessRequest" where "briefId"='${app[1]}'`); r.briefStatus = db(`select status from "CampaignBrief" where id='${app[1]}'`);
  fs.writeFileSync(dir + '/result.json', JSON.stringify(r, null, 2)); console.log(JSON.stringify(r, null, 1)); await b.close(); })().catch(e => { console.error('ERR', e.message); fs.writeFileSync(dir + '/result.json', JSON.stringify({ ...r, error: e.message }, null, 2)); process.exit(1); });
