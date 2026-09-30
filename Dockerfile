# Influrios Next.js — multi-stage production image
FROM node:22-alpine AS deps
WORKDIR /app
RUN apk add --no-cache libc6-compat openssl
COPY package.json package-lock.json ./
COPY prisma ./prisma
# Install ALL deps (Tailwind/PostCSS needed at build time)
# Explicitly keep optional native SWC for Alpine (musl) — avoids WASM OOM fallback
RUN npm ci --include=optional \
  && node -e "require('@next/swc-linux-x64-musl'); console.log('OK: native SWC musl present')"

FROM node:22-alpine AS builder
WORKDIR /app
RUN apk add --no-cache libc6-compat openssl
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
# Modest heap — oversized heaps get killed on 1–2GB Lightsail boxes
ENV NODE_OPTIONS="--max-old-space-size=1536"
# Dummy URL so Prisma generate succeeds during image build
ENV DATABASE_URL="postgresql://influrios:influrios@postgres:5432/influrios?schema=public"
RUN npx prisma generate
# Surface memory + SWC diagnostics if webpack fails
RUN free -h || true \
  && node -e "require('@next/swc-linux-x64-musl'); console.log('OK: SWC musl')" \
  && npm run build \
  || (echo "==== BUILD FAILED — diagnostics ===="; free -h || true; ls -la node_modules/@next 2>/dev/null || true; exit 1)

FROM node:22-alpine AS runner
WORKDIR /app
RUN apk add --no-cache libc6-compat openssl curl su-exec
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder /app/package.json ./package.json
# Standalone server. Its traced node_modules can omit the Prisma CLI and
# replace a complete generated client, so Prisma is copied after this.
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder /app/node_modules/prisma ./node_modules/prisma
# @prisma/config requires these from node_modules root at CLI startup.
# Copying only @prisma and prisma leaves `effect` missing, so migrate deploy
# and db push exit before they can touch the database.
COPY --from=builder /app/node_modules/effect ./node_modules/effect
COPY --from=builder /app/node_modules/fast-check ./node_modules/fast-check
COPY --from=builder /app/node_modules/pure-rand ./node_modules/pure-rand
COPY --from=builder /app/node_modules/empathic ./node_modules/empathic
COPY --from=builder /app/node_modules/@standard-schema ./node_modules/@standard-schema
# The CLI bin is a symlink. Recreate it so a traced standalone .bin cannot drop it.
RUN mkdir -p ./node_modules/.bin \
  && ln -sf ../prisma/build/index.js ./node_modules/.bin/prisma \
  && chmod +x ./node_modules/prisma/build/index.js

COPY deploy/docker/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

# Entrypoint fixes volume ownership, migrates, then drops to nextjs.
USER root
EXPOSE 3000
ENTRYPOINT ["/entrypoint.sh"]
