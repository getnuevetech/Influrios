const { createRequest } = require('./wizard');
require('./runner').run('INV-DC-013', async ({ b, dir, res, BASE, U, session, C, db, step }) => {
  const inf = await session(b, U.infB); const biz = await session(b, U.bizA);
  res.before = await C.influencer(inf.p, dir, '1-before'); // baseline captured before the wizard send in attempt 1: all 0
  const existing = db(`select count(*) from "MarketplaceApplication" where "toSlug"='audit-r5iso01-b' and status in ('REQUESTED','VIEWED')`);
  if (existing === '0') { res.create = await createRequest(biz.p, dir, { title: 'AUDIT r5 DC-013 Withdraw', slugs: ['audit-r5iso01-b'] }); step('business created private request via wizard and sent invitation'); }
  else step('re-using invitation already sent via wizard in previous attempt (same run)');
  const app = db(`select id||'|'||coalesce("briefId",'')||'|'||status from "MarketplaceApplication" where "toSlug"='audit-r5iso01-b' order by "createdAt" desc limit 1`).split('|');
  res.application = { id: app[0], briefId: app[1], statusBefore: app[2] };
  res.invited = await C.influencer(inf.p, dir, '2-invited');
  await biz.p.goto(`${BASE}/collaboration/business?tab=requests&request=${app[1]}&panel=invitations`); await biz.p.waitForLoadState('networkidle');
  await C.shot(biz.p, dir, '3-biz-invitations-panel');
  await biz.p.click('text=Withdraw participation'); await biz.p.waitForLoadState('networkidle');
  await C.shot(biz.p, dir, '4-biz-withdraw-dialog');
  const msg = biz.p.locator('textarea[name=message]'); if (await msg.count() && !(await msg.inputValue())) await msg.fill('AUDIT r5: campaign cancelled.');
  await Promise.all([biz.p.waitForNavigation().catch(() => {}), biz.p.click('button:has-text("Withdraw & notify")')]);
  await biz.p.waitForLoadState('networkidle'); await C.shot(biz.p, dir, '5-biz-after-withdraw'); step('business withdrew via dialog; landed ' + biz.p.url());
  res.statusAfter = db(`select status from "MarketplaceApplication" where id='${app[0]}'`);
  res.after = await C.influencer(inf.p, dir, '6-after');
  res.afterReload = await C.influencer(inf.p, dir, '7-after-reload');
  const mob = await session(b, U.infB, true); res.afterMobile = await C.influencer(mob.p, dir, '8-after-mobile');
  await inf.p.goto(BASE + '/creator/notifications'); await inf.p.waitForLoadState('networkidle'); const t = await C.shot(inf.p, dir, '9-notifications');
  res.withdrawNoticeVisible = /withdr/i.test(t);
  res.bizAfter = await C.business(biz.p, dir, '10-biz');
});
