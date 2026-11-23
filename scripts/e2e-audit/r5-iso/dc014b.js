require('./runner').run('INV-DC-014-deadline-respond', async ({ b, dir, res, BASE, U, session, C, db, step }) => {
  const inf = await session(b, U.infB);
  await inf.p.goto(BASE + '/collaboration/hub?view=collaborations'); await inf.p.waitForLoadState('networkidle');
  await C.shot(inf.p, dir, '1-hub');
  await inf.p.locator('button:has-text("Review")').first().click(); await inf.p.waitForTimeout(800);
  await C.shot(inf.p, dir, '2-invitation-popup');
  await Promise.all([inf.p.waitForNavigation().catch(() => {}), inf.p.click('button:has-text("Interested")')]);
  await inf.p.waitForLoadState('networkidle'); const t = await C.shot(inf.p, dir, '3-after-interested');
  res.url = inf.p.url(); res.message = (t.match(/[^\n]*(expired|no longer open|cannot)[^\n]*/i) || [null])[0];
  res.statusAfter = db(`select status from "MarketplaceApplication" where id='cmwqn84oz00zp7do5zjafig2u'`);
  res.afterAttempt = await C.influencer(inf.p, dir, '4-counts-after-attempt');
});
