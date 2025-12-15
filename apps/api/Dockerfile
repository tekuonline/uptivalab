# syntax=docker/dockerfile:1.7
FROM node:20-slim AS base
RUN apt-get update -y \
    && apt-get install -y --no-install-recommends openssl libssl3 ca-certificates iputils-ping \
    && rm -rf /var/lib/apt/lists/*
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable
WORKDIR /app

# Pre-copy manifests for better layer caching
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/package.json
COPY packages/shared/package.json packages/shared/package.json
COPY packages/monitoring/package.json packages/monitoring/package.json

RUN pnpm install --frozen-lockfile

# Copy full workspace and build
COPY . .
# Generate Prisma Client with the new schema BEFORE building
RUN cd apps/api && npx prisma generate
RUN pnpm --filter @uptivalab/shared build \
    && pnpm --filter @uptivalab/monitoring build \
    && pnpm --filter uptivalab-api build \
    && pnpm deploy --filter uptivalab-api --prod /app/deploy

FROM node:20-slim AS runtime
RUN apt-get update -y \
    && apt-get install -y --no-install-recommends openssl libssl3 ca-certificates iputils-ping \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENV NODE_ENV=production

COPY --from=base /app/deploy ./
EXPOSE 8080

CMD ["sh", "-c", "npx prisma generate && npx prisma migrate deploy && node dist/index.js"]
