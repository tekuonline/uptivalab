#!/bin/bash

# Start Playwright remote browser service
# This script must be run from the project directory

set -e

echo "Starting Playwright remote browser service..."

# Use docker compose (the command that worked in previous terminals)
export PATH="/usr/local/bin:$PATH"

# Check if running from correct directory
if [ ! -f "docker-compose.yml" ]; then
    echo "Error: Must run from project root directory"
    exit 1
fi

# Start playwright service
/usr/local/bin/docker compose up -d playwright

echo "Playwright service started successfully!"
echo "WebSocket endpoint: ws://localhost:9222/"
echo ""
echo "To check status: docker compose ps playwright"
echo "To view logs: docker compose logs -f playwright"
