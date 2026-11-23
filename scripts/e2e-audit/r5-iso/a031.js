const { execSync } = require('child_process');
const cron = () => execSync(`curl -s -X POST -H "Authorization: Bearer ${process.env.CRON_SECRET}" http://127.0.0.1:3000/api/cron/sweeps`).toString();
const adminCounts = t => ({ funnel: (t.match(/(Sent|Opened|Declined|Claimed|Published|Expired|Queued)[^\n]{0,4}\n?\s*\d+/gi) || []).slice(0, 12) });
require('./runner').run('INV-A-031', async ({ b, dir, res, BASE, U, session, C, db, step }) => {
  const a = await (await b.newContext({ viewport: { width: 1440, height: 1000 } })).newPage();
  await a.goto(BASE + '/admin/login'); await a.fill('input[name=email]', 'audit.admin@example.com'); await a.fill('input[name=password]', 'AuditLocalPass!2026');
  await Promise.all([a.waitForNavigation().catch(() => {}), a.click('button[type=submit]')]);
  await a.goto(BASE + '/admin/invitations'); await a.waitForLoadState('networkidle'); let t = await C.shot(a, dir, '1-admin-before');
  res.adminBefore = adminCounts(t); res.dbBefore = db(`select status, count(*) from "CreatorInvitation" group by 1`);
  const slugOpt = await a.$$eval('select[name=slug] option', os => os.map(o => o.value));
  res.unclaimedInPicker = slugOpt.includes('audit-r5iso01-unclaimed');
  await a.selectOption('select[name=slug]', 'audit-r5iso01-unclaimed'); await a.fill('input[name=email]', 'audit.r5iso01.invitee@example.com');
  if (db(`select count(*) from "CreatorInvitation" where "creatorSlug"='audit-r5iso01-unclaimed'`) === '0') await Promise.all([a.waitForNavigation().catch(() => {}), a.click('button:has-text("Queue invitation")')]);
  await a.waitForLoadState('networkidle'); t = await C.shot(a, dir, '2-admin-after-create'); step('admin queued invitation via UI; landed ' + a.url());
  const inv = db(`select token||'|'||status from "CreatorInvitation" where "creatorSlug"='audit-r5iso01-unclaimed' order by "createdAt" desc limit 1`).split('|');
  res.reusedFromAttempt1 = true;
  res.statusCreated = inv[1];
  if (inv[1] === 'queued') {
    await a.click('text=Expand'); await a.waitForTimeout(400); await C.shot(a, dir, '2b-admin-row-expanded');
    res.sendEnabled = await a.locator('button:has-text("Send email")').first().isEnabled();
    if (res.sendEnabled) { await Promise.all([a.waitForNavigation().catch(() => {}), a.locator('button:has-text("Send email")').first().click()]); step('admin clicked Send email'); }
    res.cron = cron(); step('processed due jobs via /api/cron/sweeps'); await new Promise(r => setTimeout(r, 1500));
  }
  res.statusAfterJob = db(`select status from "CreatorInvitation" where token='${inv[0]}'`);
  res.mail = JSON.parse(execSync('curl -s 127.0.0.1:8025/api/v1/messages').toString()).messages.filter(m => /invitee/.test(m.to.join())).map(m => m.subject);
  const g = await (await b.newContext({ viewport: { width: 1440, height: 1000 } })).newPage();
  await g.goto(BASE + '/invite/' + inv[0]); await g.waitForLoadState('networkidle'); await C.shot(g, dir, '3-token-page');
  res.statusAfterOpen = db(`select status from "CreatorInvitation" where token='${inv[0]}'`);
  await Promise.all([g.waitForNavigation().catch(() => {}), g.click('button:has-text("This isn\'t my profile")')]);
  await g.waitForLoadState('networkidle'); t = await C.shot(g, dir, '4-after-decline'); step('invitee clicked Decline on token page; landed ' + g.url());
  res.declinedCopy = /was declined/i.test(t);
  await g.reload(); await g.waitForLoadState('networkidle'); t = await C.shot(g, dir, '5-after-reload');
  res.declinedCopyAfterReload = /was declined/i.test(t);
  res.statusAfter = db(`select status from "CreatorInvitation" where token='${inv[0]}'`);
  res.events = db(`select e.kind||'/'||e.actor from "InvitationEvent" e join "CreatorInvitation" i on i.id=e."invitationId" where i.token='${inv[0]}' order by e."createdAt"`);
  await a.goto(BASE + '/admin/invitations'); await a.waitForLoadState('networkidle'); t = await C.shot(a, dir, '6-admin-after-decline');
  res.adminAfter = adminCounts(t); res.dbAfter = db(`select status, count(*) from "CreatorInvitation" group by 1`);
  const m = await (await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true })).newPage();
  await m.goto(BASE + '/invite/' + inv[0]); await m.waitForLoadState('networkidle'); t = await C.shot(m, dir, '7-token-mobile');
  res.mobileDeclined = /was declined/i.test(t); res.mobileDeclineButtonShown = await m.locator('button:has-text("my profile")').count();
});
