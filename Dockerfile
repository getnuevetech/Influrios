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
# One Node process (see next.config webpackBuildWorker: false).
# 1536 plus a second webpack worker exceeds a 2 GB Lightsail box and the
# kernel kills the build. 768 leaves room for Postgres and the OS; swap
# from deploy/scripts/ensure-swap.sh covers the rest.
ENV NODE_OPTIONS="--max-old-space-size=768"
# Dummy URL so Prisma generate succeeds during image build
ENV DATABASE_URL="postgresql://influrios:influrios@postgres:5432/influrios?schema=public"
RUN npx prisma generate
# Repeat the end of the build log on failure. Docker shows that tail, so a
# type error is visible instead of only the SWC directory listing.
RUN free -h || true \
  && node -e "require('@next/swc-linux-x64-musl'); console.log('OK: SWC musl')" \
  && (set -o pipefail; npm run build 2>&1 | tee /tmp/next-build.log) \
  || (echo "==== BUILD FAILED — diagnostics ===="; tail -n 80 /tmp/next-build.log || true; free -h || true; exit 1)

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
# Config loading then imports c12 even when no prisma.config.ts exists.
# c12 pulls its own loader packages, including the nested copies npm kept
# inside c12, nypm, and pkg-types.
COPY --from=builder /app/node_modules/effect ./node_modules/effect
COPY --from=builder /app/node_modules/fast-check ./node_modules/fast-check
COPY --from=builder /app/node_modules/pure-rand ./node_modules/pure-rand
COPY --from=builder /app/node_modules/empathic ./node_modules/empathic
COPY --from=builder /app/node_modules/@standard-schema ./node_modules/@standard-schema
COPY --from=builder /app/node_modules/c12 ./node_modules/c12
COPY --from=builder /app/node_modules/deepmerge-ts ./node_modules/deepmerge-ts
COPY --from=builder /app/node_modules/chokidar ./node_modules/chokidar
COPY --from=builder /app/node_modules/citty ./node_modules/citty
COPY --from=builder /app/node_modules/confbox ./node_modules/confbox
COPY --from=builder /app/node_modules/consola ./node_modules/consola
COPY --from=builder /app/node_modules/defu ./node_modules/defu
COPY --from=builder /app/node_modules/destr ./node_modules/destr
COPY --from=builder /app/node_modules/dotenv ./node_modules/dotenv
COPY --from=builder /app/node_modules/exsolve ./node_modules/exsolve
COPY --from=builder /app/node_modules/giget ./node_modules/giget
COPY --from=builder /app/node_modules/jiti ./node_modules/jiti
COPY --from=builder /app/node_modules/node-fetch-native ./node_modules/node-fetch-native
COPY --from=builder /app/node_modules/nypm ./node_modules/nypm
COPY --from=builder /app/node_modules/ohash ./node_modules/ohash
COPY --from=builder /app/node_modules/pathe ./node_modules/pathe
COPY --from=builder /app/node_modules/perfect-debounce ./node_modules/perfect-debounce
COPY --from=builder /app/node_modules/pkg-types ./node_modules/pkg-types
COPY --from=builder /app/node_modules/rc9 ./node_modules/rc9
COPY --from=builder /app/node_modules/readdirp ./node_modules/readdirp
COPY --from=builder /app/node_modules/tinyexec ./node_modules/tinyexec
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
