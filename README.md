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

- [Implementation plan (current)](./docs/IMPLEMENTATION_PLAN.md)
- [Recommendations & Execution Plan](./docs/RECOMMENDATIONS_AND_EXECUTION_PLAN.md)
- [Strategy notes](./docs/strategy/)
- [Design references](./docs/design-references/)
- [Lightsail guide](./docs/deploy/AWS_LIGHTSAIL.md)

## Phase 1 surfaces (this branch)

| Route | Purpose |
|-------|---------|
| `/` | Home / search hero |
| `/discover` | Specialty search |
| `/creators/[slug]` | Influence profile |
| `/c/[slug]` | Vertical Influencer Card (tier-aware) |
| `/card` | Card marketing |
| `/claim` | Draft → claim → verify → publish (Phase 8) |
| `/dashboard` | Creator completeness dashboard (Phase 8) |
| `/collaboration` | Match preview (Phase 2 stub) |

Production branding: **Influrios** only.
