# API image — apps/api (Express + Prisma).
#
# Runs straight from TS source via tsx (no compiled dist yet — see README.md
# "Running it right now"). devDependencies are deliberately installed: tsx is
# what runs the app, and the prisma CLI is what `migrate deploy` needs at
# release time.
FROM node:22-slim

WORKDIR /app

# Prisma's query engine needs openssl; node:20-slim doesn't ship it.
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json tsconfig.base.json tsconfig.json ./
COPY prisma ./prisma
COPY packages ./packages
COPY apps ./apps

RUN npm ci --no-audit --no-fund
RUN npx prisma generate

# Set after npm ci so devDependencies (tsx, prisma) still install above.
ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000

CMD ["npx", "tsx", "apps/api/src/main.ts"]
