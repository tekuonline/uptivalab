#!/bin/bash
set -e

# Pre-install Firefox browser for Playwright (optimized)
export PLAYWRIGHT_BROWSERS_PATH=/ms-playwright
npx playwright install firefox --with-deps > /dev/null 2>&1 || true

# Run Prisma migrations
npx prisma generate
npx prisma migrate deploy

# Start the API server
exec node dist/index.js
