# Fresh AWS Lightsail Server Setup (GitHub + System Update)

Use this checklist on a **brand-new** Ubuntu Lightsail instance before deploying Influrios.

**Goal:** update the OS → harden basics → connect GitHub → install runtime → clone the repo.

Estimated hands-on time: ~20–30 minutes.

---

## 0. What you need ready

| Item | Notes |
|------|--------|
| Lightsail Ubuntu 22.04 or **24.04** instance | 2 GB RAM min; **4 GB recommended** |
| Static IP attached | Lightsail → Networking |
| Ports open | **22**, **80**, **443** on the instance firewall |
| Lightsail SSH key (`.pem`) on your laptop | Account → Account → SSH keys, or download when created |
| GitHub access to `getnuevetech/Influrios` | Your user must be able to read the repo (private or public) |

---

## 1. Create / confirm the Lightsail instance

If the instance does not exist yet:

1. AWS Console → **Lightsail** → **Create instance**
2. **Linux/Unix** → **OS Only** → **Ubuntu 24.04 LTS**
3. Pick a plan (prefer **$12–$20 / 2–4 GB**)
4. Name it e.g. `influrios-web-1` → Create
5. **Networking** → Create **static IP** → attach to the instance
6. Instance → **Networking** → allow TCP **22**, **80**, **443**

Copy the **static IP** (example below uses `STATIC_IP`).

---

## 2. First SSH login from your laptop

```bash
# Fix key permissions (once)
chmod 400 ~/Downloads/LightsailDefaultKey-*.pem

# Connect (user on Ubuntu Lightsail is usually "ubuntu")
ssh -i ~/Downloads/LightsailDefaultKey-REGION.pem ubuntu@STATIC_IP
```

If SSH fails: confirm port 22 is open on the Lightsail firewall and that you are using the key for that region/account.

---

## 3. Update the fresh server (do this first)

On the server:

```bash
sudo apt-get update -y
sudo DEBIAN_FRONTEND=noninteractive apt-get upgrade -y
sudo apt-get install -y \
  ca-certificates curl gnupg build-essential git \
  ufw fail2ban unzip software-properties-common

# Optional but recommended reboot after first big upgrade
sudo reboot
```

Reconnect after reboot:

```bash
ssh -i ~/Downloads/LightsailDefaultKey-REGION.pem ubuntu@STATIC_IP
```

Confirm:

```bash
uname -a
cat /etc/os-release | head -5
```

---

## 4. Basic firewall (host-level)

Lightsail has its own networking firewall; also enable UFW on the OS:

```bash
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'   # 80 + 443 (safe even before Nginx is installed)
sudo ufw --force enable
sudo ufw status
```

---

## 5. Connect this server to GitHub (SSH deploy key)

Use a **deploy key** (read-only) so the server can `git clone` / `git pull` without your personal password.

### 5.1 Generate a key **on the server**

```bash
# Run as ubuntu user (do not use sudo here)
ssh-keygen -t ed25519 -C "influrios-lightsail-deploy" -f ~/.ssh/influrios_github -N ""

# Show the PUBLIC key — you will paste this into GitHub
cat ~/.ssh/influrios_github.pub
```

### 5.2 Tell SSH to use that key for GitHub

```bash
cat >> ~/.ssh/config <<'EOF'
Host github.com
  HostName github.com
  User git
  IdentityFile ~/.ssh/influrios_github
  IdentitiesOnly yes
EOF

chmod 600 ~/.ssh/config
```

### 5.3 Add the deploy key in GitHub

1. Open: https://github.com/getnuevetech/Influrios/settings/keys  
   (Repo → **Settings** → **Deploy keys** → **Add deploy key**)
2. Title: `influrios-lightsail-web-1`
3. Key: paste contents of `~/.ssh/influrios_github.pub`
4. Leave **Allow write access** unchecked (read-only is enough for deploy)
5. Add key

