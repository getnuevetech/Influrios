const { chromium, BASE } = require('./lib');
(async () => { const b = await chromium.launch(); const a = await (await b.newContext()).newPage();
  await a.goto(BASE + '/admin/login'); await a.fill('input[name=email]', 'audit.admin@example.com'); await a.fill('input[name=password]', 'AuditLocalPass!2026');
  await Promise.all([a.waitForNavigation().catch(() => {}), a.click('button[type=submit]')]);
  await a.goto(BASE + '/admin/collaboration-ops'); await a.waitForLoadState('networkidle');
  console.log(await a.$eval('select[name=applicationExpireMode]', s => ({ disabled: s.disabled, visible: !!s.offsetParent, rect: s.getBoundingClientRect().toJSON(), details: !!s.closest('details:not([open])') })));
  await b.close(); })();
