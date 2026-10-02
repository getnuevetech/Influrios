# AWS Lightsail — Server Preparation & Deploy Guide

**Target:** Influrios (Next.js + PostgreSQL via Docker Compose + Nginx on the host)  
**Instance recommendation:** Ubuntu 22.04 or 24.04 LTS, **$10–20/mo** (2 GB RAM minimum; **4 GB preferred** for on-box `docker compose build`)

> **New server?** Start here first → **[FRESH_SERVER_SETUP.md](./FRESH_SERVER_SETUP.md)**  
> (OS update, GitHub deploy key, Docker + Nginx, then clone + deploy)  
> **Current sequencing / maturity:** [`../DEVELOPMENT_STATE_AND_NEXT_PLAN.md`](../DEVELOPMENT_STATE_AND_NEXT_PLAN.md)  
> **Staging SMTP / Stripe / social / marketplace drills:** [`STAGING_LAUNCH_INTEGRATIONS.md`](./STAGING_LAUNCH_INTEGRATIONS.md)

PM2 was an earlier host process manager for Next.js. **Do not use PM2 for the app.** The web process and Postgres both run in Docker Compose; Nginx proxies to `127.0.0.1:3000`.

---

## Architecture on Lightsail

```
Internet → Lightsail static IP
              ↓
         Nginx (:80/:443)
              ↓
         Docker Compose web (:3000 on 127.0.0.1)
              ↓
         Docker Compose postgres (internal network; host port 127.0.0.1:5432 for tooling)
```

Postgres stays on the same instance, published only on localhost for Prisma/seed tooling (not opened in Lightsail networking).

---

## A. Create the Lightsail resources

### 1. Create an instance

1. AWS Console → **Lightsail** → **Instances** → **Create instance**
2. Select region closest to your users
3. Platform: **Linux/Unix** → Blueprint: **OS Only** → **Ubuntu 24.04 LTS**
4. Instance plan: **2 GB RAM** minimum (use **4 GB** if you build on the server)
5. Name: `influrios-web-1`
6. Create instance

### 2. Attach a static IP

1. Lightsail → **Networking** → **Create static IP**
2. Attach to `influrios-web-1`
3. Note the IP — you will point DNS here

### 3. Open firewall ports (Lightsail networking)

On the instance networking tab, allow:

| Port | Application |
|------|-------------|
| 22 | SSH |
| 80 | HTTP |
| 443 | HTTPS |

Do **not** open port **5432**. Docker Postgres listens on `127.0.0.1` only.

### 4. SSH key access

Download the Lightsail default key (or use your own uploaded key), then:

```bash
chmod 400 ~/LightsailDefaultKey-*.pem
ssh -i ~/LightsailDefaultKey-REGION.pem ubuntu@STATIC_IP
```

Then follow **[FRESH_SERVER_SETUP.md](./FRESH_SERVER_SETUP.md)** for OS update + GitHub deploy key + clone.

---

## B. Prepare the server (one-time)

```bash
# On the Lightsail instance (after GitHub SSH works):
git clone git@github.com:getnuevetech/Influrios.git /var/www/influrios
cd /var/www/influrios
git checkout main

chmod +x deploy/scripts/*.sh
bash deploy/scripts/setup-lightsail.sh
newgrp docker   # so docker works without sudo
```

What `setup-lightsail.sh` installs:

1. `apt` updates + build tools  
2. UFW firewall (SSH + Nginx)  
3. **Docker Engine + Compose** (Postgres **and** the Next.js web app)  
4. **Node.js 22** (optional host tooling: Prisma / seed)  
5. Removes a legacy PM2 `influrios` process if present (PM2 is not used for the app)  
6. `/var/www/influrios` ownership  
7. **Nginx** reverse proxy to `127.0.0.1:3000`

---

## C. Docker database + first deploy

```bash
cd /var/www/influrios
cp .env.example .env
nano .env
```

Set:

```env
NODE_ENV=production
PORT=3000
NEXT_PUBLIC_APP_URL=https://your-domain.com

POSTGRES_USER=influrios
POSTGRES_PASSWORD=pick-a-strong-password
POSTGRES_DB=influrios
DATABASE_URL="postgresql://influrios:pick-a-strong-password@127.0.0.1:5432/influrios?schema=public"

AUTH_SECRET=generate-a-long-random-string
ADMIN_SESSION_SECRET=generate-another-long-random-string
ADMIN_SUPER_EMAIL=admin@your-domain.com
ADMIN_SUPER_PASSWORD=pick-a-strong-admin-password
```

