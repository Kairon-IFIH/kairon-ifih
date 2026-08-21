# Web image — apps/web (Vite + React SPA) built, then served by nginx.
#
# Build context is the REPO ROOT, not apps/web: this is an npm workspace, so
# `npm ci` needs the root lockfile and every workspace package.json to resolve
# the dependency graph — even though @kairon/web only actually imports its own
# dependencies (verified: no @kairon/* imports in apps/web/src).
#
# Node 22 LTS, not 20: vite 8 / oxlint require ^20.19.0 || >=22.12.0, and the
# node:20-slim tag sits right on that lower boundary.
FROM node:22-slim AS build

WORKDIR /app

# Only manifests first, so `npm ci` is cached whenever a commit touches app
# source but no package.json/package-lock.json — which is most commits.
COPY package.json package-lock.json tsconfig.base.json ./
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
COPY apps/web/package.json ./apps/web/

RUN npm ci --no-audit --no-fund

# Only web's own source is needed to build it — the other workspace members'
# source was never copied, only their manifests above.
COPY apps/web ./apps/web

# Vite inlines env vars at BUILD time, so the API URL is baked into the bundle
# here rather than read at runtime. Defaults to a same-origin relative path:
# nginx (below) proxies /api/ to the api container, which means the browser
# never needs to know the instance's public IP and CORS never comes into play.
ARG VITE_API_BASE_URL=/api/v1
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL

RUN npm run build --workspace @kairon/web

FROM nginx:1.27-alpine

COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/apps/web/dist /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -qO- http://localhost/healthz || exit 1
