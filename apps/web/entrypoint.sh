#!/bin/sh

# Substitute the API URL in index.html
sed -i 's|__VITE_API_URL__|'"$VITE_API_URL"'|g' /usr/share/nginx/html/index.html

# Substitute the API upstream in nginx config
API_UPSTREAM="${API_UPSTREAM:-http://api:8080}"
sed -i 's|__API_UPSTREAM__|'"$API_UPSTREAM"'|g' /etc/nginx/conf.d/default.conf

# Start nginx
exec nginx -g 'daemon off;'
