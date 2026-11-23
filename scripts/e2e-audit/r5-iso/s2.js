// S2 retest: invitation lifecycle (P1-AUD-01..05). Withdrawal (with reason / from detail), deadline expiry
// (projection + sweep), notices and emails, team invitations in hub/inbox, closed team proposals. Isolated host only.
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { chromium, BASE, U, session } = require('./lib');
const q = require('./db');
const IDS = JSON.parse(process.argv[2]);
const STAMP = process.argv[3];
const EV = process.argv[4];
const MAILFILE = process.argv[5];
const REPO = '/home/user/Influrios';
fs.mkdirSync(EV, { recursive: true });
const results = [];
const rec = (id, ok, detail) => { results.push({ id, ok, detail }); console.log(`${ok ? 'PASS' : 'FAIL'} ${id} · ${detail}`); };
const name = (k) => `${k} ${STAMP}`;
const shot = (p, n) => p.screenshot({ path: path.join(EV, n + '.png'), fullPage: true });
const status = (id) => q(`select status||'|'||turn from "MarketplaceApplication" where id='${id}'`);
const mails = () => { try { return JSON.parse(fs.readFileSync(MAILFILE, 'utf8')); } catch { return []; } };
const tsx = (...args) => execFileSync('npx', ['tsx', ...args], { cwd: REPO }).toString().trim().split('\n').pop();

async function badge(p) {
  const t = (await p.locator('aside nav a', { hasText: 'Collaborations' }).first().innerText()).replace('Collaborations', '').trim();
  return Number(t || 0);
}
async function surfaces(p) {
  await p.goto(BASE + '/creator'); const home = await p.locator('main').innerText(); const b = await badge(p);
  await p.goto(BASE + '/collaboration/inbox'); const inbox = (await p.locator('main').innerText()).split('\nNotifications\n')[0];
  await p.goto(BASE + '/collaboration/hub?view=collaborations&tab=invitations'); const hub = await p.locator('main').innerText();
  return { home, inbox, hub, badge: b };
}
async function centre(p) {
  await p.goto(BASE + '/creator/notifications');
  const actionLabel = await p.locator('main a', { hasText: /^Action required/ }).first().innerText();
  const rows = await p.locator('main ul li').evaluateAll((lis) => lis.map((li) => ({
    text: li.innerText, amber: !!li.querySelector('.bg-amber-50'), unread: /\bUnread\b/.test(li.innerText),
  })));
  return { action: Number((actionLabel.match(/\((\d+)\)/) || [])[1] || 0), rows };
}
const rowFor = (c, re) => c.rows.filter((r) => re.test(r.text));

