# syntax=docker/dockerfile:1

# ── Stage 1: installer ──────────────────────────────────────────────────────
# Run turbo prune to produce a minimal workspace snapshot containing only the
# packages needed by @lifting-logbook/api and their transitive dependencies.
FROM node:20.11.1-alpine AS installer
WORKDIR /app

COPY . .
RUN npx turbo prune --scope=@lifting-logbook/api --docker

# ── Stage 2: builder ─────────────────────────────────────────────────────────
# Install only the pruned dependency set, then compile TypeScript.
FROM node:20.11.1-alpine AS builder
WORKDIR /app

# Copy package manifests first for better layer caching.
COPY --from=installer /app/out/json/ .
COPY --from=installer /app/out/package-lock.json ./package-lock.json
RUN npm ci

# Copy full source and build.
COPY --from=installer /app/out/full/ .
# tsconfig.base.json lives at the repo root and is not a workspace package, so
# turbo prune --docker does not include it in out/full/. Every workspace tsconfig
# (packages/types, packages/core, apps/api) extends ../../tsconfig.base.json,
# so the build fails with TS5083 without this explicit copy.
COPY --from=installer /app/tsconfig.base.json ./tsconfig.base.json
# Generate the Prisma client from the schema before TypeScript compilation.
# Without this, tsc fails with TS2694 ("no exported member 'InputJsonValue'")
# because the .prisma/client/default scaffold installed by `npm ci` is empty
# until `prisma generate` runs against schema.prisma.
RUN npx prisma generate --schema=apps/api/prisma/schema.prisma
RUN npx turbo run build --filter=@lifting-logbook/api

# Install production-only dependencies for the final image. This is a fresh
# `npm ci` which destroys /app/node_modules and reinstalls — including the
# Prisma client generated above. We re-run `prisma generate` after to repopulate
# /app/node_modules/.prisma/client; without it, runtime fails with
# "Cannot find module '.prisma/client/default'".
RUN npm ci --omit=dev --workspace=@lifting-logbook/api
RUN npx prisma generate --schema=apps/api/prisma/schema.prisma

# ── Stage 3: runner ──────────────────────────────────────────────────────────
# Minimal production image: compiled output + production node_modules only.
FROM node:20.11.1-alpine AS runner
WORKDIR /app

# Non-root user for security.
RUN addgroup --system --gid 1001 nodejs \
 && adduser  --system --uid 1001 --ingroup nodejs nestjs

# Copy compiled output and production dependencies.
#
# Source for node_modules is /app/node_modules (the hoisted root tree), NOT
# /app/apps/api/node_modules. npm workspaces hoists most dependencies to the
# repo root; the workspace-local node_modules contains only conflict-resolution
# entries and is typically near-empty. Copying the workspace-local path leaves
# the runtime missing every hoisted dependency (e.g., @opentelemetry/sdk-node)
# and the container fails to start with "Cannot find module ...".
COPY --from=builder --chown=nestjs:nodejs /app/apps/api/dist ./dist
COPY --from=builder --chown=nestjs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nestjs:nodejs /app/apps/api/package.json ./package.json
# The Prisma client looks for the schema file at runtime to bind to the
# generated default-client. Include it so the client can self-locate.
COPY --from=builder --chown=nestjs:nodejs /app/apps/api/prisma ./prisma

USER nestjs

EXPOSE 3000
CMD ["node", "dist/main.js"]
