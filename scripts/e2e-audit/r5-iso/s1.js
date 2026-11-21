// S1 retest: invitation turn tracking + §2.2b action matrix. Popup and direct route, persistence,
// permissions (server-side), cross-screen counts on desktop + mobile. Isolated host only.
const fs = require('fs');
const path = require('path');
const { chromium, BASE, U, session } = require('./lib');
const q = require('./db');
const IDS = JSON.parse(process.argv[2]);
const STAMP = process.argv[3];
const EV = process.argv[4];
fs.mkdirSync(EV, { recursive: true });
const results = [];
function rec(id, ok, detail) { results.push({ id, ok, detail }); console.log(`${ok ? 'PASS' : 'FAIL'} ${id} · ${detail}`); }
const brand = (k) => `${k} ${STAMP}`;
const row = (id) => {
  const [status, turn, interest, open] = q(`select status, turn, "interestRecorded", "openQuestion" from "MarketplaceApplication" where id='${id}'`).split('|');
  return { status, turn, interest: interest === 't', open: open === 't' };
};
const shot = (p, name) => p.screenshot({ path: path.join(EV, name + '.png'), fullPage: false });

async function badge(p) {
  const a = p.locator('aside nav a', { hasText: 'Collaborations' }).first();
  const t = (await a.innerText()).replace('Collaborations', '').trim();
  return Number(t || 0);
}
async function surfaces(p, keys) {
  // Which of our invitations count as "waiting for your reply" on each surface.
  await p.goto(BASE + '/creator'); const home = await p.locator('main').innerText();
  const b = await badge(p);
  await p.goto(BASE + '/collaboration/inbox'); const inboxAll = await p.locator('main').innerText();
  // Task list only: the page also shows notification history below "Notifications".
  const inbox = inboxAll.split('\nNotifications\n')[0];
  await p.goto(BASE + '/collaboration/hub?view=collaborations&tab=invitations'); const hubText = await p.locator('main').innerText();
  const tab = await p.locator('main a', { hasText: /^Invitations/ }).first().innerText().catch(() => '');
  const out = {};
  for (const k of keys) out[k] = { home: home.includes(brand(k)), inbox: inbox.includes(brand(k)), hubListed: hubText.includes(brand(k)) };
  return { out, badge: b, tab: tab.replace(/\s+/g, ' ').trim() };
}
async function openPopup(p, k) {
  await p.goto(BASE + '/collaboration/hub?view=collaborations&tab=invitations');
  const li = p.locator('[data-invitation-row]', { hasText: brand(k) });
  await li.getByRole('button').click();
  return p.locator('[role="dialog"]');
}
async function caseOf(scope) { return scope.locator('[data-invitation-case]').getAttribute('data-invitation-case'); }
async function buttons(scope) {
  const names = await scope.locator('[data-invitation-case] button').allInnerTexts();
  return names.map((n) => n.trim()).filter(Boolean).sort().join(' · ');
}
async function cloneForm(fromPage, selector) { return fromPage.locator(selector).first().evaluate((f) => f.outerHTML); }
async function submitInjected(p, html, tweak) {
  await p.evaluate(({ html, tweak }) => {
    const box = document.createElement('div'); box.innerHTML = html; document.body.appendChild(box);
    const f = box.querySelector('form');
    for (const [k, v] of Object.entries(tweak || {})) { const el = f.querySelector(`[name="${k}"]`); if (el) el.value = v; }
    const ta = f.querySelector('textarea'); if (ta && !ta.value) ta.value = 'Injected text for permission check';
    f.submit();
  }, { html, tweak });
  await p.waitForEvent('framenavigated', { timeout: 15000 }).catch(() => {});
  await p.waitForLoadState('load').catch(() => {});
  await p.waitForTimeout(1500);
}

