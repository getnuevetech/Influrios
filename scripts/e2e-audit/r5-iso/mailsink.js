// Minimal local SMTP sink (127.0.0.1:1025) + JSON API (127.0.0.1:8025/api/v1/messages). Audit use only.
const net = require('net'), http = require('http'), fs = require('fs');
const store = process.argv[2]; const msgs = [];
net.createServer(sock => {
  let data = false, buf = '', cur = { from: '', to: [], raw: '' };
  const w = s => sock.write(s + '\r\n');
  w('220 sink ESMTP');
  sock.on('data', chunk => {
    buf += chunk.toString('utf8');
    let i;
    while ((i = buf.indexOf('\r\n')) >= 0) {
      const line = buf.slice(0, i); buf = buf.slice(i + 2);
      if (data) {
        if (line === '.') { data = false; const subj = (cur.raw.match(/^Subject: (.*)$/mi) || [])[1] || '';
          const m = { id: String(msgs.length + 1), from: cur.from, to: cur.to, subject: subj, created: new Date().toISOString(), raw: cur.raw };
          msgs.push(m); fs.writeFileSync(store, JSON.stringify(msgs, null, 1)); cur = { from: '', to: [], raw: '' }; w('250 OK queued'); }
        else cur.raw += (line.startsWith('..') ? line.slice(1) : line) + '\n';
        continue;
      }
      const u = line.toUpperCase();
      if (u.startsWith('EHLO')) { sock.write('250-sink\r\n250-AUTH PLAIN LOGIN\r\n250 OK\r\n'); }
      else if (u.startsWith('HELO')) w('250 sink');
      else if (u.startsWith('AUTH')) w('235 OK');
      else if (u.startsWith('MAIL FROM')) { cur.from = line.slice(10).trim(); w('250 OK'); }
      else if (u.startsWith('RCPT TO')) { cur.to.push(line.slice(8).trim()); w('250 OK'); }
      else if (u === 'DATA') { data = true; w('354 go'); }
      else if (u === 'QUIT') { w('221 bye'); sock.end(); }
      else w('250 OK');
    }
  });
  sock.on('error', () => {});
}).listen(1025, '127.0.0.1');
http.createServer((req, res) => { res.setHeader('content-type', 'application/json');
  res.end(JSON.stringify({ total: msgs.length, messages: msgs.map(({ raw, ...m }) => m) })); }).listen(8025, '127.0.0.1');
