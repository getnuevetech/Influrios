const { BASE } = require('./lib'); const C = require('./capture');
// Create a private-invitation request through the 4-step wizard. Returns final URL.
async function createRequest(p, dir, { title, slugs, deadline = '2026-11-28', budget = '800' }) {
  await p.goto(BASE + '/collaboration/business/request/new'); await p.waitForLoadState('networkidle');
  await p.fill('input[name=title]', title); await p.fill('textarea[name=goal]', `${title} objective`); await p.fill('textarea[name=deliverables]', '1 YouTube video');
  await p.click('button:has-text("Next")'); await p.waitForTimeout(500);
  await p.locator('input[type=radio]').first().check(); await p.waitForTimeout(300);
  for (const s of slugs) { await p.locator(`div:has(> * :text("@${s}")), li:has-text("@${s}")`).last().locator('button:has-text("Add")').click().catch(async () => { await p.locator(`text=@${s}`).locator('xpath=ancestor::*[.//button][1]').locator('button:has-text("Add")').first().click(); }); }
  await C.shot(p, dir, 'w-audience');
  await p.click('button:has-text("Next")'); await p.waitForTimeout(500);
  const bud = p.locator('input[name=budget]'); if (await bud.isVisible()) await bud.fill(budget);
  if (deadline) { const dl = p.locator('input[name=responseDeadline]'); if (await dl.isVisible()) await dl.fill(deadline); }
  await C.shot(p, dir, 'w-terms');
  await p.click('button:has-text("Next")'); await p.waitForTimeout(1200);
  const rt = await C.shot(p, dir, 'w-after-terms-next');
  if (/invitations? recorded/i.test(rt)) return { url: p.url(), sentAt: 'Terms step Next (no Review stop)', banner: (rt.match(/\d+ invitations? recorded[^\n]*/i) || [''])[0] };
  const btns = await p.$$eval('button', bs => bs.filter(b => b.offsetParent).map(b => b.innerText.trim()));
  const send = btns.find(t => /send|publish|invite/i.test(t));
  if (!send) throw new Error('no send button; buttons=' + btns.join(','));
  await Promise.all([p.waitForNavigation().catch(() => {}), p.click(`button:has-text("${send}")`)]);
  await p.waitForLoadState('networkidle'); await C.shot(p, dir, 'w-after-send');
  return { url: p.url(), button: send };
}
module.exports = { createRequest };
