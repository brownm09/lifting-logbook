# syntax=docker/dockerfile:1

# ── Stage 1: installer ──────────────────────────────────────────────────────
# Run turbo prune to produce a minimal workspace snapshot containing only the
# packages needed by @lifting-logbook/web and their transitive dependencies.
FROM node:20.11.1-alpine AS installer
WORKDIR /app

COPY . .
RUN npx turbo prune --scope=@lifting-logbook/web --docker

# ── Stage 2: builder ─────────────────────────────────────────────────────────
# Install only the pruned dependency set, then compile and build Next.js.
FROM node:20.11.1-alpine AS builder
WORKDIR /app

# Copy package manifests first for better layer caching.
COPY --from=installer /app/out/json/ .
COPY --from=installer /app/out/package-lock.json ./package-lock.json
RUN npm ci

# Copy full source and build.
COPY --from=installer /app/out/full/ .
RUN npx turbo run build --filter=@lifting-logbook/web

# ── Stage 3: runner ──────────────────────────────────────────────────────────
# Minimal production image using Next.js standalone output.
FROM node:20.11.1-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

# Non-root user for security.
RUN addgroup --system --gid 1001 nodejs \
 && adduser  --system --uid 1001 --ingroup nodejs nextjs

# Copy Next.js standalone output and static assets.
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/public ./apps/web/public

USER nextjs

EXPOSE 3001
ENV PORT=3001
CMD ["node", "apps/web/server.js"]
