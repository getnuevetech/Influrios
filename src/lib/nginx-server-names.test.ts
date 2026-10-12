import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { describe, it } from "node:test";

function patch(text: string) {
  const result = spawnSync("python3", ["deploy/scripts/nginx_server_names.py", "-"], {
    input: text,
    encoding: "utf8",
  });
  assert.equal(result.status, 0, result.stderr);
  return result.stdout;
}

describe("nginx server_name for inflr.me", () => {
  it("adds the short domain to a Certbot HTTPS block without touching the certificate lines", () => {
    const live = `server {
    server_name influrios.com www.influrios.com;
    listen 443 ssl;
    ssl_certificate /etc/letsencrypt/live/influrios.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/influrios.com/privkey.pem;
}
server {
    if ($host = www.influrios.com) {
        return 301 https://$host$request_uri;
    }
    listen 80;
    server_name influrios.com www.influrios.com;
    return 404; # managed by Certbot
}
`;
    const next = patch(live);
    assert.equal(next.includes("ssl_certificate /etc/letsencrypt/live/influrios.com/fullchain.pem;"), true);
    assert.equal(next.includes("return 301 https://$host$request_uri;"), true);
    const names = next.match(/server_name[^;]+;/g) ?? [];
    assert.equal(names.length, 2);
    for (const line of names) {
      assert.match(line, /influrios\.com www\.influrios\.com inflr\.me www\.inflr\.me;/);
    }
  });

  it("leaves a server_name that already lists inflr.me unchanged", () => {
    const ready = "server_name influrios.com www.influrios.com inflr.me www.inflr.me;\n";
    assert.equal(patch(ready), ready);
  });

  it("does not add inflr.me to a server block for another host", () => {
    const other = "server_name example.com;\n";
    assert.equal(patch(other), other);
  });
});
