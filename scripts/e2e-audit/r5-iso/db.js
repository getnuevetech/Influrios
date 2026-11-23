const { execFileSync } = require('child_process');
module.exports = q => execFileSync('psql', ['-h','127.0.0.1','-p','5433','-U','postgres','influrios_audit','-Atc', q]).toString().trim();
