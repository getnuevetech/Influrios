const { chromium, BASE, U, session } = require('./lib'); const C = require('./capture'); const fs = require('fs');
(async () => { const b = await chromium.launch(); const dir = process.env.EV + '/INV-R-062'; const r = JSON.parse(fs.readFileSync(dir + '/result.json'));
  const u = await session(b, U.infU); const res = await u.p.goto(`${BASE}/collaboration/openings/cmwqow7xg00t17d9ijichchbu`); await u.p.waitForLoadState('networkidle');
  const t = await C.shot(u.p, dir, '4-influencer-opening-detail'); r.influencerView = { url: u.p.url(), http: res.status(), shows: /unboxing|AUDIT r5 opening/i.test(t), buttons: await u.p.locator('main form button').allInnerTexts() };
  r.businessView = 'business is redirected to a card-signup page (screenshot 3)'; r.result = r.influencerView.shows ? 'Pass (influencer view; business view lands on card-signup page — observation)' : 'Fail';
  fs.writeFileSync(dir + '/result.json', JSON.stringify(r, null, 2)); console.log(JSON.stringify(r.influencerView), r.result); await b.close(); })();
