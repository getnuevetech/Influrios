const { BASE } = require('./lib');
const fs = require('fs'), path = require('path');
const num = (t, re) => { const m = t.match(re); return m ? Number(m[1]) : null; };
async function sidebar(p) {
  return p.$$eval('aside nav a', as => Object.fromEntries(as.map(a => { const t = a.innerText.trim().split('\n').map(s => s.trim()).filter(Boolean); const n = t.find(x => /^\d+$/.test(x)); return [t.find(x => !/^\d+$/.test(x)), n ? Number(n) : 0]; })));
}
async function bell(p) {
  const l = await p.$$eval('[aria-label*="unread" i], [aria-label*="Notifications" i]', els => els.map(e => e.getAttribute('aria-label'))).catch(() => []);
  const m = (l.join(' ').match(/(\d+)\s*unread/i) || [])[1]; return m ? Number(m) : (l.length ? 0 : null);
}
async function shot(p, dir, name) { fs.mkdirSync(dir, { recursive: true }); await p.screenshot({ path: path.join(dir, name + '.png'), fullPage: true }); const t = await p.innerText('body'); fs.writeFileSync(path.join(dir, name + '.txt'), t); return t; }
// Influencer counts across surfaces
async function influencer(p, dir, tag) {
  const out = {};
  await p.goto(BASE + '/creator'); await p.waitForLoadState('networkidle');
  let t = await shot(p, dir, tag + '-home');
  out.homeBanner = num(t, /(\d+)\s+new invitations?/i);
  out.homeStat = num(t, /\nInvitations\s*\n\s*(\d+)/);
  out.homeAttention = num(t, /Needs your attention\s*\n\s*(\d+)/);
  out.homePayoutReminder = /Complete payout setup/i.test(t);
  out.homeActive = num(t, /Active collaborations\s*\n\s*(\d+)/);
  out.sidebar = await sidebar(p); out.bell = await bell(p);
  await p.goto(BASE + '/collaboration/hub?view=collaborations'); await p.waitForLoadState('networkidle');
  t = await shot(p, dir, tag + '-hub');
  out.hubInvitationsCard = num(t, /\nInvitations\s*\n\s*(\d+)/);
  out.hubNoInvitesCopy = /No invitations are waiting/i.test(t);
  out.hubActive = num(t, /\nActive\s*\n\s*(\d+)/);
  out.hubPaymentReadiness = (t.match(/Payment readiness\s*\n\s*([^\n]+)/) || [])[1] || null;
  await p.goto(BASE + '/collaboration/inbox'); await p.waitForLoadState('networkidle');
  t = await shot(p, dir, tag + '-inbox');
  out.inboxOpenTasks = num(t, /(\d+) open tasks?/i);
  return out;
}
async function business(p, dir, tag) {
  const out = {};
  await p.goto(BASE + '/business/home'); await p.waitForLoadState('networkidle');
  const t = await shot(p, dir, tag + '-bizhome');
  out.attentionText = (t.match(/Needs your attention\s*\n([\s\S]{0,300})/) || [])[1]?.split('\n').slice(0, 4).join(' / ') || null;
  out.sidebar = await sidebar(p); out.bell = await bell(p);
  return out;
}
module.exports = { influencer, business, shot, sidebar, bell };
