# Influrios

**Influence Discovery & Collaboration Platform**  
*Find the right influence. Build the right collaboration.*

## Quick start (local)

```bash
docker compose up -d          # Postgres
cp .env.example .env
npm ci
npx prisma db push
npm run db:seed
npm run dev                   # http://localhost:3000
```

UI works from seed data even without Postgres; Prisma is ready for claim/auth next.

## AWS Lightsail deploy

**New / fresh server (GitHub + OS update):**  
→ **[docs/deploy/FRESH_SERVER_SETUP.md](./docs/deploy/FRESH_SERVER_SETUP.md)**

Full architecture + DB checklist:  
→ **[docs/deploy/AWS_LIGHTSAIL.md](./docs/deploy/AWS_LIGHTSAIL.md)**

```bash
# After GitHub SSH works and repo is cloned to /var/www/influrios:
bash deploy/scripts/setup-lightsail.sh
cp .env.example .env   # set DATABASE_URL + NEXT_PUBLIC_APP_URL
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
