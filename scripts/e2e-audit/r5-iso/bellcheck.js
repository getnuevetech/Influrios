const { chromium, BASE, U, session } = require('./lib'); const C = require('./capture'); const fs = require('fs');
(async () => { const b = await chromium.launch(); const { p } = await session(b, U.infB); const dir = process.env.EV + '/INV-P-019';
  await p.goto(BASE + '/creator/notifications'); await p.waitForLoadState('networkidle'); const t = await C.shot(p, dir, '4-fresh-reload');
  const bell = await C.bell(p); const unread = (t.match(/\nUnread\n/g) || []).length; const filt = (t.match(/Unread \(\d+\)|Unread\s*\d+/) || [null])[0];
  await p.goto(BASE + '/creator'); await p.waitForLoadState('networkidle'); const bellHome = await C.bell(p);
  console.log(JSON.stringify({ bellCentre: bell, unreadRowLabels: unread, filterLabel: filt, bellHome })); await b.close(); })();
