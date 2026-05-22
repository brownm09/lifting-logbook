# syntax=docker/dockerfile:1

# ── Stage 1: builder ─────────────────────────────────────────────────────────
# Copy the full repo, install all deps, generate Prisma client, build with
# turbo. We previously used `turbo prune --docker` to produce a minimal
# subset, but observed that the resulting tree dropped some transitive
# runtime deps — the most reliable behaviour is to skip the prune entirely.
# Image-size optimization is tracked in #310.
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
# Minimal production image: compiled output + node_modules at both root and
# workspace level (npm workspaces hoists most deps to root, but some don't
# hoist because of version conflicts — e.g., @fastify/multipart lives at
# /app/apps/api/node_modules, not /app/node_modules). We preserve the full
# monorepo directory layout so node's module resolution walks both paths.
FROM node:20.11.1-alpine AS runner
WORKDIR /app

# Non-root user for security.
RUN addgroup --system --gid 1001 nodejs \
 && adduser  --system --uid 1001 --ingroup nodejs nestjs

# Copy the hoisted root node_modules.
COPY --from=builder --chown=nestjs:nodejs /app/node_modules ./node_modules

# Copy the api workspace tree under its real path so workspace-local
# node_modules (e.g., @fastify/multipart) is visible to node's module
# resolution walking up from /app/apps/api.
COPY --from=builder --chown=nestjs:nodejs /app/apps/api/dist ./apps/api/dist
COPY --from=builder --chown=nestjs:nodejs /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=builder --chown=nestjs:nodejs /app/apps/api/package.json ./apps/api/package.json
COPY --from=builder --chown=nestjs:nodejs /app/apps/api/prisma ./apps/api/prisma

USER nestjs

EXPOSE 3000

# Run from the workspace directory so node's module resolution starts at
# /app/apps/api/node_modules and walks up to /app/node_modules.
WORKDIR /app/apps/api
CMD ["node", "dist/main.js"]
