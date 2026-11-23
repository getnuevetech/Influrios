const { chromium, BASE, U, session } = require('./lib'); const C = require('./capture'); const db = require('./db'); const fs = require('fs'); const { execSync } = require('child_process');
const F = 'cmwqnkk1f00037dc25lwesptv'; const dir = process.env.EV + '/CANCEL-CHAIN'; fs.mkdirSync(dir, { recursive: true }); const r = { steps: [] };
const mails = () => JSON.parse(execSync('curl -s 127.0.0.1:8025/api/v1/messages').toString()).messages;
const ctl = p => p.$$eval('main button, main a, [role=dialog] button, [data-account-dialog-root] button', es => [...new Set(es.filter(e => e.offsetParent).map(e => (e.innerText || '').trim().slice(0, 40)).filter(x => /cancel|accept|question|dispute|settle|propos|refund/i.test(x)))]);
(async () => { const b = await chromium.launch(); const biz = await session(b, U.bizA), inf = await session(b, U.infB); const m0 = mails().length;
  const URL = `${BASE}/payments?currency=USD&deal=${F}&case=refund`;
  await biz.p.goto(URL); await biz.p.waitForLoadState('networkidle'); await C.shot(biz.p, dir, '1-biz-case-url'); r.bizControls = await ctl(biz.p);
  const reasons = await biz.p.$$eval('select[name=reason] option', os => os.map(o => o.value).filter(Boolean)); r.reasons = reasons;
  if (reasons.length) { await biz.p.selectOption('select[name=reason]', reasons[0]); await biz.p.fill('textarea[name=note]', 'AUDIT r5 cancellation request');
    await Promise.all([biz.p.waitForNavigation().catch(() => {}), biz.p.click('button:has-text("Request cancellation")')]); await biz.p.waitForLoadState('networkidle');
    const t = await C.shot(biz.p, dir, '2-biz-after-request'); r.afterRequestUrl = biz.p.url(); r.afterRequestMsg = (t.match(/[^\n]*(cancellation|error|proposal|requested)[^\n]*/gi) || []).slice(0, 5); }
  r.settlement = db(`select "versionNumber"||':'||status||':'||left("proposalJson"::text,160) from "FundingSettlement" where "fundingId"='${F}' order by "createdAt" desc limit 2`);
  r.fundingStatus = db(`select status from "CollaborationFunding" where id='${F}'`);
  await biz.p.goto(`${BASE}/payments?currency=USD&deal=${F}&tab=overview`); await biz.p.waitForLoadState('networkidle'); await C.shot(biz.p, dir, '3-biz-overview-after'); r.bizOverviewHasCaseLink = (await biz.p.locator('a', { hasText: 'View cancellation case' }).count()) > 0;
  await inf.p.goto(`${BASE}/payments?currency=USD&deal=${F}&tab=overview`); await inf.p.waitForLoadState('networkidle'); await C.shot(inf.p, dir, '4-inf-overview'); r.infHasCaseLink = (await inf.p.locator('a', { hasText: 'View cancellation case' }).count()) > 0;
  await inf.p.goto(URL); await inf.p.waitForLoadState('networkidle'); await C.shot(inf.p, dir, '5-inf-case'); r.infControls = await ctl(inf.p);
  const accept = inf.p.locator('button:visible', { hasText: /^Accept/ }).first();
  if (await accept.count()) { for (const c of await inf.p.locator('form input[type=checkbox]:visible').all()) await c.check().catch(() => {}); r.infClicked = await accept.innerText(); await Promise.all([inf.p.waitForNavigation().catch(() => {}), accept.click()]); await inf.p.waitForLoadState('networkidle'); const t = await C.shot(inf.p, dir, '6-inf-after-accept'); r.infAfterMsg = (t.match(/[^\n]*(accepted|cancel|error|refund|waiting)[^\n]*/gi) || []).slice(0, 5); }
  r.settlementAfter = db(`select "versionNumber"||':'||status from "FundingSettlement" where "fundingId"='${F}' order by "createdAt" desc limit 2`);
  r.fundingStatusAfter = db(`select status from "CollaborationFunding" where id='${F}'`);
  r.mail = mails().slice(m0).map(x => x.created.slice(11, 19) + ' ' + x.to.join() + ' :: ' + x.subject);
  fs.writeFileSync(dir + '/result.json', JSON.stringify(r, null, 2)); console.log(JSON.stringify(r, null, 1)); await b.close(); })().catch(e => { console.error(e.message); fs.writeFileSync(dir + '/result.json', JSON.stringify({ ...r, error: e.message }, null, 2)); });
