const { chromium, BASE, U, session } = require('./lib'); const C = require('./capture'); const db = require('./db'); const { admin, forms } = require('./survey2'); const { createRequest } = require('./wizard'); const fs = require('fs');
const results = {};
async function check(id, fn) { const dir = process.env.EV + '/' + id; fs.mkdirSync(dir, { recursive: true }); const r = { check: id, steps: [] };
  try { await fn({ dir, r, step: s => r.steps.push(s) }); } catch (e) { r.error = String(e.message || e).slice(0, 300); }
  fs.writeFileSync(dir + '/result.json', JSON.stringify(r, null, 2)); results[id] = r.result || ('ERROR ' + r.error); console.log(id, JSON.stringify(r).slice(0, 700)); }
(async () => { const b = await chromium.launch(); const biz = await session(b, U.bizA), infU = await session(b, U.infU); const a = await admin(b);
  if (process.argv[2] !== 'r062') await check('INV-A-029', async ({ dir, r, step }) => {
    await createRequest(biz.p, dir, { title: 'AUDIT r5 A-029 Decline', slugs: ['audit-r5iso01-u'] }); step('business invited Unrelated via wizard');
    const id = db(`select id from "MarketplaceApplication" where "toSlug"='audit-r5iso01-u' and status='REQUESTED' order by "createdAt" desc limit 1`);
    r.before = await C.influencer(infU.p, dir, '1-before');
    await infU.p.goto(BASE + '/collaboration/hub?view=collaborations'); await infU.p.waitForLoadState('networkidle');
    await infU.p.locator('button:has-text("Review")').first().click(); await infU.p.waitForTimeout(700); await C.shot(infU.p, dir, '2-popup');
    await Promise.all([infU.p.waitForNavigation().catch(() => {}), infU.p.locator('button:visible', { hasText: /^Decline$/ }).first().click()]); await infU.p.waitForLoadState('networkidle');
    await C.shot(infU.p, dir, '3-after-decline'); step('influencer declined from hub popup');
    r.status = db(`select status from "MarketplaceApplication" where id='${id}'`); r.after = await C.influencer(infU.p, dir, '4-after');
    r.result = r.status === 'DECLINED' && r.after.homeStat === 0 && r.after.sidebar.Collaborations === 0 ? 'Pass' : `Fail (status ${r.status}, homeStat ${r.after.homeStat}, badge ${r.after.sidebar.Collaborations})`;
  });
  await check('INV-R-062', async ({ dir, r, step }) => {
    await a.goto(BASE + '/admin/marketplace-listings'); await a.waitForLoadState('networkidle');
    const f = a.locator('form:has(select[name=creatorSlug])').first(); await f.evaluate(form => { let d = form.closest('details'); while (d) { d.open = true; d = d.parentElement && d.parentElement.closest('details'); } });
    await f.locator('select[name=creatorSlug]').selectOption('audit-r5iso01-b'); await f.locator('input[name=lookingFor]').fill('Tech brands'); await f.locator('textarea[name=summary]').fill('AUDIT r5 opening: unboxing videos');
    await f.locator('input[name=purpose]').fill('Sponsored video').catch(() => {}); await f.locator('input[name=location]').fill('Remote').catch(() => {});
    const st = await f.locator('select[name=status] option').allInnerTexts(); r.statusOptions = st; await f.locator('select[name=status]').selectOption({ label: st.find(x => /publish/i.test(x)) || st[0] });
    await C.shot(a, dir, '1-admin-form'); await Promise.all([a.waitForNavigation().catch(() => {}), f.evaluate(form => form.requestSubmit())]); await a.waitForLoadState('networkidle'); await C.shot(a, dir, '2-admin-saved');
    step('admin saved creator opening (form has no visible submit button — submitted with Enter/requestSubmit)');
    const oid = db(`select id from "MarketplaceCreatorOpportunity" order by "createdAt" desc limit 1`); r.openingId = oid;
    if (!oid) { r.result = 'Blocked: opening not created'; return; }
    const res = await biz.p.goto(`${BASE}/collaboration/openings/${oid}`); await biz.p.waitForLoadState('networkidle'); const t = await C.shot(biz.p, dir, '3-biz-opening-detail');
    r.http = res.status(); r.shows = /unboxing|AUDIT r5 opening/i.test(t); r.applyForm = await biz.p.locator('form button').allInnerTexts();
    r.result = r.http === 200 && r.shows ? 'Pass' : 'Fail';
  });
  if (process.argv[2] !== 'r062') await check('INV-C-013', async ({ dir, r, step }) => {
    await a.goto(BASE + '/admin/homepage'); await a.waitForLoadState('networkidle'); const live = a.locator('input[name=live]');
    r.liveBefore = await live.isChecked().catch(() => null); if (r.liveBefore === null) { r.result = 'Blocked: no live switch found'; return; }
    if (!r.liveBefore) { await live.check(); await Promise.all([a.waitForNavigation().catch(() => {}), a.locator('form:has(input[name=live]) button[type=submit]').first().click()]); await a.waitForLoadState('networkidle'); }
    step('admin turned public_pages_live on (Homepage)'); await C.shot(a, dir, '1-admin-live');
    r.profiles = db(`select slug||':'||coalesce("profileState"::text,'')||':'||claimed from "Creator" where slug like 'audit-r5iso01%' order by slug`).split('\n');
    const g = await (await b.newContext()).newPage(); await g.goto(BASE + '/discover'); await g.waitForLoadState('networkidle'); const t = await C.shot(g, dir, '2-guest-discover');
    r.listed = r.profiles.map(x => x.split(':')[0]).filter(s => t.includes(s) || t.includes(s.replace('audit-r5iso01-', 'AUDIT r5iso01 ')));
    r.unpublishedListed = r.profiles.filter(x => !/PUBLISHED/.test(x)).map(x => x.split(':')[0]).filter(s => r.listed.includes(s));
    r.result = r.unpublishedListed.length === 0 ? 'Pass' : 'Fail: unpublished listed ' + r.unpublishedListed.join(',');
  });
  if (process.argv[2] !== 'r062') await check('INV-C-015', async ({ dir, r, step }) => {
    await biz.p.goto(`${BASE}/collaboration/business/request/cmwqn1j2u00037dwrny5gkdlq`); await biz.p.waitForLoadState('networkidle'); await C.shot(biz.p, dir, '1-request');
    r.controls = (await biz.p.$$eval('main a, main button', es => es.filter(e => e.offsetParent).map(e => (e.innerText || '').trim().slice(0, 40)))).filter(x => /delete|close|remove/i.test(x));
    const del = biz.p.locator('main button:visible, main a:visible').filter({ hasText: /delete/i }).first();
    if (!(await del.count())) { r.result = 'Blocked: signed request (fixture without brief) has no delete control on its page'; return; }
    await del.click(); await biz.p.waitForTimeout(600); await C.shot(biz.p, dir, '2-delete-dialog');
    const conf = biz.p.locator('button[type=submit]:visible').filter({ hasText: /delete/i }).first(); if (await conf.count()) { await Promise.all([biz.p.waitForNavigation().catch(() => {}), conf.click()]); await biz.p.waitForLoadState('networkidle'); }
    const t = await C.shot(biz.p, dir, '3-after'); r.msg = (t.match(/[^\n]*(cannot|signed|refused|not deleted|kept)[^\n]*/i) || [null])[0];
    r.stillExists = db(`select count(*) from "MarketplaceBusinessRequest" where id='cmwqn1j2u00037dwrny5gkdlq'`);
    r.result = r.stillExists === '1' ? 'Pass (delete refused; request kept)' : 'Fail: signed request deleted';
  });
  if (process.argv[2] !== 'r062') await check('INV-A-053-survey', async ({ dir, r }) => { await a.goto(BASE + '/admin/payment-settings'); await a.waitForLoadState('networkidle'); r.forms = (await forms(a)).filter(f => /discount|code/i.test(f.fields + f.btn)); r.result = 'survey'; });
  if (process.argv[2] !== 'r062') fs.writeFileSync(process.env.EV + '/batchD-summary.json', JSON.stringify(results, null, 2)); await b.close(); })();
