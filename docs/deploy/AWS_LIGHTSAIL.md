# AWS Lightsail — Server Preparation & Deploy Guide

**Target:** Influrios Phase 0/1 (Next.js + PostgreSQL + Nginx + PM2)  
**Instance recommendation:** Ubuntu 22.04 or 24.04 LTS, **$10–20/mo** (2 GB RAM minimum; 4 GB preferred for `next build` on-box)

---

## Architecture on Lightsail

```
Internet → Lightsail static IP
              ↓
         Nginx (:80/:443)
              ↓
         Next.js via PM2 (:3000)
              ↓
    Lightsail managed PostgreSQL  (recommended)
    — or — Postgres on the same instance (dev only)
```

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

Do **not** expose Postgres (`5432`) to `0.0.0.0/0`.

### 4. Create a managed PostgreSQL database (recommended)

1. Lightsail → **Databases** → **Create database**
2. Engine: **PostgreSQL 16** (or latest available)
3. Plan: smallest is fine for Phase 1
4. Master username / password — store in a password manager
5. After creation, note:
   - Endpoint hostname
   - Port (`5432`)
   - Soften firewall: allow your **web instance** only

Create the app database (from any machine that can reach the DB, or via `psql` tunnel):

```bash
psql "postgresql://USER:PASSWORD@ENDPOINT:5432/postgres" \
  -c 'CREATE DATABASE influrios;'
```

`DATABASE_URL` format:

```
postgresql://USER:PASSWORD@ENDPOINT:5432/influrios?schema=public&sslmode=require
```

### 5. SSH key access

Download the Lightsail default key (or use your own uploaded key), then:

```bash
chmod 400 ~/LightsailDefaultKey-*.pem
ssh -i ~/LightsailDefaultKey-REGION.pem ubuntu@STATIC_IP
```

---

## B. Prepare the server (one-time)

From your laptop (with the repo checked out), or after cloning on the server:

```bash
# On the Lightsail instance:
git clone https://github.com/getnuevetech/Influrios.git /var/www/influrios
cd /var/www/influrios
git checkout cursor/phase-0-1-mvp-lightsail-0127   # or main once merged

chmod +x deploy/scripts/*.sh
bash deploy/scripts/setup-lightsail.sh
```

What `setup-lightsail.sh` installs:

1. `apt` updates + build tools  
2. UFW firewall (SSH + Nginx)  
3. **Node.js 22** (Nodesource)  
4. **PM2** + systemd startup  
5. `/var/www/influrios` ownership  
6. **Nginx** reverse proxy to `127.0.0.1:3000`

---

## C. Configure environment & first deploy

```bash
cd /var/www/influrios
cp .env.example .env
nano .env
```

Set at minimum:

```env
NODE_ENV=production
PORT=3000
NEXT_PUBLIC_APP_URL=https://your-domain.com
DATABASE_URL=postgresql://USER:PASSWORD@ENDPOINT:5432/influrios?schema=public&sslmode=require
```

Deploy:

```bash
bash deploy/scripts/deploy.sh
```

This runs `npm ci` → Prisma migrate/push → seed → `next build` → `pm2 startOrReload`.

Useful PM2 commands:

```bash
pm2 status
pm2 logs influrios
pm2 restart influrios
```

Visit `http://STATIC_IP` — you should see the Influrios home page.

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
git pull
bash deploy/scripts/deploy.sh
```

Optional: add a GitHub Action that SSHes and runs `deploy.sh` (wire secrets later).

---

## F. Local development (before / alongside Lightsail)

```bash
# Terminal 1 — Postgres
docker compose up -d

# Terminal 2 — app
cp .env.example .env
# DATABASE_URL already matches docker-compose defaults
npm ci
npx prisma db push
npm run db:seed
npm run dev
```

Open http://localhost:3000

> UI pages currently read from `src/lib/seed-data.ts` so the app runs even before Postgres is up. Prisma schema + seed prepare the real database for Phase 1 claim/auth work.

---

## G. Server sizing & ops checklist

| Item | Guidance |
|------|----------|
| RAM | Prefer 4 GB if building on the instance; or build CI artifacts and copy `.next` |
| Swap | If on 2 GB: `sudo fallocate -l 2G /swapfile && sudo chmod 600 /swapfile && sudo mkswap /swapfile && sudo swapon /swapfile` |
| Backups | Enable Lightsail DB automatic snapshots |
| Updates | `sudo apt-get update && sudo apt-get upgrade` monthly |
| Logs | `pm2 logs` + `/var/log/nginx/` |
| Health | `curl -I https://your-domain.com` |

---

## H. Security baseline

- [ ] SSH key only (disable password auth)  
- [ ] UFW enabled  
- [ ] Postgres not public  
- [ ] `.env` permissions: `chmod 600 .env`  
- [ ] fail2ban installed by setup script  
- [ ] HTTPS via Certbot before any real user data  
- [ ] Do not commit `.env` or Lightsail PEM keys  

---

## I. Phase 1 readiness after server is live

Once the instance serves the app:

1. Wire auth (Clerk / Auth.js)  
2. Switch Discover/Profile reads from seed → Prisma  
3. Implement draft → claim → verify → publish  
4. Plus shortlink + standard QR routes  
5. Admin invite links  

See [RECOMMENDATIONS_AND_EXECUTION_PLAN.md](../RECOMMENDATIONS_AND_EXECUTION_PLAN.md) §7–§13.
