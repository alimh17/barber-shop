#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

# Invoked on the VPS by GitHub Actions. Only staging API and nginx are replaced.
SHA="${1:?Usage: deploy-staging.sh <40-character main commit SHA>}"
[[ "$SHA" =~ ^[a-f0-9]{40}$ ]] || { echo "Invalid SHA"; exit 2; }
ROOT=/opt/barbershop-api
STATE="$HOME/barbershop-deploy-state"
LOCK="$HOME/barbershop-deploy.lock"
mkdir -p "$STATE/releases" "$STATE/backups"
exec 9>"$LOCK"
flock -n 9 || { echo "Another deployment is running"; exit 1; }
cd "$ROOT"
git fetch origin main --quiet
[[ "$(git rev-parse origin/main)" == "$SHA" ]] || { echo "Refusing to deploy a SHA that is not current origin/main"; exit 1; }

STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
SHORT="${SHA:0:12}"
RELEASE="$HOME/barbershop-release-$SHORT"
BACKUP="$STATE/backups/$STAMP"
mkdir -p "$BACKUP"
OLD_API="$(docker inspect barbershop-api-api-1 --format '{{.Config.Image}}')"
OLD_WEB="$(docker inspect barbershop-api-nginx-1 --format '{{.Config.Image}}')"
OLD_DIR="$(readlink -f "$STATE/current" 2>/dev/null || true)"
if [[ -z "$OLD_DIR" || ! -f "$OLD_DIR/docker-compose.yml" ]]; then
  OLD_DIR="$ROOT"
fi
printf '%s\n' "$OLD_API" > "$BACKUP/previous-api-image"
printf '%s\n' "$OLD_WEB" > "$BACKUP/previous-nginx-image"
printf '%s\n' "$OLD_DIR" > "$BACKUP/previous-release"
printf '%s\n' "$SHA" > "$BACKUP/target-sha"

# Back up Git state, server-only config, and a validated PostgreSQL custom dump.
git rev-parse HEAD > "$BACKUP/previous-git-sha"
git status --porcelain=v1 > "$BACKUP/previous-git-status"
git diff --binary > "$BACKUP/previous-git.patch"
tar -czf "$BACKUP/server-config.tar.gz" .env deploy/nginx deploy/compose.https.yml deploy/tls deploy/monitoring
docker exec barbershop-api-postgres-1 sh -c 'exec pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc' > "$BACKUP/postgres.dump"
test -s "$BACKUP/postgres.dump"
docker exec -i barbershop-api-postgres-1 pg_restore -l < "$BACKUP/postgres.dump" > "$BACKUP/postgres-list.txt"
sha256sum "$BACKUP/postgres.dump" "$BACKUP/server-config.tar.gz" > "$BACKUP/SHA256SUMS"
echo "Validated backup: $BACKUP"

if [[ ! -d "$RELEASE" ]]; then
  git worktree add --detach "$RELEASE" "$SHA"
fi
[[ "$(git -C "$RELEASE" rev-parse HEAD)" == "$SHA" ]] || { echo "Release SHA mismatch"; exit 1; }
# Keep production secrets, TLS and hardened origin policy outside source control.
cp -a "$ROOT/.env" "$RELEASE/.env"
cp -a "$ROOT/deploy/tls" "$ROOT/deploy/certbot" "$ROOT/deploy/monitoring" "$RELEASE/deploy/"
cp -a "$ROOT/deploy/nginx/staging.conf" "$ROOT/deploy/nginx/default.conf" "$ROOT/deploy/nginx/cloudflare-origin-allow.conf" "$RELEASE/deploy/nginx/"
cp -a "$ROOT/deploy/compose.https.yml" "$RELEASE/deploy/compose.https.yml"

# Schema changes require a separate reviewed migration/rollback plan.
if git diff --name-only "$(cat "$BACKUP/previous-git-sha")" "$SHA" -- prisma/migrations | grep -q .; then
  echo "Database migrations changed. Stop: run reviewed migration plan first."
  exit 1
fi

cat > "$RELEASE/deploy/compose.release.yml" <<YAML
services:
  api:
    image: barbershop-api-api:main-$SHORT
    environment:
      CORS_ORIGINS: https://staging.barbers-agency.ir,https://api-staging.barbers-agency.ir
  nginx:
    image: barbershop-api-nginx:main-$SHORT
YAML

cd "$RELEASE"
FILES=(-f docker-compose.yml -f deploy/compose.https.yml -f deploy/compose.monitoring.yml -f deploy/compose.release.yml)
docker compose -p barbershop-api "${FILES[@]}" config --quiet
docker build --target production -t "barbershop-api-api:main-$SHORT" .
docker build --target web -t "barbershop-api-nginx:main-$SHORT" .

rollback_on_failure() {
  rc=$?
  if [[ $rc -ne 0 && "${SWITCH_STARTED:-0}" == 1 ]]; then
    echo "Deployment failed; attempting automatic container rollback"
    bash "$RELEASE/scripts/rollback-staging.sh" "$BACKUP" || true
  fi
  exit "$rc"
}
trap rollback_on_failure EXIT
SWITCH_STARTED=1
docker compose -p barbershop-api "${FILES[@]}" up -d --no-build --no-deps --wait api nginx
docker exec barbershop-api-nginx-1 nginx -t
curl -fsS --retry 3 --retry-delay 2 --max-time 15 https://api-staging.barbers-agency.ir/api/health > /dev/null
curl -fsS --retry 3 --retry-delay 2 --max-time 15 https://staging.barbers-agency.ir/ > /dev/null
ln -sfn "$RELEASE" "$STATE/current"
printf '%s\n' "$BACKUP" > "$STATE/last-backup"
SWITCH_STARTED=0
trap - EXIT
echo "STAGING_DEPLOY_OK sha=$SHA backup=$BACKUP"
