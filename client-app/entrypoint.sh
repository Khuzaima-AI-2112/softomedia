#!/bin/sh
set -e

# Generate runtime config as JavaScript
# This file is served by Nginx and loaded by index.html BEFORE the main app bundle
cat > /usr/share/nginx/html/config.js <<EOF
window.ENV = {
  VITE_API_URL: "${VITE_API_URL:-http://localhost:8080}",
  VITE_FIREBASE_API_KEY: "${VITE_FIREBASE_API_KEY}",
  VITE_FIREBASE_AUTH_DOMAIN: "${VITE_FIREBASE_AUTH_DOMAIN}",
  VITE_FIREBASE_PROJECT_ID: "${VITE_FIREBASE_PROJECT_ID}",
  VITE_BUILD_ID: "${BUILD_ID:-development}"
};
EOF

echo "🚀 Runtime configuration generated: $(cat /usr/share/nginx/html/config.js)"

# Start Nginx (passed via CMD in Dockerfile)
exec "$@"
