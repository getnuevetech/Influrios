# Influrios

**Influence Discovery & Collaboration Platform**  
*Find the right influence. Build the right collaboration.*

## Quick start (local)

```bash
cp .env.example .env          # set POSTGRES_PASSWORD + matching DATABASE_URL
npm run db:up                 # Docker Postgres on 127.0.0.1:5432
npm ci
npx prisma db push
npm run db:seed
npm run dev                   # http://localhost:3000
```

Database runs in **Docker** (see `docker-compose.yml`). UI seed data also works before Prisma is wired to pages.

## AWS Lightsail deploy

**New / fresh server (GitHub + OS update + Docker DB):**  
→ **[docs/deploy/FRESH_SERVER_SETUP.md](./docs/deploy/FRESH_SERVER_SETUP.md)**

```bash
# After GitHub SSH works and repo is cloned to /var/www/influrios:
bash deploy/scripts/setup-lightsail.sh   # installs Docker + Node + Nginx + PM2
newgrp docker
cp .env.example .env                     # strong POSTGRES_PASSWORD + DATABASE_URL
bash deploy/scripts/db-up.sh             # start Postgres container
bash deploy/scripts/deploy.sh
```

## Docs

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
| `/claim` | Value-before-signup entry |
| `/collaboration` | Match preview (Phase 2 stub) |

Production branding: **Influrios** only.
