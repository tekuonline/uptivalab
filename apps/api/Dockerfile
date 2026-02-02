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
# Clean dist folders before rebuilding
RUN rm -rf packages/*/dist apps/*/dist
# Generate Prisma Client with the new schema BEFORE building
RUN cd apps/api && npx prisma generate
# Build packages
RUN pnpm --filter @uptivalab/shared build \
    && pnpm --filter @uptivalab/monitoring build \
    && pnpm --filter uptivalab-api build

# Deploy creates pruned node_modules for production
RUN pnpm deploy --filter uptivalab-api --prod /app/deploy

# Copy built dist to deploy location AFTER pnpm deploy completes
RUN rm -rf /app/deploy/dist && cp -r apps/api/dist /app/deploy/dist

FROM node:20-slim AS runtime
RUN apt-get update -y \
    && apt-get install -y --no-install-recommends \
        openssl libssl3 ca-certificates iputils-ping curl \
        libnss3 libnspr4 libatk1.0-0 libatk-bridge2.0-0 libcups2 libdrm2 libxkbcommon0 \
        libxcomposite1 libxdamage1 libxfixes3 libxrandr2 libgbm1 libasound2 libpango-1.0-0 \
        libcairo2 libatspi2.0-0 \
        libdbus-glib-1-2 libxt6 libxcursor1 libgtk-3-0 libgdk-pixbuf-2.0-0 libpangocairo-1.0-0 \
        libcairo-gobject2 \
        libwoff1 libopus0 libwebpdemux2 libenchant-2-2 libsecret-1-0 libhyphen0 \
        libegl1 libnotify4 libxslt1.1 \
        libgstreamer1.0-0 libgstreamer-plugins-base1.0-0 \
        fonts-liberation fonts-noto-color-emoji fonts-unifont \
    && rm -rf /var/lib/apt/lists/*

# Install cloudflared (supports both amd64 and arm64)
RUN ARCH=$(dpkg --print-architecture) \
    && curl -L --output cloudflared.deb "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-${ARCH}.deb" \
    && dpkg -i cloudflared.deb \
    && rm cloudflared.deb

# Pre-install system dependencies for Playwright (browsers will be installed on-demand)
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright

WORKDIR /app
ENV NODE_ENV=production
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright

COPY --from=base /app/deploy ./

# Copy startup script
COPY apps/api/docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

EXPOSE 8080

ENTRYPOINT ["/docker-entrypoint.sh"]
