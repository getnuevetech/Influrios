const { chromium, BASE, U, session } = require('./lib');
(async () => { const b = await chromium.launch(); const { p } = await session(b, U.bizA);
  await p.goto(BASE + '/collaboration/work/cmwqnkk1f00037dc25lwesptv?tab=milestones'); await p.waitForLoadState('networkidle');
  console.log((await p.$$eval('main a, main button', els => els.map(e => (e.innerText||'').trim()+'->'+(e.getAttribute('href')||'')).filter(x=>/review|approve|change|version/i.test(x)))).join('\n'));
  await b.close(); })();