(async () => {
  const browser = await chromium.launch();
  const inf = await session(browser, U.infA);
  const biz = await session(browser, U.bizA);
  const M1 = IDS['S1-M1 Matrix walk'], M2 = IDS['S1-M2 Follow-up'], M3 = IDS['S1-M3 Decline'], M4 = IDS['S1-M4 Concurrent withdraw'], P1 = IDS['S1-P1 Other influencer'];
  const keys = ['S1-M1 Matrix walk', 'S1-M2 Follow-up', 'S1-M3 Decline', 'S1-M4 Concurrent withdraw'];

  // ---- Baseline: four new invitations, all case 1, all counted everywhere.
  const s0 = await surfaces(inf.p, keys);
  rec('C0 baseline counts', keys.every((k) => s0.out[k].home && s0.out[k].inbox && s0.out[k].hubListed), `badge ${s0.badge} · tab "${s0.tab}" · ${JSON.stringify(s0.out)}`);
  await shot(inf.p, 'c0-hub-desktop');

  // ---- M1 via the hub popup: case 1 → question → case 2.
  let dlg = await openPopup(inf.p, 'S1-M1 Matrix walk');
  rec('M1.1 popup case 1 actions', (await caseOf(dlg)) === '1' && (await buttons(dlg)) === "Ask a question · Decline · I'm interested", await buttons(dlg));
  await shot(inf.p, 'm1-1-popup-case1');
  await dlg.getByRole('button', { name: 'Ask a question' }).click();
  await dlg.locator('textarea[name="note"]').fill('Can the video go live in December?');
  await Promise.all([inf.p.waitForURL(/responded=question/), dlg.getByRole('button', { name: 'Send question' }).click()]);
  dlg = inf.p.locator('[role="dialog"]');
  let r = row(M1);
  rec('M1.2 question persisted (case 2)', r.status === 'NEGOTIATING' && r.turn === 'business' && r.open && !r.interest, JSON.stringify(r));
  rec('M1.3 popup reopens at case 2', (await caseOf(dlg)) === '2' && (await buttons(dlg)) === 'Decline', await buttons(dlg));
  await shot(inf.p, 'm1-3-popup-case2');
  const s1 = await surfaces(inf.p, keys);
  rec('M1.4 counts drop on every surface', !s1.out['S1-M1 Matrix walk'].home && !s1.out['S1-M1 Matrix walk'].inbox && s1.out['S1-M1 Matrix walk'].hubListed && s1.badge === s0.badge - 1,
    `badge ${s0.badge}→${s1.badge} · tab "${s1.tab}" · M1 ${JSON.stringify(s1.out['S1-M1 Matrix walk'])}`);

  // Persistence across reload and re-login.
  await inf.p.reload();
  const inf2 = await session(browser, U.infA);
  dlg = await openPopup(inf2.p, 'S1-M1 Matrix walk');
  rec('M1.5 persists after re-login', (await caseOf(dlg)) === '2', `case ${await caseOf(dlg)}`);
  await inf2.ctx.close();

  // Business: no Accept before interest; answers the question.
  await biz.p.goto(`${BASE}/collaboration/applications/${M1}`);
  const bizText = await biz.p.locator('main').innerText();
  const bizButtons = (await biz.p.locator('main form button').allInnerTexts()).map((t) => t.trim());
  rec('M1.6 business: answer form, no Accept before interest', bizText.includes('asked a question') && !bizButtons.includes('Accept') && bizButtons.includes('Send answer'), bizButtons.join(' · '));
  await shot(biz.p, 'm1-6-business-case2');
  const answerFormHtml = await cloneForm(biz.p, 'form:has(textarea[name="answer"])');
  await biz.p.locator('textarea[name="answer"]').fill('Yes, December works. Final cut by 15 Dec.');
  await Promise.all([biz.p.waitForURL(/answered=1/), biz.p.getByRole('button', { name: 'Send answer' }).click()]);
  r = row(M1);
  rec('M1.7 answer persisted: turn → invitee (case 3)', r.status === 'NEGOTIATING' && r.turn === 'invitee' && !r.open && !r.interest, JSON.stringify(r));

  const s2 = await surfaces(inf.p, keys);
  rec('M1.8 counts return on every surface', s2.out['S1-M1 Matrix walk'].home && s2.out['S1-M1 Matrix walk'].inbox && s2.badge === s0.badge, `badge ${s2.badge} · M1 ${JSON.stringify(s2.out['S1-M1 Matrix walk'])}`);
  await inf.p.goto(BASE + '/creator');
  rec('M1.9 home names the reply', (await inf.p.locator('main').innerText()).includes('replied'), 'home attention detail');

  // Popup and direct route agree on case 3 (P1-AUD-10); stale popup kept open in a second tab.
  dlg = await openPopup(inf.p, 'S1-M1 Matrix walk');
  const popupButtons = await buttons(dlg);
  const stale = await inf.ctx.newPage();
  const staleDlg = await openPopup(stale, 'S1-M1 Matrix walk');
  await inf.p.goto(`${BASE}/collaboration/applications/${M1}`);
  const direct = inf.p.locator('main');
  const directButtons = await buttons(direct);
  const allDirect = (await direct.locator('button').allInnerTexts()).map((t) => t.trim());
  rec('M1.10 popup = direct route (case 3)', (await caseOf(direct)) === '3' && popupButtons === directButtons && directButtons === "Ask another question · Decline · I'm interested", `popup [${popupButtons}] direct [${directButtons}]`);
  rec('M1.11 direct route never offers Accept/Withdraw to invitee', !allDirect.some((t) => /^(Accept|Withdraw)$/.test(t)), allDirect.join(' · '));
  await shot(inf.p, 'm1-10-direct-case3');
  await Promise.all([inf.p.waitForURL(/responded=interested/), direct.getByRole('button', { name: "I'm interested" }).click()]);
  r = row(M1);
  rec('M1.12 interest after a question (P1-D1: NEGOTIATING → RESPONDED)', r.status === 'RESPONDED' && r.turn === 'business' && r.interest, JSON.stringify(r));

  // Server enforcement: the stale popup still shows case 3; submitting is rejected and it refreshes.
  await Promise.all([stale.waitForURL(/error=/), staleDlg.getByRole('button', { name: "I'm interested" }).click()]);
  const staleText = await stale.locator('main').innerText();
  const events = Number(q(`select count(*) from "MarketplaceApplicationEvent" where "applicationId"='${M1}' and note='Interested'`));
  rec('M1.13 stale submission rejected, stored once', staleText.includes("isn't available") && events === 1 && (await caseOf(stale.locator('[role="dialog"]'))) === '4', `events=${events}`);
  await shot(stale, 'm1-13-stale-rejected');
  await stale.close();

  await biz.p.goto(`${BASE}/collaboration/applications/${M1}`);
  const bizB2 = (await biz.p.locator('main form button').allInnerTexts()).map((t) => t.trim());
  rec('M1.14 business can Accept only now', bizB2.includes('Accept') && bizB2.includes('Not a fit') && !bizB2.includes('Send answer'), bizB2.join(' · '));
  const acceptFormHtml = await cloneForm(biz.p, 'form:has(input[name="toStatus"][value="ACCEPTED"])');

  // ---- M2: interest then follow-up keeps the business's turn (cases 4 → 5 → 6).
  dlg = await openPopup(inf.p, 'S1-M2 Follow-up');
  await Promise.all([inf.p.waitForURL(/responded=interested/), dlg.getByRole('button', { name: "I'm interested" }).click()]);
  dlg = inf.p.locator('[role="dialog"]');
  rec('M2.1 case 4 actions', (await caseOf(dlg)) === '4' && (await buttons(dlg)) === 'Ask a follow-up question · Decline', await buttons(dlg));
  await dlg.getByRole('button', { name: 'Ask a follow-up question' }).click();
  await dlg.locator('textarea[name="note"]').fill('Can I use my own music in the video?');
  await Promise.all([inf.p.waitForURL(/responded=question/), dlg.getByRole('button', { name: 'Send question' }).click()]);
  dlg = inf.p.locator('[role="dialog"]');
  r = row(M2);
  rec('M2.2 follow-up: case 5, turn stays business', r.status === 'NEGOTIATING' && r.turn === 'business' && r.interest && r.open && (await caseOf(dlg)) === '5' && (await buttons(dlg)) === 'Decline', `${JSON.stringify(r)} [${await buttons(dlg)}]`);
  await biz.p.goto(`${BASE}/collaboration/applications/${M2}`);
  await biz.p.locator('textarea[name="answer"]').fill('Yes, licensed music is fine.');
  await Promise.all([biz.p.waitForURL(/answered=1/), biz.p.getByRole('button', { name: 'Send answer' }).click()]);
  r = row(M2);
  const s3 = await surfaces(inf.p, keys);
  rec('M2.3 answer after interest: case 6, no task returns', r.turn === 'business' && !r.open && !s3.out['S1-M2 Follow-up'].home && !s3.out['S1-M2 Follow-up'].inbox && s3.out['S1-M2 Follow-up'].hubListed,
    `${JSON.stringify(r)} · ${JSON.stringify(s3.out['S1-M2 Follow-up'])} · badge ${s3.badge}`);
  dlg = await openPopup(inf.p, 'S1-M2 Follow-up');
  rec('M2.4 case 6 actions', (await caseOf(dlg)) === '6' && (await buttons(dlg)) === 'Ask a follow-up question · Decline', await buttons(dlg));
  await shot(inf.p, 'm2-4-popup-case6');

  // ---- M3: decline on the direct route.
  await inf.p.goto(`${BASE}/collaboration/applications/${M3}`);
  rec('M3.1 direct route case 1 matches popup', (await buttons(inf.p.locator('main'))) === "Ask a question · Decline · I'm interested", await buttons(inf.p.locator('main')));
  await Promise.all([inf.p.waitForURL(/responded=decline/), inf.p.locator('main').getByRole('button', { name: 'Decline' }).click()]);
  r = row(M3);
  rec('M3.2 decline closes, turn none', r.status === 'DECLINED' && r.turn === 'none', JSON.stringify(r));

  // ---- M4: concurrent withdrawal while the popup is open.
  dlg = await openPopup(inf.p, 'S1-M4 Concurrent withdraw');
  await biz.p.goto(`${BASE}/collaboration/applications/${M4}`);
  await Promise.all([biz.p.waitForURL(/app=WITHDRAWN/), biz.p.locator('main').getByRole('button', { name: 'Withdraw' }).click()]);
  await Promise.all([inf.p.waitForURL(/error=/), dlg.getByRole('button', { name: "I'm interested" }).click()]);
  r = row(M4);
  const hubAfter = await inf.p.locator('main').innerText();
  rec('M4.1 reply after withdrawal rejected, not overwritten', r.status === 'WITHDRAWN' && r.turn === 'none' && hubAfter.includes("isn't available") && !hubAfter.includes(brand('S1-M4 Concurrent withdraw')), JSON.stringify(r));

  // ---- Permissions (server-side, by submitting real forms outside their page).
  await inf.p.goto(`${BASE}/collaboration/applications/${P1}`);
  rec('P.1 other influencer\'s invitation not viewable', !inf.p.url().includes(P1) && (await inf.p.locator('main').innerText()).includes('cannot view'), inf.p.url());
  // The popup's forms are React-bound, so tamper with the real rendered form and submit it.
  async function tamperedDecline(p, targetId) {
    const d = await openPopup(p, 'S1-M2 Follow-up');
    const f = d.locator('form:has(input[name="intent"][value="decline"])');
    await f.locator('input[name="applicationId"]').evaluate((el, v) => { el.value = v; }, targetId);
    return f;
  }
  const before = row(P1);
  const tf = await tamperedDecline(inf.p, P1);
  await Promise.all([inf.p.waitForURL(/error=/), tf.getByRole('button', { name: 'Decline' }).click()]);
  rec('P.2 influencer cannot respond to another influencer\'s invitation', JSON.stringify(row(P1)) === JSON.stringify(before) && (await inf.p.locator('main').innerText()).includes('cannot respond'), `${JSON.stringify(row(P1))} · ${inf.p.url()}`);

  const bizB = await session(browser, U.bizB);
  await bizB.p.goto(`${BASE}/collaboration/applications/${M1}`);
  rec('P.3 other business cannot view', !bizB.p.url().includes(M1), bizB.p.url());
  // Re-open a question on M3-like state is not possible (closed), so use M1's answer form against M2 (no open question) from business B.
  const m2Before = row(M2);
  await submitInjected(bizB.p, answerFormHtml, { applicationId: M2 });
  rec('P.4 other business cannot answer', JSON.stringify(row(M2)) === JSON.stringify(m2Before), bizB.p.url());
  const m1Before = row(M1);
  await submitInjected(bizB.p, acceptFormHtml, { applicationId: M1 });
  rec('P.5 other business cannot accept', JSON.stringify(row(M1)) === JSON.stringify(m1Before), bizB.p.url());
  await submitInjected(inf.p, acceptFormHtml, { applicationId: M1 });
  rec('P.6 invitee cannot accept (server, P1-AUD-10)', JSON.stringify(row(M1)) === JSON.stringify(m1Before), inf.p.url());
  await submitInjected(inf.p, answerFormHtml, { applicationId: M2 });
  rec('P.7 influencer cannot answer as business', JSON.stringify(row(M2)) === JSON.stringify(m2Before), inf.p.url());
  const anon = await browser.newContext(); const ap = await anon.newPage();
  await ap.goto(`${BASE}/collaboration/applications/${M1}`);
  rec('P.8 signed-out direct route → login with return to item', ap.url().includes('/login') && decodeURIComponent(ap.url()).includes(`/collaboration/applications/${M1}`), ap.url());
  await ap.fill('input[name="email"]', U.infA); await ap.fill('input[name="password"]', require('./lib').PW);
  await Promise.all([ap.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 30000 }).catch(() => {}), ap.click('button[type="submit"]')]);
  rec('P.8b after sign-in the user lands on the item', ap.url().includes(`/collaboration/applications/${M1}`), ap.url());
  // Session ends while the popup is open: the submission is refused and returns to the item after login.
  const tf2 = await tamperedDecline(ap, M1);
  await anon.clearCookies();
  await Promise.all([ap.waitForURL(/\/login/), tf2.getByRole('button', { name: 'Decline' }).click()]);
  rec('P.9 signed-out submission refused → login with return to item', JSON.stringify(row(M1)) === JSON.stringify(m1Before) && decodeURIComponent(ap.url()).includes(`/collaboration/applications/${M1}`), ap.url());

  // ---- Mobile (390): same counts and the same case/actions.
  const mob = await session(browser, U.infA, true);
  await mob.p.goto(BASE + '/collaboration/hub?view=collaborations&tab=invitations');
  const hubSw = await mob.p.evaluate(() => document.documentElement.scrollWidth);
  const mobText = await mob.p.locator('main').innerText();
  dlg = await openPopup(mob.p, 'S1-M2 Follow-up');
  rec('MOB.1 mobile popup = desktop (case 6)', (await caseOf(dlg)) === '6' && (await buttons(dlg)) === 'Ask a follow-up question · Decline', await buttons(dlg));
  await shot(mob.p, 'mob-1-popup-case6');
  await mob.p.goto(BASE + '/creator');
  const mobHome = await mob.p.locator('main').innerText();
  rec('MOB.2 mobile home shows no task for business-turn invitations', !mobHome.includes(brand('S1-M1 Matrix walk')) && !mobHome.includes(brand('S1-M2 Follow-up')) && mobText.includes(brand('S1-M1 Matrix walk')), 'M1 (case 4) and M2 (case 6) listed in hub only');
  const sw = await mob.p.evaluate(() => document.documentElement.scrollWidth);
  rec('MOB.3 hub invitations: no horizontal page scroll at 390', hubSw <= 390, `hub scrollWidth ${hubSw} · (observation, S9 scope: /creator scrollWidth ${sw})`);

  const s4 = await surfaces(inf.p, keys);
  rec('C1 final counts consistent', keys.every((k) => s4.out[k].home === s4.out[k].inbox) && s4.badge === s0.badge - 4, `badge ${s0.badge}→${s4.badge} · ${JSON.stringify(s4.out)}`);

  fs.writeFileSync(path.join(EV, 'results.json'), JSON.stringify({ stamp: STAMP, ids: IDS, results }, null, 2));
  const fails = results.filter((x) => !x.ok).length;
  console.log(`\n${results.length - fails}/${results.length} pass`);
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
