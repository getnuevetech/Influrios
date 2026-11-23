const { chromium, BASE, U, session } = require('./lib');
(async () => {
  const b = await chromium.launch(); const { p } = await session(b, U.bizA);
  await p.goto(BASE + '/collaboration/business/request/new'); await p.waitForLoadState('networkidle');
  const f = await p.$$eval('main input, main textarea, main select, main button', els => els.map(e => `${e.tagName}:${e.type||''}:${e.name||''}:${(e.innerText||e.placeholder||'').trim().slice(0,30)}`));
  console.log(p.url()); console.log(f.join('\n'));
  await p.screenshot({ path: process.argv[2] + '/wiz1.png', fullPage: true }); await b.close();
})();
