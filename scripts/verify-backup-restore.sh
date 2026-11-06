#!/usr/bin/env bash
set -Eeuo pipefail
umask 077
# Verify a backup against an entirely new disposable PostgreSQL container.
# Never targets staging DB. Requires Docker access and available disk space.
backup="${1:?Usage: verify-backup-restore.sh <completed-backup-directory>}"
backup="$(cd "$backup" && pwd -P)"
[[ -f "$backup/SHA256SUMS" && -s "$backup/postgres.dump" ]] || { echo 'Incomplete backup' >&2; exit 2; }
(cd "$backup" && sha256sum -c SHA256SUMS)
name="barbershop-dr-verify-$$"
cleanup() { docker rm -f "$name" >/dev/null 2>&1 || true; }
trap cleanup EXIT
docker run -d --name "$name" --network none -e POSTGRES_USER=dr_check -e POSTGRES_PASSWORD=disposable_only -e POSTGRES_DB=dr_check postgres:17-alpine >/dev/null
ready=0
for i in $(seq 1 60); do
  if docker exec "$name" psql -U dr_check -d dr_check -Atqc 'SELECT 1' 2>/dev/null | grep -qx 1; then ready=1; break; fi
  sleep 1
done
[[ "$ready" == 1 ]] || { echo 'Disposable database failed to start' >&2; exit 1; }
docker exec -i "$name" pg_restore -l < "$backup/postgres.dump" >/dev/null
# Restore into a disposable database. No --clean or --create against a live instance.
docker exec -i "$name" pg_restore --exit-on-error --no-owner --no-acl -U dr_check -d dr_check < "$backup/postgres.dump"
docker exec "$name" psql -v ON_ERROR_STOP=1 -U dr_check -d dr_check -Atqc 'SELECT 1' | grep -qx 1
echo 'RESTORE_VERIFIED: disposable PostgreSQL restore completed'