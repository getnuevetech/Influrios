const { chromium, BASE, U, session } = require('./lib'); const F = 'cmwqnkk1f00037dc25lwesptv';
(async () => { const b = await chromium.launch();
  for (const who of ['bizA', 'infB']) { const { p } = await session(b, U[who]); const all = new Set();
    for (const tab of ['overview', 'breakdown', 'milestones', 'transactions', 'documents']) { await p.goto(`${BASE}/payments?currency=USD&deal=${F}&tab=${tab}`); await p.waitForLoadState('networkidle');
      (await p.$$eval('[role=dialog] a, [role=dialog] button, [aria-modal] a, [aria-modal] button, [data-account-dialog-root] a, [data-account-dialog-root] button', es => es.filter(e => e.offsetParent).map(e => (e.innerText || '').trim().slice(0, 40) + (e.getAttribute('href') ? '->' + e.getAttribute('href').slice(0, 70) : '')))).forEach(x => x && all.add(tab + ': ' + x)); }
    console.log('##', who); console.log([...all].join('\n')); }
  const { p } = await session(b, U.bizA); await p.goto(`${BASE}/collaboration/contracts?view=agreements&open=cmwqop0oz00i87d9i2h5zf6dt&panel=activity`); await p.waitForLoadState('networkidle');
  console.log('## agreement dialog tabs', JSON.stringify(await p.$$eval('a[href*="panel="]', as => as.map(a => a.innerText.trim() + '->' + a.getAttribute('href').match(/panel=\w+/)[0]))));
  await b.close(); })();
