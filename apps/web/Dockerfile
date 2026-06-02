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
# tsconfig.base.json lives at the repo root and is not a workspace package, so
# turbo prune --docker does not include it in out/full/. packages/types (a
# dependency of web) extends ../../tsconfig.base.json and fails with TS5083
# without this explicit copy.
COPY --from=installer /app/tsconfig.base.json ./tsconfig.base.json
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
RUN npx turbo run build --filter=@lifting-logbook/web

# Build-time guard for #407: the staging deploy smoke probes /healthz and
# /api/healthz; both routes must reach the standalone output the runner stage
# copies in. If they're missing here, the image will 404 in production and the
# Deploy workflow stalls at the staging gate. Failing the build instead surfaces
# the regression at image-build time on every workflow (staging.yml PR builds
# and deploy.yml main builds), not after a 3-minute smoke timeout.
#
# Path layout is Next.js App Router with `output: standalone` (currently
# Next 16.2.4). If a future Next.js upgrade flattens route handlers from
# `app/<route>/route.js` directories to flat files, update this guard rather
# than trusting a false-positive trip.
RUN test -d /app/apps/web/.next/standalone/apps/web/.next/server/app/healthz \
 && test -d /app/apps/web/.next/standalone/apps/web/.next/server/app/api/healthz \
 || (echo "ERROR (#407): required healthz routes missing from .next/standalone build" && \
     ls -la /app/apps/web/.next/standalone/apps/web/.next/server/app && exit 1)

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
