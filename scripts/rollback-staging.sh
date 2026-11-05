#!/usr/bin/env bash
set -Eeuo pipefail
umask 077
BACKUP="${1:-$(cat "$HOME/barbershop-deploy-state/last-backup")}"
[[ -f "$BACKUP/previous-api-image" && -f "$BACKUP/previous-nginx-image" ]] || { echo "Rollback manifest missing"; exit 2; }
API="$(cat "$BACKUP/previous-api-image")"
WEB="$(cat "$BACKUP/previous-nginx-image")"
OLD_DIR="$(cat "$BACKUP/previous-release")"
[[ -f "$OLD_DIR/docker-compose.yml" ]] || { echo "Previous release directory unavailable"; exit 1; }
docker image inspect "$API" >/dev/null
docker image inspect "$WEB" >/dev/null
# Preserve current database and all named volumes. Never restore SQL automatically.
cat > "$BACKUP/rollback-images.yml" <<YAML
services:
  api:
    image: $API
    environment:
      CORS_ORIGINS: https://staging.barbers-agency.ir,https://api-staging.barbers-agency.ir
  nginx:
    image: $WEB
YAML
cd "$OLD_DIR"
FILES=(-f docker-compose.yml -f deploy/compose.https.yml -f deploy/compose.monitoring.yml -f "$BACKUP/rollback-images.yml")
docker compose -p barbershop-api "${FILES[@]}" config --quiet
docker compose -p barbershop-api "${FILES[@]}" up -d --no-build --no-deps --wait api nginx
docker exec barbershop-api-nginx-1 nginx -t
curl -fsS --retry 3 --retry-delay 2 --max-time 15 https://api-staging.barbers-agency.ir/api/health >/dev/null
curl -fsS --retry 3 --retry-delay 2 --max-time 15 https://staging.barbers-agency.ir/ >/dev/null
ln -sfnT "$OLD_DIR" "$HOME/barbershop-deploy-state/current"
echo "STAGING_ROLLBACK_OK api=$API nginx=$WEB"
