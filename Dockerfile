# API image — apps/api (Express + Prisma).
#
# Runs straight from TS source via tsx (no compiled dist yet — see README.md
# "Running it right now"). devDependencies are deliberately installed: tsx is
# what runs the app, and the prisma CLI is what `migrate deploy` needs at
# release time.
FROM node:22-slim

WORKDIR /app

# Prisma's query engine needs openssl; node:22-slim doesn't ship it.
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

# Only manifests first, so `npm ci` is cached whenever a commit touches app
# source but no package.json/package-lock.json — which is most commits. This
# needs every workspace's package.json individually (npm workspaces resolves
# the whole graph from the root install), listed explicitly rather than via a
# wildcard COPY so it works on any BuildKit version, not just ones new enough
# for `COPY --parents`.
COPY package.json package-lock.json tsconfig.base.json tsconfig.json ./
COPY packages/api-contracts/package.json ./packages/api-contracts/
COPY packages/asset/package.json ./packages/asset/
COPY packages/audit/package.json ./packages/audit/
COPY packages/compliance/package.json ./packages/compliance/
COPY packages/event-contracts/package.json ./packages/event-contracts/
COPY packages/financial/package.json ./packages/financial/
COPY packages/identity/package.json ./packages/identity/
COPY packages/logger/package.json ./packages/logger/
COPY packages/notification/package.json ./packages/notification/
COPY packages/quantum/package.json ./packages/quantum/
COPY packages/risk/package.json ./packages/risk/
COPY packages/shared-kernel/package.json ./packages/shared-kernel/
COPY apps/api/package.json ./apps/api/
COPY apps/worker/package.json ./apps/worker/

RUN npm ci --no-audit --no-fund

# Now the actual source — changes here don't invalidate npm ci above.
COPY prisma ./prisma
COPY packages ./packages
COPY apps ./apps

RUN npx prisma generate

# Set after npm ci so devDependencies (tsx, prisma) still install above.
ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000

CMD ["npx", "tsx", "apps/api/src/main.ts"]
