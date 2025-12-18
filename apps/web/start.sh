#!/bin/sh
set -e
# Generate config.json from API_URL env or fallback
API_URL="${API_URL:-http://localhost:8080}"
echo "{\n  \"API_URL\": \"$API_URL\"\n}" > /usr/share/nginx/html/config.json
exec nginx -g "daemon off;"