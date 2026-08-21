# Web image — apps/web (Vite + React SPA) built, then served by nginx.
#
# Build context is the REPO ROOT, not apps/web: this is an npm workspace, so
# `npm ci` needs the root lockfile and every workspace package.json to resolve
# the dependency graph.
# Node 22 LTS, not 20: vite 8 / oxlint require ^20.19.0 || >=22.12.0, and the
# node:20-slim tag sits right on that lower boundary.
FROM node:22-slim AS build

WORKDIR /app

COPY package.json package-lock.json tsconfig.base.json ./
COPY packages ./packages
COPY apps ./apps

RUN npm ci --no-audit --no-fund

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
