const { chromium, BASE, U, session } = require('./lib'); const C = require('./capture'); const db = require('./db'); const fs = require('fs');
async function check(id, fn) { const dir = process.env.EV + '/' + id; fs.mkdirSync(dir, { recursive: true }); const r = { check: id, steps: [] };
  try { await fn({ dir, r, step: s => r.steps.push(s) }); } catch (e) { r.error = String(e.message || e).slice(0, 300); }
  fs.writeFileSync(dir + '/result.json', JSON.stringify(r, null, 2)); console.log(id, JSON.stringify(r).slice(0, 900)); }
(async () => { const b = await chromium.launch();
  if (process.argv[2] !== 'r065') await check('INV-P-019', async ({ dir, r, step }) => { const { p } = await session(b, U.infB);
    await p.goto(BASE + '/creator/notifications'); await p.waitForLoadState('networkidle'); await C.shot(p, dir, '1-centre');
    r.bellBefore = await C.bell(p); const open = p.getByText('Open', { exact: true }).first();
    if (!(await open.count())) { r.result = 'Blocked: no notice with Open control'; return; }
    await Promise.all([p.waitForNavigation().catch(() => {}), open.click()]); await p.waitForLoadState('networkidle'); await p.waitForTimeout(500);
    const t = await C.shot(p, dir, '2-dialog-open'); r.url = p.url(); r.dialog = await p.locator('[role=dialog], [aria-modal=true], [data-account-dialog-root]').count();
    r.dialogButtons = await p.$$eval('[role=dialog] a, [role=dialog] button, [data-account-dialog-root] a, [data-account-dialog-root] button', es => es.filter(e => e.offsetParent).map(e => e.innerText.trim()).filter(Boolean));
    const close = p.locator('[data-account-dialog-root] a:visible, [data-account-dialog-root] button:visible, [role=dialog] button:visible').filter({ hasText: /^Close$|×/ }).first(); if (await close.count()) { await Promise.all([p.waitForNavigation().catch(() => {}), close.click()]); await p.waitForLoadState('networkidle'); }
    await C.shot(p, dir, '3-after-close'); r.bellAfter = await C.bell(p);
    r.result = r.dialog > 0 ? `Pass (notice dialog opens with ${r.dialogButtons.join('/')}; bell ${r.bellBefore}→${r.bellAfter})` : 'Fail: no dialog';
  });
  await check('INV-R-065', async ({ dir, r, step }) => { const { p } = await session(b, U.infA);
    await p.goto(BASE + '/collaboration/propose?a=audit-r5iso01-a&b=audit-r5iso01-b'); await p.waitForLoadState('networkidle'); await C.shot(p, dir, '1-propose');
    r.fixture = 'FIXTURE: influencer A planTier set to PLUS in DB (plan purchase is Stripe / RC-CATALOG)'; r.fields = await p.$$eval('form input:not([type=hidden]), form select, form textarea', es => es.filter(e => e.offsetParent).map(e => e.tagName + ':' + e.name + ':' + (e.tagName === 'SELECT' ? [...e.options].slice(0, 4).map(o => o.value).join('/') : e.type)));
    for (const [n, v] of [['title', 'AUDIT r5 Record'], ['scope', 'AUDIT r5 record detail fixture'], ['commercial', 'USD 500']]) { const l = p.locator(`[name=${n}]:visible`); if (await l.count()) await l.first().fill(v); }
    for (const n of ['a', 'b', 'from']) { const l = p.locator(`select[name=${n}]:visible`); if (await l.count()) { const opts = await l.first().$$eval('option', os => os.map(o => o.value).filter(Boolean)); const pick = opts.find(o => /r5iso01-a|r5iso01 Co A|business/i.test(o)) || opts[0]; if (n === 'b') await l.first().selectOption(opts.find(o => /audit-r5iso01-a/.test(o)) || opts[opts.length - 1]); else await l.first().selectOption(pick); } else { const i = p.locator(`input[name=${n}]:visible`); if (await i.count()) await i.first().fill(n === 'b' ? 'audit-r5iso01-a' : 'AUDIT r5iso01 Co A'); } }
    await C.shot(p, dir, '2-filled'); const btns = await p.$$eval('form button', bs => bs.filter(b => b.offsetParent).map(b => b.innerText.trim())); r.buttons = btns;
    const go = p.locator('form button:visible').filter({ hasText: /propose|send|create|submit/i }).first(); await Promise.all([p.waitForNavigation().catch(() => {}), go.click()]); await p.waitForLoadState('networkidle');
    const t = await C.shot(p, dir, '3-after-submit'); r.url = p.url(); r.msg = (t.match(/[^\n]*(error|could not|required|created|sent|proposal)[^\n]*/i) || [null])[0];
    const id = db(`select id from "Collaboration" order by "createdAt" desc limit 1`); r.collaborationId = id; if (!id) { r.result = 'Blocked: propose did not create a Collaboration'; return; }
    const res = await p.goto(`${BASE}/collaboration/records/${id}`); await p.waitForLoadState('networkidle'); const tt = await C.shot(p, dir, '4-record-detail');
    r.http = res.status(); r.showsTitle = /AUDIT r5 Record/.test(tt); await p.reload(); await C.shot(p, dir, '5-record-reload');
    r.result = r.http === 200 && r.showsTitle ? 'Pass' : 'Fail';
  });
  await b.close(); })();
