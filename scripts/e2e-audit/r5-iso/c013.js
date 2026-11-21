const { chromium, BASE } = require('./lib'); const C = require('./capture'); const fs = require('fs');
(async () => { const b = await chromium.launch(); const dir = process.env.EV + '/INV-C-013-contrast'; fs.mkdirSync(dir, { recursive: true }); const r = { check: 'INV-C-013', fixture: 'FIXTURE: InfluenceCard published=true for audit-r5iso01-a, published=false for audit-r5iso01-u (no member UI publishes cards); Instagram account on both; public_pages_live on (admin UI, IPS-45)' };
  const g = await (await b.newContext()).newPage(); r.discover = {};
  for (const q of ['', 'AUDIT r5iso01', 'audit-r5iso01']) { await g.goto(`${BASE}/discover${q ? '?q=' + encodeURIComponent(q) : ''}`); await g.waitForLoadState('networkidle'); const t = await C.shot(g, dir, 'discover-' + (q || 'all').replace(/\W+/g, '-'));
    r.discover[q || 'all'] = { publishedA: /Influencer A|audit-r5iso01-a/.test(t), unpublishedU: /Unrelated|audit-r5iso01-u/.test(t), demoBanner: /sample|demo/i.test(t.slice(0, 3000)) }; }
  r.profile = {};
  for (const s of ['audit-r5iso01-a', 'audit-r5iso01-u']) { for (const path of [`/c/${s}`, `/creators/${s}`]) { const res = await g.goto(BASE + path); await g.waitForLoadState('networkidle'); const t = await C.shot(g, dir, 'profile' + path.replace(/\W+/g, '-')); r.profile[path] = res.status() + (/not found|404/i.test(t.slice(0, 1500)) ? ' not-found page' : ' shown'); } }
  const pubShown = Object.values(r.discover).some(v => v.publishedA) || /shown/.test(r.profile['/creators/audit-r5iso01-a']);
  const unpubHidden = Object.values(r.discover).every(v => !v.unpublishedU) && !/200 shown/.test(r.profile['/creators/audit-r5iso01-u']);
  r.result = pubShown && unpubHidden ? 'Pass (published listed/visible, unpublished hidden)' : `Fail (publishedShown=${pubShown}, unpublishedHidden=${unpubHidden})`;
  fs.writeFileSync(dir + '/result.json', JSON.stringify(r, null, 2)); console.log(JSON.stringify(r, null, 1)); await b.close(); })();
