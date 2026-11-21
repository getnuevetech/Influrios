const { chromium, BASE, U, session } = require('./lib'); const C = require('./capture'); const fs = require('fs');
const { execSync } = require('child_process');
const dir = process.argv[2] + '/INV-DC-010'; const res = { check: 'INV-DC-010', steps: [] };
const db = require('./db');
(async () => {
  const b = await chromium.launch();
  const inf = await session(b, U.infA); const biz = await session(b, U.bizA);
  const RESUME = process.argv[3] === 'resume';
  if (!RESUME) res.before = await C.influencer(inf.p, dir, '1-before');
  if (!RESUME) {
  await biz.p.goto(BASE + '/creators/audit-r5iso01-a?invite=1'); await biz.p.waitForLoadState('networkidle');
  await C.shot(biz.p, dir, '2-biz-invite-dialog');
  await biz.p.selectOption('select[name=requestId]', { label: 'AUDIT r5 DC-010 Launch' }).catch(e => res.steps.push('select failed: ' + e.message));
  await biz.p.fill('textarea[name=note]', 'AUDIT r5 invitation for DC-010');
  await Promise.all([biz.p.waitForNavigation().catch(() => {}), biz.p.click('button:has-text("Send invitation")')]);
  await biz.p.waitForLoadState('networkidle'); await C.shot(biz.p, dir, '3-biz-after-send'); res.steps.push('business sent invitation via profile dialog; landed ' + biz.p.url());
  }
  res.db = db(`select id, status, "toSlug", "createdAt" from "MarketplaceApplication" where "toSlug"='audit-r5iso01-a' order by "createdAt" desc limit 3`);

  res.after = await C.influencer(inf.p, dir, '4-after');
  res.afterReload = await C.influencer(inf.p, dir, '5-after-reload');
  const mob = await session(b, U.infA, true); res.afterMobile = await C.influencer(mob.p, dir, '6-after-mobile');
  res.bizAfter = await C.business(biz.p, dir, '7-biz');
  fs.writeFileSync(dir + '/result.json', JSON.stringify(res, null, 2)); console.log(JSON.stringify(res, null, 1));
  await b.close();
})().catch(e => { console.error(e); process.exit(1); });
