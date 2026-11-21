const { chromium, BASE, U, session } = require('./lib'); const C = require('./capture'); const db = require('./db'); const fs = require('fs');
async function run(id, fn) {
  const dir = process.env.EV + '/' + id; fs.mkdirSync(dir, { recursive: true });
  const res = { check: id, host: BASE, startedAt: new Date().toISOString(), steps: [] };
  const b = await chromium.launch();
  try { await fn({ b, dir, res, BASE, U, session, C, db, step: s => res.steps.push(s) }); }
  catch (e) { res.error = String(e.stack || e); }
  finally { res.finishedAt = new Date().toISOString(); fs.writeFileSync(dir + '/result.json', JSON.stringify(res, null, 2)); await b.close(); console.log(JSON.stringify(res, null, 1)); }
}
module.exports = { run };
