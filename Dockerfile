FROM node:20-alpine AS base

# OpenSSL — Prisma engine için gerekli
RUN apk add --no-cache openssl

# ── deps: sadece bağımlılıkları yükle ──────────────────────────────────────
FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci

# ── builder: uygulamayı derle ───────────────────────────────────────────────
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate
RUN npm run build

# ── migrate: prisma migrate deploy için minimal stage ──────────────────────
FROM base AS migrate
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY prisma ./prisma
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs
USER nextjs
CMD ["node_modules/.bin/prisma", "migrate", "deploy"]

# ── worker: BullMQ worker (deps stage'ini PAYLAŞIR — ayrı npm ci YOK) ───────
# Eskiden ayrı Dockerfile.worker kendi `npm ci`'ını çalıştırıyordu → app build'i
# (next build, ~3GB) ile PARALEL ikinci ağır npm ci = 8GB VPS'te build OOM (exit 255,
# "Collecting build traces" anında kernel OOM-kill). Artık worker, app/migrate ile aynı
# `deps` stage'ini kullanır → npm ci tek sefer çalışır, paralel bellek zirvesi düşer.
FROM base AS worker
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate
ENV NODE_ENV=production
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 worker
USER worker
CMD ["npx", "tsx", "worker/index.ts"]

# ── runner: minimal üretim imajı ───────────────────────────────────────────
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production

# Next.js standalone çıktısını kopyala
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

# Non-root kullanıcı (güvenlik)
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs
USER nextjs

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
