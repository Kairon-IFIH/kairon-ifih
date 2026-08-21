FROM node:20-slim

WORKDIR /app

COPY package.json package-lock.json ./
COPY tsconfig.base.json ./
COPY packages ./packages
COPY apps ./apps

RUN npm ci --no-audit --no-fund

ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000

# Hackathon-cut: runs straight from TS source via tsx (no compiled dist yet —
# see README.md "Running it right now"). Swap for `node dist/main.js` once
# the Phase 2 build pipeline lands; this CMD is the only line that changes.
CMD ["npx", "tsx", "apps/api/src/main.ts"]
