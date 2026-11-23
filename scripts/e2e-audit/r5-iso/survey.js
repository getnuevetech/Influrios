const { chromium, BASE, U, session } = require('./lib'); const fs = require('fs');
const F = 'cmwqnkk1f00037dc25lwesptv';
const pages = {
  infA: ['/collaboration/applications/cmwqn2cdw00lr7do5nbnpcd87', '/dashboard?tab=media-kit', '/creator/media-kit', '/dashboard'],
  infB: [`/collaboration/work/${F}?tab=milestones`, '/payments', '/dashboard', '/creator/earnings'],
  bizA: ['/collaboration/business?tab=requests', '/collaboration/business?tab=opportunities', `/collaboration/work/${F}?tab=milestones`, '/payments', '/business/records', '/trust', '/collaboration/contracts'],
};
(async () => { const b = await chromium.launch(); const out = {};
  for (const [who, list] of Object.entries(pages)) { const { p } = await session(b, U[who]);
    for (const path of list) { const r = await p.goto(BASE + path).catch(e => null); await p.waitForLoadState('networkidle').catch(() => {});
      const items = await p.$$eval('main a, main button, main summary', els => els.filter(e => e.offsetParent).map(e => (e.innerText || '').trim().replace(/\s+/g, ' ').slice(0, 50) + (e.getAttribute('href') ? ' ->' + e.getAttribute('href').slice(0, 90) : '')).filter(x => x.length > 1)).catch(() => []);
      out[`${who} ${path}`] = { status: r && r.status(), url: p.url(), items: [...new Set(items)].slice(0, 60) }; } }
  fs.writeFileSync(process.argv[2], JSON.stringify(out, null, 1)); await b.close(); })();
