const { chromium, BASE, U, session } = require('./lib');
async function admin(b) { const p = await (await b.newContext({ viewport: { width: 1440, height: 1000 } })).newPage(); await p.goto(BASE + '/admin/login'); await p.fill('input[name=email]', 'audit.admin@example.com'); await p.fill('input[name=password]', 'AuditLocalPass!2026'); await Promise.all([p.waitForNavigation().catch(() => {}), p.click('button[type=submit]')]); return p; }
const forms = p => p.$$eval('form', fs => fs.map(f => ({ btn: [...f.querySelectorAll('button')].map(b => b.innerText.trim()).join('/'), fields: [...f.querySelectorAll('input,select,textarea')].filter(e => e.type !== 'hidden').map(e => e.name + ':' + e.type + (e.required ? '*' : '')).join(','), hidden: [...f.querySelectorAll('input[type=hidden]')].map(e => e.name).join(',') })).filter(f => f.btn || f.fields));
module.exports = { admin, forms };
if (require.main === module) (async () => { const b = await chromium.launch();
  const a = await admin(b); await a.goto(BASE + '/admin/marketplace-listings'); await a.waitForLoadState('networkidle');
  console.log('ADMIN LISTINGS', JSON.stringify((await forms(a)).filter(f => /opportun|creator|save/i.test(f.btn + f.fields)).slice(0, 4)));
  const biz = await session(b, U.bizA);
  await biz.p.goto(BASE + '/collaboration/business?tab=opportunities&view=applications'); await biz.p.waitForLoadState('networkidle');
  console.log('BIZ APPS', (await biz.p.$$eval('main a, main button', els => els.filter(e => e.offsetParent).map(e => (e.innerText || '').trim().slice(0, 40) + (e.getAttribute('href') ? '->' + e.getAttribute('href').slice(0, 100) : '')))).filter(x => !/Dashboard|Profile|Discover|Analytics|Team|Billing|Verification|Settings|Log out|Action inbox|Contracts|Payments|Collaborations/.test(x)).join(' | '));
  await biz.p.goto(BASE + '/collaboration/records'); await biz.p.waitForLoadState('networkidle');
  console.log('RECORDS', (await biz.p.innerText('main')).slice(0, 400).replace(/\n+/g, ' | '));
  await b.close(); })();