> Org/repo admin permission is required. If you cannot open Settings, ask a GitHub admin to add the deploy key, or use a fine-grained personal access token instead (see §5.5).

### 5.4 Test GitHub access from the server

```bash
ssh -T git@github.com
```

Expected (success):

```text
Hi getnuevetech/Influrios! You've successfully authenticated, but GitHub does not provide shell access.
```

Or for user-linked keys: `Hi <username>! You've successfully authenticated...`

### 5.5 Alternative: HTTPS + Personal Access Token (if deploy keys are blocked)

```bash
# On your laptop: GitHub → Settings → Developer settings → Fine-grained token
# Permission: Contents = Read-only on Influrios

# On the server, clone with token when prompted (or embed once — less ideal):
git clone https://github.com/getnuevetech/Influrios.git /var/www/influrios
# Username: your-github-username
# Password: the PAT (not your GitHub password)
```

Prefer SSH deploy keys for servers.

---

## 6. Install host tooling (Node optional, Nginx required)

Still on the server. **The Next.js app runs in Docker Compose — do not install or use PM2 for Influrios.**

```bash
# Node.js 22 (optional — useful for host-side prisma/tsx tooling)
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs
node -v   # should show v22.x
npm -v

# Web server (proxies to Compose web on 127.0.0.1:3000)
sudo apt-get install -y nginx
sudo systemctl enable nginx
sudo systemctl start nginx
```

Docker is installed by `deploy/scripts/setup-lightsail.sh` in §8.
---

## 7. Clone the Influrios repo

```bash
sudo mkdir -p /var/www/influrios
sudo chown -R ubuntu:ubuntu /var/www/influrios

git clone git@github.com:getnuevetech/Influrios.git /var/www/influrios
cd /var/www/influrios

git checkout main
git pull
```

Verify:

```bash
ls
git remote -v
git status
```

---

## 8. Finish Influrios server wiring (scripted)

From the repo:

```bash
cd /var/www/influrios
chmod +x deploy/scripts/*.sh
bash deploy/scripts/setup-lightsail.sh
```

This installs **Docker** (Postgres + Next.js web) and Nginx → `127.0.0.1:3000`. **PM2 is not used.**

After first Docker install, refresh group membership:

```bash
newgrp docker
docker ps   # should work without sudo
```

---

## 9. Environment + Docker stack + first deploy

```bash
cd /var/www/influrios
cp .env.example .env
nano .env
```

```env
NEXT_PUBLIC_APP_URL=http://STATIC_IP
POSTGRES_USER=influrios
POSTGRES_PASSWORD=pick-a-strong-password
POSTGRES_DB=influrios
DATABASE_URL="postgresql://influrios:pick-a-strong-password@127.0.0.1:5432/influrios?schema=public"
```

(`127.0.0.1` is for host tools. The web container uses Docker hostname `postgres` automatically.)

```bash
# Optional: remove a leftover host PM2 process from older installs
# pm2 delete influrios 2>/dev/null || true
bash deploy/scripts/deploy.sh              # docker compose up -d --build
```

```bash
docker compose ps
docker compose logs -f web
curl -fsS http://127.0.0.1:3000/api/health
curl -I http://STATIC_IP
```

### Backups

```bash
bash deploy/scripts/backup-postgres.sh
# Restore drill (stops web): bash deploy/scripts/restore-postgres.sh /var/backups/influrios/influrios-….sql.gz
```
---

## 10. Ongoing updates from GitHub

```bash
cd /var/www/influrios
git pull origin main
bash deploy/scripts/deploy.sh
```

---

## 11. Domain + HTTPS (after DNS works)

1. DNS A record `@` and `www` → static IP  
2. Edit `/etc/nginx/sites-available/influrios` → set:

```nginx
server_name influrios.com www.influrios.com;
```

3. `sudo nginx -t && sudo systemctl reload nginx`  
4. Certbot:

