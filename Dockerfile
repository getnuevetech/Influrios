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
RUN apk add --no-cache libc6-compat openssl curl
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder /app/node_modules/prisma ./node_modules/prisma
COPY --from=builder /app/node_modules/.bin ./node_modules/.bin
# Standalone server
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

COPY deploy/docker/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

USER nextjs
EXPOSE 3000
ENTRYPOINT ["/entrypoint.sh"]