(async () => {
  const browser = await chromium.launch();
  const inf = await session(browser, U.infA);
  const biz = await session(browser, U.bizA);
  const W1 = IDS['S2-W1 Withdraw with reason'], W2 = IDS['S2-W2 Withdraw from detail'], E1 = IDS['S2-E1 Expire at deadline'];
  const T1 = IDS['S2-T1 Team decline closes'], T2 = IDS['S2-T2 Team listing'];
  const mail0 = mails().length;

  // Baseline (home load also records the invitation notices).
  const s0 = await surfaces(inf.p);
  const keys = ['S2-W1 Withdraw with reason', 'S2-W2 Withdraw from detail', 'S2-E1 Expire at deadline', 'S2-T1 Team decline closes', 'S2-T2 Team listing'];
  rec('B0 all five waiting on home, inbox and hub', keys.every((k) => s0.home.includes(name(k)) && s0.inbox.includes(name(k)) && s0.hub.includes(name(k))),
    `badge ${s0.badge} · missing ${keys.filter((k) => !(s0.home.includes(name(k)) && s0.inbox.includes(name(k)) && s0.hub.includes(name(k)))).join(', ') || 'none'}`);
  await shot(inf.p, 'b0-hub-desktop');
  const c0 = await centre(inf.p);
  const w1Notice0 = rowFor(c0, new RegExp(name('S2-W1 Withdraw with reason')));
  rec('B1 invitation notices are Action required before anything changes', w1Notice0.length === 1 && w1Notice0[0].amber, `centre action ${c0.action}`);

  // ---- W1: business withdraws with a reason (request page dialog).
  const brief = IDS['S2-W1 Withdraw with reason:brief'];
  await biz.p.goto(`${BASE}/collaboration/business?tab=requests&request=${brief}&panel=invitations&withdraw=${W1}`);
  await biz.p.locator('select[name="reason"]').selectOption('Schedule changed');
  await biz.p.locator('textarea[name="message"]').fill('We moved the shoot to spring and will invite you again.');
  await shot(biz.p, 'w1-business-withdraw-dialog');
  await Promise.all([biz.p.waitForURL(/saved=withdrawn|error=/), biz.p.getByRole('button', { name: 'Withdraw & notify' }).click()]);
  rec('W1.1 withdrawal persisted, turn none', status(W1) === 'WITHDRAWN|none', status(W1));
  const s1 = await surfaces(inf.p);
  rec('W1.2 counts clear together (home, inbox, hub, badge)', !s1.home.includes(name('S2-W1 Withdraw with reason')) && !s1.inbox.includes(name('S2-W1 Withdraw with reason')) && !s1.hub.includes(name('S2-W1 Withdraw with reason')) && s1.badge === s0.badge - 1, `badge ${s0.badge}→${s1.badge}`);
  const c1 = await centre(inf.p);
  const orig = rowFor(c1, new RegExp(`^(?![\\s\\S]*withdrew)[\\s\\S]*${name('S2-W1 Withdraw with reason')}`));
  const wNotice = rowFor(c1, /withdrew an invitation/).filter((r) => r.text.includes(name('S2-W1 Withdraw with reason')));
  rec('W1.3 original notice kept in history, no longer Action required, read state unchanged', orig.length === 1 && !orig[0].amber && orig[0].unread === w1Notice0[0].unread && c1.action === c0.action - 1, `action ${c0.action}→${c1.action}`);
  rec("W1.4 in-app withdrawal notice names the business, with recorded reason, not Action required", wNotice.length === 1 && !/The business withdrew/.test(wNotice[0].text) && /Reason given: Schedule changed/.test(wNotice[0].text) && !wNotice[0].amber, wNotice[0] ? wNotice[0].text.replace(/\s+/g, ' ').slice(0, 160) : 'missing');
  await shot(inf.p, 'w1-centre-after');
  const newMail = mails().slice(mail0).filter((m) => m.to.join(',').includes(U.infA));
  const wMail = newMail.filter((m) => /withdrew an invitation/.test(m.subject));
  rec('W1.5 withdrawal email (invite.withdrawn) with reason; no invitation template', wMail.length === 1 && /Reason given: Schedule changed/.test(wMail[0].raw) && !newMail.some((m) => /invited you|Private invitation/.test(m.subject)), newMail.map((m) => m.subject).join(' | '));
  await inf.p.goto(`${BASE}/collaboration/applications/${W1}`);
  const w1Page = await inf.p.locator('main').innerText();
  rec('W1.6 withdrawn panel shows reason and message, no actions', /Withdrawn/.test(w1Page) && /Reason given:\s*“Schedule changed”/.test(w1Page) && w1Page.includes('We moved the shoot to spring') && !(await inf.p.locator('main [data-invitation-case] form button').count()), 'detail page');
  await shot(inf.p, 'w1-withdrawn-panel');

  // ---- W2: business withdraws from the detail page (no reason recorded).
  const mail1 = mails().length;
  await biz.p.goto(`${BASE}/collaboration/applications/${W2}`);
  await Promise.all([biz.p.waitForURL(/app=WITHDRAWN|error=/), biz.p.locator('main').getByRole('button', { name: 'Withdraw' }).click()]);
  rec('W2.1 withdrawal persisted', status(W2) === 'WITHDRAWN|none', status(W2));
  const w2Mail = mails().slice(mail1).filter((m) => /withdrew an invitation/.test(m.subject) && m.to.join(',').includes(U.infA));
  rec('W2.2 email sent without an invented reason', w2Mail.length === 1 && !/Reason given/.test(w2Mail[0].raw), w2Mail.length ? 'no reason line' : 'missing');
  await inf.p.goto(`${BASE}/collaboration/applications/${W2}`);
  const w2Page = await inf.p.locator('main').innerText();
  rec('W2.3 panel omits the reason line', /Withdrawn/.test(w2Page) && !/Reason given/.test(w2Page) && /Nothing was signed or funded/.test(w2Page), 'detail page');

  // ---- E1: Respond-by date passes. Projections first (before the sweep), then the real sweep.
  const fx = tsx('scripts/e2e-audit/r5-iso/s2-sweep.ts', 'past', E1);
  const s2 = await surfaces(inf.p);
  rec('E1.1 past deadline leaves every count before the sweep runs', status(E1).startsWith('VIEWED') || status(E1).startsWith('REQUESTED') ? (!s2.home.includes(name('S2-E1 Expire at deadline')) && !s2.inbox.includes(name('S2-E1 Expire at deadline')) && !s2.hub.includes(name('S2-E1 Expire at deadline')) && s2.badge === s1.badge - 2) : false, `${status(E1)} · badge ${s1.badge}→${s2.badge} · ${fx}`);
  await inf.p.goto(`${BASE}/collaboration/applications/${E1}`);
  const e1Page = await inf.p.locator('main').innerText();
  rec('E1.2 detail shows Expired, no reply actions', /Expired/.test(e1Page) && !(await inf.p.locator('main [data-invitation-case] form button').count()), 'detail page');
  const c2 = await centre(inf.p);
  const e1n = rowFor(c2, new RegExp(name('S2-E1 Expire at deadline')));
  rec('E1.3 its notice leaves Action required immediately', e1n.length >= 1 && e1n.every((r) => !r.amber), `action ${c2.action}`);
  const mail2 = mails().length;
  const sweep = tsx('scripts/e2e-audit/r5-iso/s2-sweep.ts', 'sweep');
  rec('E1.4 sweep persists EXPIRED at the deadline', status(E1) === 'EXPIRED|none', `${status(E1)} · ${sweep}`);
  const eMail = mails().slice(mail2).filter((m) => /expired/i.test(m.subject) && m.to.join(',').includes(U.infA));
  const c3 = await centre(inf.p);
  const eNotice = rowFor(c3, /expired/i).filter((r) => r.text.includes(name('S2-E1 Expire at deadline')));
  rec('E1.5 expiry notice + invite.expired email', eMail.length === 1 && eNotice.length === 1 && !eNotice[0].amber, `${eMail.map((m) => m.subject).join(' | ')}`);

  // ---- Team: listed in hub and inbox (P1-AUD-04), accept → waiting for teammates, closure for everyone (P1-AUD-05).
  rec('T.1 pending team invitations listed in hub and inbox', s0.hub.includes(name('S2-T2 Team listing')) && s0.inbox.includes(name('S2-T2 Team listing')), 'baseline');
  await inf.p.goto(`${BASE}/collaboration/team/${T2}`);
  await inf.p.getByRole('button', { name: 'Accept invitation' }).click(); await inf.p.waitForTimeout(1500);
  const s3 = await surfaces(inf.p);
  rec('T.2 after accept: hub shows "You accepted · Waiting for teammates"; inbox and home drop it', /Team invitation · You accepted[\s\S]{0,200}/.test(s3.hub) && s3.hub.includes(name('S2-T2 Team listing')) && !s3.inbox.includes(name('S2-T2 Team listing')) && !s3.home.includes(name('S2-T2 Team listing')) && s3.badge === s2.badge - 1, `badge ${s2.badge}→${s3.badge}`);
  await shot(inf.p, 't2-hub-accepted');
  const infB = await session(browser, U.infB);
  for (const id of [T1, T2]) {
    await infB.p.goto(`${BASE}/collaboration/team/${id}`);
    await infB.p.getByRole('button', { name: 'Decline' }).click(); await infB.p.waitForTimeout(1500);
  }
  rec('T.3 teammate decline closes both proposals', q(`select string_agg(status, ',' order by id) from "TeamProposal" where id in ('${T1}','${T2}')`) === 'declined,declined', 'db');
  await inf.p.goto(`${BASE}/collaboration/team/${T1}`);
  const t1 = await inf.p.locator('main').innerText();
  rec('T.4 still-invited member sees "This invitation is closed", no respond controls', /This invitation is closed/.test(t1) && !(await inf.p.locator('main button', { hasText: 'Accept invitation' }).count()), 'T1');
  await shot(inf.p, 't1-closed-invited');
  await inf.p.goto(`${BASE}/collaboration/team/${T2}`);
  const t2 = await inf.p.locator('main').innerText();
  rec('T.5 accepted member sees closed-after-you-accepted, not "waiting for teammates"', /This invitation is closed/.test(t2) && /after you accepted/.test(t2) && !/after every teammate accepts/.test(t2), 'T2');
  await shot(inf.p, 't2-closed-after-accept');
  const s4 = await surfaces(inf.p);
  rec('T.6 closed proposals leave hub, inbox, home and badge', !s4.hub.includes(name('S2-T1 Team decline closes')) && !s4.hub.includes(name('S2-T2 Team listing')) && !s4.inbox.includes(name('S2-T1 Team decline closes')) && !s4.home.includes(name('S2-T1 Team decline closes')) && s4.badge === s3.badge - 1, `badge ${s3.badge}→${s4.badge}`);
  const c4 = await centre(inf.p);
  const tn = rowFor(c4, new RegExp(name('S2-T1 Team decline closes')));
  rec('T.7 team notice stays in history, not Action required', tn.length >= 1 && tn.every((r) => !r.amber), `action ${c4.action}`);

  // ---- Mobile 390 and the S1 signed-out regression check.
  const mob = await session(browser, U.infA, true);
  await mob.p.goto(BASE + '/collaboration/hub?view=collaborations&tab=invitations');
  const mt = await mob.p.locator('main').innerText();
  rec('M.1 mobile hub agrees (no withdrawn/expired/closed rows)', !keys.some((k) => mt.includes(name(k))), 'all five gone at 390');
  await mob.p.goto(`${BASE}/collaboration/applications/${W1}`);
  rec('M.2 mobile withdrawn panel shows reason', /Reason given:\s*“Schedule changed”/.test(await mob.p.locator('main').innerText()), '390');
  await shot(mob.p, 'm2-mobile-withdrawn');
  const anon = await (await browser.newContext()).newPage();
  await anon.goto(`${BASE}/collaboration/applications/${W1}`);
  rec('R.1 signed-out item link → login with the exact item (S1 layout fix)', decodeURIComponent(anon.url()).includes(`next=/collaboration/applications/${W1}`), anon.url());

  fs.writeFileSync(path.join(EV, 'results.json'), JSON.stringify({ stamp: STAMP, ids: IDS, results }, null, 2));
  const fails = results.filter((x) => !x.ok).length;
  console.log(`\n${results.length - fails}/${results.length} pass`);
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