Compose volumes:

| Volume | Mount | Required? |
|---|---|---|
| `influrios_pg` | Postgres data | **Yes** |
| `influrios_uploads` | `/app/public/uploads` (banner/media files) | **Yes** |
| `influrios_data` | `/app/data` (remaining JSON demos: payments, trust, intelligence, fees) | Optional for admin, CMS, and billing; still used until demo stores migrate |

`legacy_demo_payments` stays **off** by default — do not force it on in production.

```bash
bash deploy/scripts/db-up.sh      # starts postgres container
bash deploy/scripts/deploy.sh     # docker compose up --build (postgres + web)
```

Useful commands:

```bash
docker compose ps
docker compose logs -f web
docker compose logs -f postgres
npm run db:down                   # stop DB (keeps volume)
```

Visit `http://STATIC_IP` — you should see the Influrios home page.

### Back up Docker Postgres data

```bash
bash deploy/scripts/backup-postgres.sh
# Writes /var/backups/influrios/influrios-YYYYMMDD-HHMMSS.sql.gz (keeps ~14 days)

# Restore drill (stops web, recreates DB, migrates, starts web, curls /api/health):
# bash deploy/scripts/restore-postgres.sh /var/backups/influrios/influrios-….sql.gz

# Optional: Lightsail instance snapshots (includes Docker volume disk + uploads)
```

Cron example (daily 03:15 UTC):

```cron
15 3 * * * cd /var/www/influrios && bash deploy/scripts/backup-postgres.sh >> /var/log/influrios-backup.log 2>&1
```
---

## D. Domain + HTTPS

1. DNS: create **A** records for `@` and `www` → Lightsail static IP  
2. Edit Nginx `server_name` in `/etc/nginx/sites-available/influrios`  
3. `sudo nginx -t && sudo systemctl reload nginx`  
4. Install certbot:

```bash
sudo apt-get install -y certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com -d www.your-domain.com
```

5. Update `.env` `NEXT_PUBLIC_APP_URL` to `https://your-domain.com` and redeploy:

```bash
bash deploy/scripts/deploy.sh
curl -fsS https://your-domain.com/api/health
```

Stripe, social callbacks, and marketplace webhooks must use the same https origin.
---

## E. Ongoing deploy (after first setup)

```bash
cd /var/www/influrios
git pull origin main
bash deploy/scripts/deploy.sh
```

---

## F. Local development

```bash
cp .env.example .env
# set a password; keep DATABASE_URL on 127.0.0.1
npm run db:up                     # or: docker compose up -d
npm ci
npx prisma db push
npm run db:seed
npm run dev
```

Open http://localhost:3000

> UI pages currently read from `src/lib/seed-data.ts` so browsing works even before Prisma is wired to pages. Schema + seed prepare the real database for claim/auth.

---

## G. Server sizing & ops checklist

| Item | Guidance |
|------|----------|
| RAM | Prefer 4 GB if building on the instance (Node build + Postgres share RAM) |
| Swap | If on 2 GB: add 2 GB swapfile |
| DB backups | `bash deploy/scripts/backup-postgres.sh` on a schedule + Lightsail instance snapshots (covers uploads) |
| Updates | `sudo apt-get update && sudo apt-get upgrade` monthly |
| Logs | `docker compose logs -f web` · `docker compose logs postgres` · `/var/log/nginx/` |
| Health | `curl -fsS https://your-domain.com/api/health` · `docker compose ps` |

---

## H. Security baseline

- [ ] SSH key only (disable password auth)  
- [ ] UFW enabled; **5432 not open** on Lightsail networking  
- [ ] Postgres bound to `127.0.0.1` only (see `docker-compose.yml`)  
- [ ] Strong `POSTGRES_PASSWORD` · `chmod 600 .env`  
- [ ] fail2ban installed by setup script  
- [ ] HTTPS via Certbot before any real user data  
- [ ] Do not commit `.env` or Lightsail PEM keys  

---

## I. Phase 1 readiness after server is live

1. Wire auth (Clerk / Auth.js)  
2. Switch Discover/Profile reads from seed → Prisma  
3. Implement draft → claim → verify → publish  
4. Plus shortlink + standard QR routes  
5. Admin invite links  

See [RECOMMENDATIONS_AND_EXECUTION_PLAN.md](../RECOMMENDATIONS_AND_EXECUTION_PLAN.md) §7–§13.
