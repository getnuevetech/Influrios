const { chromium, BASE, U, session } = require('./lib');
(async () => { const b = await chromium.launch(); const { p } = await session(b, U.infB);
  await p.goto(BASE + '/collaboration/work/cmwqnkk1f00037dc25lwesptv?tab=milestones&focus=cmwqnkk1f00047dc2ivtdetzo&intent=submit'); await p.waitForLoadState('networkidle');
  console.log(await p.$$eval('[role=dialog] input, [role=dialog] textarea, [role=dialog] button, [data-account-dialog-root] input, [data-account-dialog-root] textarea, [data-account-dialog-root] button', els => els.map(e => `${e.tagName}:${e.type}:${e.name}:${(e.innerText||e.placeholder||'').trim().slice(0,40)}`).join('\n')));
  await p.screenshot({ path: process.argv[2] + '/wr2.png', fullPage: true }); await b.close(); })();