```bash
sudo apt-get install -y certbot python3-certbot-nginx
sudo certbot --nginx -d influrios.com -d www.influrios.com
```

<<<<<<< HEAD
If the cert was **issued** but install failed (`matching server block`):

```bash
sudo nginx -t && sudo systemctl reload nginx
sudo certbot install --cert-name influrios.com --nginx
```

5. Set `NEXT_PUBLIC_APP_URL=https://influrios.com` in `.env` → `bash deploy/scripts/deploy.sh`  
6. `curl -I https://influrios.com`
=======
5. Set `NEXT_PUBLIC_APP_URL=https://your-domain.com` in `.env` → `bash deploy/scripts/deploy.sh`  
6. Confirm `curl -fsS https://your-domain.com/api/health` returns `"ok": true`
>>>>>>> origin/main

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| `Permission denied (publickey)` to GitHub | Deploy key not added, or wrong `IdentityFile` in `~/.ssh/config` |
| `Repository not found` | Deploy key is on wrong repo, or no access to private repo |
| `npm run build` killed / OOM | Pull latest `main` (needs `DOCKER_BUILD=1` in the Dockerfile). `deploy.sh` adds 2 GB swap and skips eslint/tsc inside the image build (CI covers those). Confirm `swapon --show` and `grep DOCKER_BUILD Dockerfile`. If still killed, move to a 4 GB instance |
| Dockerfile build exits 1 after `OK: SWC musl` | The native compiler loaded. The failure is the Next build, usually a type error printed just above `BUILD FAILED`. Pull main and rebuild |
| Site 502 Bad Gateway | App not running: `docker compose ps` / `docker compose logs web` · `bash deploy/scripts/diagnose-502.sh` |
| Health not green | `curl -fsS http://127.0.0.1:3000/api/health` · check Postgres: `docker compose logs postgres` |
| Cannot SSH to Lightsail | Check Lightsail networking port 22 + correct `.pem` |
| `permission denied` for docker | Run `newgrp docker` or re-SSH after `usermod -aG docker` |
| Postgres not ready | `docker compose logs postgres` · check password match in `.env` |
| Prisma can't connect | Confirm `DATABASE_URL` uses `127.0.0.1` and container is healthy |
| `Cannot find package 'c12'` or `effect` during migrate | Pull main and rebuild the web image. The runner copies the Prisma CLI loader packages; an older image stops before it can migrate |
| Admin save says a Server Action was not found | The open page is from an older image. Reload the page and enter the details again. `deploy.sh` keeps one `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` so the next image build does not change those ids |

---

## Quick copy-paste order (summary)

```text
1. SSH into new instance
2. apt update && apt upgrade && reboot
3. ufw allow OpenSSH + Nginx Full
4. ssh-keygen deploy key → add to GitHub Deploy keys
5. ssh -T git@github.com   (confirm)
6. git clone → /var/www/influrios
7. bash deploy/scripts/setup-lightsail.sh   # Docker + Nginx (Compose runs the app)
8. newgrp docker
9. `.env` with `POSTGRES_*`, `DATABASE_URL`, `AUTH_SECRET`, `ADMIN_SESSION_SECRET`, `ADMIN_SUPER_EMAIL`, `ADMIN_SUPER_PASSWORD`
10. `bash deploy/scripts/db-up.sh && bash deploy/scripts/deploy.sh`
11. DNS + certbot → set `NEXT_PUBLIC_APP_URL=https://…` → redeploy
12. `curl -fsS https://your-domain.com/api/health`

Admin login uses Postgres (`AdminUser`); volumes: `influrios_uploads` required for banners, `influrios_data` only for remaining JSON demos.
```

Full app architecture notes: [AWS_LIGHTSAIL.md](./AWS_LIGHTSAIL.md)  
Staging launch integrations (SMTP / Stripe / social / marketplace): [STAGING_LAUNCH_INTEGRATIONS.md](./STAGING_LAUNCH_INTEGRATIONS.md)
