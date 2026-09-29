# AWS Lightsail — Server Preparation & Deploy Guide

**Target:** Influrios Phase 0/1 (Next.js + PostgreSQL + Nginx + PM2)  
**Instance recommendation:** Ubuntu 22.04 or 24.04 LTS, **$10–20/mo** (2 GB RAM minimum; 4 GB preferred for `next build` on-box)

> **New server?** Start here first → **[FRESH_SERVER_SETUP.md](./FRESH_SERVER_SETUP.md)**  
> (OS update, GitHub deploy key, Node/Nginx/PM2, then clone + deploy)

---

## Architecture on Lightsail

```
Internet → Lightsail static IP
              ↓
         Nginx (:80/:443)
              ↓
         Next.js via PM2 (:3000)
              ↓
    Docker PostgreSQL on 127.0.0.1:5432  ← recommended
```

Postgres runs in Docker on the **same instance**, bound to localhost only (not opened in Lightsail networking).

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
3. **Docker Engine + Compose** (for PostgreSQL)  
4. **Node.js 22**  
5. **PM2** + systemd startup  
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
```

```bash
bash deploy/scripts/db-up.sh      # starts postgres container
bash deploy/scripts/deploy.sh     # migrate, seed, build, PM2 (also ensures DB is up)
```

Useful commands:

```bash
docker compose ps postgres
docker compose logs -f postgres
npm run db:down                   # stop DB (keeps volume)
pm2 status
pm2 logs influrios
```

Visit `http://STATIC_IP` — you should see the Influrios home page.

### Back up Docker Postgres data

```bash
# Logical dump
docker compose exec -T postgres pg_dump -U influrios influrios > backup-$(date +%F).sql

# Or snapshot the Lightsail instance periodically (includes Docker volume disk)
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

5. Update `.env` `NEXT_PUBLIC_APP_URL` to `https://your-domain.com` and `pm2 restart influrios`

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
| DB backups | `pg_dump` on a schedule + Lightsail instance snapshots |
| Updates | `sudo apt-get update && sudo apt-get upgrade` monthly |
| Logs | `pm2 logs` · `docker compose logs postgres` · `/var/log/nginx/` |
| Health | `curl -I https://your-domain.com` · `docker compose ps` |

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
