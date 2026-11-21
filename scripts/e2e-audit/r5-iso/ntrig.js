const { execSync } = require('child_process');
const F = 'cmwqnkk1f00037dc25lwesptv', M1 = 'cmwqnkk1f00047dc2ivtdetzo', M2 = 'cmwqnkk1f00057dc2eg42s8g3';
const mails = () => JSON.parse(execSync('curl -s 127.0.0.1:8025/api/v1/messages').toString()).messages;
const notices = (db, email) => db(`select n.kind||' | '||n.title||' | read='||(n."readAt" is not null) from "AccountNotice" n join "User" u on u.id=n."userId" where u.email='${email}' and n."createdAt" > now() - interval '30 minutes' order by n."createdAt"`).split('\n').filter(Boolean);
async function dlgButtons(p) { return p.$$eval('button', bs => bs.filter(b => b.offsetParent && b.closest('[role=dialog],dialog,[aria-modal=true]')).map(b => b.innerText.trim()).filter(Boolean)); }
require('./runner').run('INV-N-0xxT-workroom', async ({ b, dir, res, BASE, U, session, C, db, step }) => {
  const inf = await session(b, U.infB); const biz = await session(b, U.bizA);
  const m0 = mails().length; const bizN0 = notices(db, U.bizA).length; const infN0 = notices(db, U.infB).length;
  res.bizBefore = await C.business(biz.p, dir, '00-biz-before');
  // ---- INV-N-013T: influencer submits (M1 and M2) -> business notified
  const RESUME = db(`select status from "FundingMilestone" where id='${M1}'`) !== 'pending'; if (RESUME) step('resume: M1/M2 v1 already submitted in attempt 1 (evidence in _attempts)');
  for (const [m, tag] of (RESUME ? [] : [[M1, 'm1'], [M2, 'm2']])) {
    await inf.p.goto(`${BASE}/collaboration/work/${F}?tab=milestones&focus=${m}&intent=submit`); await inf.p.waitForLoadState('networkidle');
    await inf.p.fill('[data-account-dialog-root] input[name=linkUrl]', `https://example.com/audit-r5-${tag}-v1`); await inf.p.fill('[data-account-dialog-root] textarea[name=note]', `AUDIT r5 ${tag} version 1`);
    await Promise.all([inf.p.waitForNavigation().catch(() => {}), inf.p.click('[data-account-dialog-root] button[type=submit]')]); await inf.p.waitForLoadState('networkidle');
    await C.shot(inf.p, dir, `01-inf-after-submit-${tag}`); step(`influencer submitted ${tag} v1 via workroom dialog; url ${inf.p.url()}`);
  }
  res.dbAfterSubmit = db(`select title||':'||status from "FundingMilestone" where "fundingId"='${F}' order by "sortOrder"`);
  res.n013 = { bizNotices: notices(db, U.bizA).slice(bizN0), mail: mails().slice(m0).map(x => x.to.join() + ' :: ' + x.subject) };
  res.bizAfterSubmit = await C.business(biz.p, dir, '02-biz-after-submit');
  await biz.p.goto(BASE + '/collaboration/inbox'); await biz.p.waitForLoadState('networkidle'); let t = await C.shot(biz.p, dir, '03-biz-inbox-two-milestones');
  res.bizInbox = { openTasks: (t.match(/(\d+) open tasks?/i) || [])[1], m1Rows: (t.match(/Milestone 1/g) || []).length, m2Rows: (t.match(/Milestone 2/g) || []).length };
  // ---- INV-N-015T: business requests revision on M1 -> influencer notified
  const m1 = mails().length; const infN1 = notices(db, U.infB).length;
  await biz.p.goto(`${BASE}/collaboration/work/${F}?tab=milestones&focus=${M1}&intent=review&version=1`); await biz.p.waitForLoadState('networkidle');
  await C.shot(biz.p, dir, '04-biz-review-dialog'); res.reviewButtons = await biz.p.$$eval('a,button', bs => bs.filter(b => b.offsetParent).map(b => b.innerText.trim()).filter(t => /request|approve/i.test(t)));
  await biz.p.getByText(/^Request changes/).first().click(); await biz.p.waitForTimeout(600);
  await C.shot(biz.p, dir, '05-biz-request-changes-step'); res.reviseFields = await biz.p.$$eval('[data-account-dialog-root] textarea, [data-account-dialog-root] input:not([type=hidden])', es => es.map(e => e.name));
  const ta = biz.p.locator('[data-account-dialog-root] textarea').first(); if (await ta.count()) await ta.fill('AUDIT r5: please add captions to milestone 1.');
  const send = biz.p.locator('[data-account-dialog-root] button[type=submit]').filter({ hasText: /request|send|changes/i });
  res.reviseSubmitText = await send.first().innerText().catch(() => null);
  await Promise.all([biz.p.waitForNavigation().catch(() => {}), send.first().click()]); await biz.p.waitForLoadState('networkidle');
  await C.shot(biz.p, dir, '06-biz-after-request-changes'); step('business requested changes on M1; url ' + biz.p.url());
  res.dbAfterRevise = db(`select title||':'||status from "FundingMilestone" where "fundingId"='${F}' order by "sortOrder"`);
  res.n015 = { infNotices: notices(db, U.infB).slice(infN1), mail: mails().slice(m1).map(x => x.to.join() + ' :: ' + x.subject) };
  res.infAfterRevise = await C.influencer(inf.p, dir, '07-inf-after-revise');
  // ---- resubmit M1 v2 then INV-N-016T: business approves -> influencer notified
  await inf.p.goto(`${BASE}/collaboration/work/${F}?tab=milestones&focus=${M1}&intent=submit`); await inf.p.waitForLoadState('networkidle');
  await inf.p.fill('input[name=linkUrl]:visible', 'https://example.com/audit-r5-m1-v2'); await inf.p.fill('textarea[name=note]:visible', 'AUDIT r5 m1 v2 with captions');
  await Promise.all([inf.p.waitForNavigation().catch(() => {}), inf.p.click('button[type=submit]:visible >> text=/Submit version/')]); await inf.p.waitForLoadState('networkidle');
  await C.shot(inf.p, dir, '08-inf-after-resubmit'); step('influencer resubmitted M1 v2');
  const m2 = mails().length; const infN2 = notices(db, U.infB).length;
  await biz.p.goto(`${BASE}/collaboration/work/${F}?tab=milestones&focus=${M1}&intent=review&version=2`); await biz.p.waitForLoadState('networkidle');
  await C.shot(biz.p, dir, '09-biz-review-v2'); res.reviewButtonsV2 = await dlgButtons(biz.p);
  await biz.p.getByText(/^Approve version/).first().click(); await biz.p.waitForTimeout(600);
  await C.shot(biz.p, dir, '10-biz-approve-confirm'); res.approveButtons = await dlgButtons(biz.p);
  res.approveButtons = await biz.p.$$eval('button', bs => bs.filter(b => b.offsetParent).map(b => b.innerText.trim()).filter(t => /approve|confirm/i.test(t)));
  const conf = biz.p.locator('button[type=submit]:visible').filter({ hasText: /approve|confirm/i });
  await Promise.all([biz.p.waitForNavigation().catch(() => {}), conf.last().click()]); await biz.p.waitForLoadState('networkidle');
  await C.shot(biz.p, dir, '11-biz-after-approve'); step('business approved M1 v2; url ' + biz.p.url());
  res.dbAfterApprove = db(`select title||':'||status from "FundingMilestone" where "fundingId"='${F}' order by "sortOrder"`);
  res.n016 = { infNotices: notices(db, U.infB).slice(infN2), mail: mails().slice(m2).map(x => x.to.join() + ' :: ' + x.subject) };
  res.bizFinal = await C.business(biz.p, dir, '12-biz-final');
  await biz.p.goto(BASE + '/collaboration/inbox'); await biz.p.waitForLoadState('networkidle'); t = await C.shot(biz.p, dir, '13-biz-inbox-final');
  res.bizInboxFinal = (t.match(/(\d+) open tasks?/i) || [])[1];
  await biz.p.goto(BASE + '/notifications'); await biz.p.waitForLoadState('networkidle'); t = await C.shot(biz.p, dir, '14-biz-notifications');
  res.bizNotificationCentre = (t.match(/All \(\d+\)[^\n]*\n[^\n]*\n[^\n]*/) || [''])[0].replace(/\n/g, ' | ');
});
