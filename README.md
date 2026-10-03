# Influrios

**Influence Discovery & Collaboration Platform**  
*Find the right influence. Build the right collaboration.*

## Quick start (local)

```bash
cp .env.example .env          # set POSTGRES_PASSWORD + NEXT_PUBLIC_APP_URL
docker compose up -d --build  # Postgres + Next.js web
# open http://localhost:3000
```

Optional host tooling (seed against published DB port):

```bash
npm ci
npx prisma db push
npm run db:seed
```

## Why Docker (not PM2)?

The app and database both run in **Docker Compose**. Nginx on the host proxies to `127.0.0.1:3000`.

PM2 was an earlier host process manager; it caused incomplete builds / missing Tailwind deps on the server. Docker builds the app in a clean image with all build dependencies included.

## AWS Lightsail deploy

→ **[docs/deploy/FRESH_SERVER_SETUP.md](./docs/deploy/FRESH_SERVER_SETUP.md)**

```bash
bash deploy/scripts/setup-lightsail.sh   # Docker + Nginx
newgrp docker
cp .env.example .env                     # POSTGRES_PASSWORD + NEXT_PUBLIC_APP_URL=http://YOUR_IP
bash deploy/scripts/deploy.sh            # docker compose up --build
```

## Docs

- **[Development state & next plan](./docs/DEVELOPMENT_STATE_AND_NEXT_PLAN.md)** — **current sequencing** (Phases J–O, what to build next)
- [Implementation plan](./docs/IMPLEMENTATION_PLAN.md) — Phases A–I + 12.x log; §3 gap matrix is **historical**
- [Recommendations & Execution Plan](./docs/RECOMMENDATIONS_AND_EXECUTION_PLAN.md) — historical product backlog
- [Strategy notes](./docs/strategy/)
- [Design references](./docs/design-references/)
- [Lightsail guide](./docs/deploy/AWS_LIGHTSAIL.md)
- [Staging launch integrations (Phase M)](./docs/deploy/STAGING_LAUNCH_INTEGRATIONS.md) — `npm run staging:checklist` / `npm run staging:evidence-probe`

## Current surfaces

| Route | Purpose |
|-------|---------|
| `/` | Home / search hero |
| `/discover` | Specialty search (Postgres directory) |
| `/creators/[slug]` | Influence profile |
| `/c/[slug]` | Vertical Influencer Card (tier-aware) |
| `/card` | Card marketing |
| `/claim` | Draft → claim → verify → publish |
| `/dashboard` | Creator completeness dashboard |
| `/collaboration` | Creator↔creator matching & proposals |
| `/business` | Business briefs / shortlists |
| `/billing` | Plan checkout (Stripe or demo) |
| `/payments` | Marketplace prefund / milestones |
| `/admin` | Ops console (plans, CMS, providers, ledger, …) |

Production branding: **Influrios** only.
