const { chromium } = require('playwright');
const BASE = 'http://127.0.0.1:3000';
const PW = 'AuditLocalPass!2026';
const R = 'r5iso01';
const U = { bizA: `audit.${R}.business-a@example.com`, bizB: `audit.${R}.business-b@example.com`, infA: `audit.${R}.influencer-a@example.com`, infB: `audit.${R}.influencer-b@example.com`, infU: `audit.${R}.influencer-unrelated@example.com` };
async function session(browser, email, mobile = false) {
  const ctx = await browser.newContext(mobile ? { viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true } : { viewport: { width: 1440, height: 1000 } });
  const p = await ctx.newPage();
  await p.goto(BASE + '/login');
  await p.fill('input[name="email"]', email);
  await p.fill('input[name="password"]', PW);
  await Promise.all([p.waitForNavigation({ timeout: 30000 }).catch(() => {}), p.click('button[type="submit"]')]);
  return { ctx, p };
}
module.exports = { chromium, BASE, PW, R, U, session };
