// node render.js <designsDir> <mediaDir> [board ...]  — renders full board + #desktop/#mobile frames at 2x
const { chromium } = require('playwright');
const path = require('path'); const fs = require('fs');
const [designs, media, ...only] = process.argv.slice(2);
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1800, height: 1000 }, deviceScaleFactor: 2 });
  const files = fs.readdirSync(designs).filter(f => f.endsWith('.html') && (!only.length || only.includes(f.replace('.html',''))));
  for (const f of files) {
    const name = f.replace('.html', '');
    await p.goto('file://' + path.resolve(designs, f)); await p.evaluate(() => document.fonts.ready);
    await p.locator('.board').screenshot({ path: path.join(media, name + '.png') });
    const ids = await p.$$eval('.app[id], .phone[id]', els => els.map(e => e.id));
    for (const id of ids) await p.locator('#' + id).screenshot({ path: path.join(media, `${name}-${id}.png`) });
    console.log('rendered', name);
  }
  await b.close();
})();
