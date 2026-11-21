// INV-DC-015 retest on the isolated host: pending team invite shows respond controls and never "No further action needed".
const fs = require('fs'); const path = require('path');
const { chromium, BASE, U, session } = require('./lib'); const q = require('./db');
const [ID, NAME, EV] = process.argv.slice(2); fs.mkdirSync(EV, { recursive: true });
const res = []; const rec = (id, ok, d) => { res.push({ id, ok, d }); console.log(`${ok ? 'PASS' : 'FAIL'} ${id} · ${d}`); };
(async () => {
  const b = await chromium.launch();
  for (const mobile of [false, true]) {
    const s = await session(b, U.infA, mobile); const tag = mobile ? 'mobile' : 'desktop';
    await s.p.goto(`${BASE}/collaboration/team/${ID}`);
    const t = await s.p.locator('main').innerText();
    const btns = (await s.p.locator('main button').allInnerTexts()).map((x) => x.trim());
    rec(`T1 ${tag} pending: respond controls, no dead end`, btns.includes('Accept invitation') && btns.includes('Decline') && !t.includes('No further action needed'), btns.join(' · '));
    await s.p.screenshot({ path: path.join(EV, `team-pending-${tag}.png`), fullPage: true });
    await s.p.goto(`${BASE}/creator`);
    rec(`T2 ${tag} home attention lists the pending team invite`, (await s.p.locator('main').innerText()).includes(NAME), 'home');
    await s.ctx.close();
  }
  const s = await session(b, U.infA);
  await s.p.goto(`${BASE}/collaboration/team/${ID}`);
  await Promise.all([s.p.waitForLoadState('load'), s.p.getByRole('button', { name: 'Accept invitation' }).click()]);
  await s.p.waitForTimeout(1500); await s.p.goto(`${BASE}/collaboration/team/${ID}`);
  const t2 = await s.p.locator('main').innerText();
  const m = q(`select status from "TeamProposalMember" where "proposalId"='${ID}' and "creatorSlug"='audit-r5iso01-a'`);
  rec('T3 accept persists; page shows accepted, no respond controls, no contradiction', m === 'accepted' && t2.includes('You accepted') && !t2.includes('No further action needed') && !(await s.p.locator('main button', { hasText: 'Accept invitation' }).count()), `member=${m}`);
  await s.p.screenshot({ path: path.join(EV, 'team-accepted-desktop.png'), fullPage: true });
  await s.p.goto(`${BASE}/creator`);
  rec('T4 attention clears after accept', !(await s.p.locator('main').innerText()).includes(NAME), 'home');
  fs.writeFileSync(path.join(EV, 'team-results.json'), JSON.stringify({ id: ID, res }, null, 2));
  await b.close();
})().catch((e) => { console.error(e); process.exit(1); });
