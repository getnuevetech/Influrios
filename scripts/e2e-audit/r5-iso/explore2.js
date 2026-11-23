const { chromium, BASE, U, session } = require('./lib');
(async () => {
  const b = await chromium.launch();
  const { p } = await session(b, U.bizA);
  await p.goto(BASE + '/collaboration/business'); await p.check('input[type=checkbox]'); await Promise.all([p.waitForNavigation().catch(()=>{}), p.click('text=Continue')]);
  await p.waitForLoadState('networkidle'); console.log(p.url());
  console.log((await p.$$eval('main a, main button', els => els.map(e => (e.innerText || '').trim()+' ->'+(e.getAttribute('href')||'')).filter(Boolean))).slice(0, 60).join(' | '));
  await p.screenshot({ path: process.argv[2] + '/explore-biz2.png', fullPage: true });
  await b.close();
})();
