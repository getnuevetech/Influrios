const { execSync } = require('child_process');
const F = 'cmwqnkk1f00037dc25lwesptv', M2 = 'cmwqnkk1f00057dc2eg42s8g3';
const cron = () => execSync(`curl -s -X POST -H "Authorization: Bearer ${process.env.CRON_SECRET}" http://127.0.0.1:3000/api/cron/sweeps`).toString();
const mails = () => JSON.parse(execSync('curl -s 127.0.0.1:8025/api/v1/messages').toString()).messages;
require('./runner').run('INV-J-010', async ({ b, dir, res, BASE, U, session, C, db, step }) => {
  step('collection-only pass: sweep already ran in attempt 2 (see _attempts/INV-J-010-attempt2); no new sweep');
  const m0 = 0;
  res.m2 = db(`select status||' approvedAt='||coalesce("approvedAt"::text,'') from "FundingMilestone" where id='${M2}'`);
  res.autoApprovedLogs = db(`select count(*) from "AuditLog" where action='milestone_auto_approved' and "objectId"='${M2}'`);
  res.jobRows = db(`select kind||':'||status||':'||"attempts" from "Job" where kind='milestone_auto_approval' order by "createdAt" desc limit 3`);
  // INV-N-017T: notices emitted by the sweep
  res.n017mail = mails().filter(x => /approv/i.test(x.subject)).map(x => x.created.slice(11,19) + ' ' + x.to.join() + ' :: ' + x.subject);
  const inf = await session(b, U.infB); const biz = await session(b, U.bizA);
  await inf.p.goto(BASE + '/creator/notifications'); await inf.p.waitForLoadState('networkidle'); let t = await C.shot(inf.p, dir, '3-inf-notifications');
  res.infCentre = (t.match(/All \(\d+\)[^\n]*\n[^\n]*\n[^\n]*\n[^\n]*\n[^\n]*/) || [''])[0].replace(/\n/g, ' | '); res.infCentreMentionsAuto = /auto|approved/i.test(t);
  await biz.p.goto(BASE + '/notifications'); await biz.p.waitForLoadState('networkidle'); t = await C.shot(biz.p, dir, '4-biz-notifications');
  res.bizCentre = (t.match(/All \(\d+\)[^\n]*\n[^\n]*\n[^\n]*\n[^\n]*\n[^\n]*/) || [''])[0].replace(/\n/g, ' | '); res.bizCentreMentionsAuto = /auto|approved/i.test(t);
  res.biz = await C.business(biz.p, dir, '5-biz-home');
  await biz.p.goto(BASE + '/collaboration/inbox'); await biz.p.waitForLoadState('networkidle'); t = await C.shot(biz.p, dir, '6-biz-inbox');
  res.bizInbox = (t.match(/(\d+) open tasks?/i) || [])[1];
  await biz.p.goto(`${BASE}/collaboration/work/${F}?tab=milestones`); await biz.p.waitForLoadState('networkidle'); await C.shot(biz.p, dir, '7-biz-workroom');
});
