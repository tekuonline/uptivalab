# syntax=docker/dockerfile:1.7
FROM node:20-slim AS builder
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable
WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/web/package.json apps/web/package.json
COPY packages/shared/package.json packages/shared/package.json

RUN pnpm install --frozen-lockfile

COPY . .
RUN pnpm --filter @uptivalab/shared build \
    && pnpm --filter uptivalab-web build

FROM nginx:1.27-alpine AS runtime
COPY apps/web/entrypoint.sh /usr/local/bin/custom-entrypoint.sh
RUN chmod +x /usr/local/bin/custom-entrypoint.sh
COPY apps/web/nginx-main.conf /etc/nginx/nginx.conf
COPY apps/web/nginx.conf.template /etc/nginx/conf.d/default.conf
COPY --from=builder /app/apps/web/dist /usr/share/nginx/html
EXPOSE 80
ENTRYPOINT ["/usr/local/bin/custom-entrypoint.sh"]
