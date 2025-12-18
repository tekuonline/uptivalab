#!/bin/sh

# Substitute the API URL in index.html
sed -i 's|__VITE_API_URL__|'"$VITE_API_URL"'|g' /usr/share/nginx/html/index.html

# Start nginx
exec nginx -g 'daemon off;'