const { chromium, BASE, U, session } = require('./lib');
(async () => { const b = await chromium.launch(); const { p } = await session(b, U.infB);
  await p.goto(BASE + '/collaboration/work/cmwqnkk1f00037dc25lwesptv'); await p.waitForLoadState('networkidle');
  console.log(p.url()); console.log((await p.$$eval('main a, main button', els => els.map(e => (e.innerText||'').trim()+'->'+(e.getAttribute('href')||'')).filter(x=>x.length>2))).slice(0,40).join(' | '));
  await p.screenshot({ path: process.argv[2] + '/wr.png', fullPage: true }); await b.close(); })();
