# syntax=docker/dockerfile:1

# ── Stage 1: builder ─────────────────────────────────────────────────────────
# Copy the full repo, install all deps, generate Prisma client, build with
# turbo. We previously used `turbo prune --docker` to produce a minimal
# subset, but observed (PRs #310/#311) that the resulting tree dropped some
# transitive runtime deps (@fastify/multipart) — the most reliable behaviour
# is to skip the prune entirely. Image-size optimization is tracked in #310.
FROM node:20.11.1-alpine AS builder
WORKDIR /app

COPY . .
RUN npm ci

# Generate the Prisma client before TypeScript compilation. Without this,
# tsc fails with TS2694 ("no exported member 'InputJsonValue'") because the
# .prisma/client/default scaffold installed by `npm ci` is empty until
# `prisma generate` runs against schema.prisma.
RUN npx prisma generate --schema=apps/api/prisma/schema.prisma

RUN npx turbo run build --filter=@lifting-logbook/api

# ── Stage 2: runner ──────────────────────────────────────────────────────────
# Minimal production image: compiled output + full node_modules.
FROM node:20.11.1-alpine AS runner
WORKDIR /app

# Non-root user for security.
RUN addgroup --system --gid 1001 nodejs \
 && adduser  --system --uid 1001 --ingroup nodejs nestjs

# Copy compiled output, hoisted node_modules, and package metadata.
#
# Source for node_modules is /app/node_modules (the hoisted root tree). npm
# workspaces hoists most dependencies to the repo root; the workspace-local
# /app/apps/api/node_modules contains only conflict-resolution entries.
# Copying the workspace-local path would leave the runtime missing every
# hoisted dep (e.g., @opentelemetry/sdk-node).
#
# The Prisma client lives under /app/node_modules/.prisma/client and is
# carried along with this COPY.
COPY --from=builder --chown=nestjs:nodejs /app/apps/api/dist ./dist
COPY --from=builder --chown=nestjs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nestjs:nodejs /app/apps/api/package.json ./package.json
# The Prisma client looks for the schema file at runtime to bind to the
# generated default-client. Include it so the client can self-locate.
COPY --from=builder --chown=nestjs:nodejs /app/apps/api/prisma ./prisma

USER nestjs

EXPOSE 3000
CMD ["node", "dist/main.js"]
