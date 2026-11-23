const { chromium, BASE, U, session } = require('./lib');
(async () => {
  const b = await chromium.launch(); const { p } = await session(b, U.bizA); const d = process.argv[2];
  await p.goto(BASE + '/collaboration/business/request/new'); await p.waitForLoadState('networkidle');
  await p.fill('input[name=title]', 'AUDIT r5 wizard probe'); await p.fill('textarea[name=goal]', 'Probe'); await p.fill('textarea[name=deliverables]', '1 YouTube video');
  await p.click('button:has-text("Next")'); await p.waitForTimeout(800); await p.screenshot({ path: d + '/wiz2-aud.png', fullPage: true });
  console.log(await p.$$eval('main label, main input[type=radio]', els => els.map(e => (e.innerText || e.value || '').trim()).filter(Boolean).join(' | ')));
  await b.close();
})();
