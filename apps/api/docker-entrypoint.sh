#!/bin/bash
set -e

echo "🚀 Starting UptivaLab API..."

# Run Prisma migrations
echo "📊 Running database migrations..."
npx prisma generate
npx prisma migrate deploy

echo "🚀 Starting API server (cloudflared will auto-start if configured in settings)..."

# Start the API server
exec node dist/index.js
