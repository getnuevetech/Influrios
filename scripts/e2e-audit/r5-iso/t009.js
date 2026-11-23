const { chromium, BASE, U, session } = require('./lib'); const C = require('./capture'); const fs = require('fs');
(async () => { const b = await chromium.launch(); const dir = process.env.EV + '/INV-T-009'; fs.mkdirSync(dir, { recursive: true }); const r = { check: 'INV-T-009', panels: {} };
  const { p } = await session(b, U.bizA); const base = `${BASE}/collaboration/contracts?view=agreements&open=cmwqop0oz00i87d9i2h5zf6dt`;
  await p.goto(base); await p.waitForLoadState('networkidle'); await C.shot(p, dir, '1-dialog');
  r.tabs = ['Overview', 'Document', 'Signers', 'Activity'];
  for (const t of r.tabs) { await p.locator('button:visible', { hasText: new RegExp('^' + t + '$') }).first().click(); await p.waitForTimeout(400); const txt = await p.innerText('body'); await C.shot(p, dir, '2-tab-' + t.toLowerCase());
    const marker = { Overview: /Financial summary/, Document: /COLLABORATION AGREEMENT|Agreement|Parties/i, Signers: /Amara|Influencer A|signed/i, Activity: /signed|sent|created/i }[t]; r.panels[t] = marker.test(txt) ? 'content shown' : 'no content'; }
  r.result = Object.keys(r.panels).length >= 2 && Object.values(r.panels).every(v => v === 'content shown') ? 'Pass' : 'Fail';
  fs.writeFileSync(dir + '/result.json', JSON.stringify(r, null, 2)); console.log(JSON.stringify(r)); await b.close(); })();
