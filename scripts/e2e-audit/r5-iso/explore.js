const { chromium, BASE, U, session } = require('./lib');
(async () => {
  const b = await chromium.launch();
  const { p } = await session(b, U.bizA);
  console.log('after login', p.url());
  for (const path of ['/collaboration/business', '/collaboration/business?tab=requests']) {
    await p.goto(BASE + path); await p.waitForLoadState('networkidle');
    console.log(path, '->', p.url());
    console.log((await p.$$eval('a,button', els => els.map(e => (e.innerText || '').trim()).filter(Boolean))).slice(0, 80).join(' | '));
  }
  await p.screenshot({ path: process.argv[2] + '/explore-biz.png', fullPage: true });
  await b.close();
})();
