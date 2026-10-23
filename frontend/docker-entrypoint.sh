#!/bin/sh
set -eu

json_escape() {
  printf '%s' "$1" | sed 's/\\/\\\\/g; s/"/\\"/g'
}

api_key=$(json_escape "${FIREBASE_API_KEY:-}")
auth_domain=$(json_escape "${FIREBASE_AUTH_DOMAIN:-}")
project_id=$(json_escape "${FIREBASE_PROJECT_ID:-}")
app_id=$(json_escape "${FIREBASE_APP_ID:-}")

cat > /srv/firebase-config.json <<EOF
{
  "apiKey": "$api_key",
  "authDomain": "$auth_domain",
  "projectId": "$project_id",
  "appId": "$app_id"
}
EOF

exec caddy run --config /etc/caddy/Caddyfile --adapter caddyfile