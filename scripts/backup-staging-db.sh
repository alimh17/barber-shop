#!/usr/bin/env bash
set -Eeuo pipefail
umask 077
# Run on the staging host under a dedicated, least-privilege service account.
# Writes a new backup; never writes to the database.
DEST="${BACKUP_DIR:-$HOME/barbershop-deploy-state/daily-backups}"
DB_CONTAINER="${BACKUP_DB_CONTAINER:-barbershop-api-postgres-1}"
[[ "$DB_CONTAINER" =~ ^[a-zA-Z0-9][a-zA-Z0-9_.-]*$ ]] || { echo "Invalid container name" >&2; exit 2; }
KEEP_DAYS="${BACKUP_KEEP_DAYS:-14}"
[[ "$KEEP_DAYS" =~ ^[1-9][0-9]*$ ]] || { echo "Invalid retention days" >&2; exit 2; }
mkdir -p "$DEST"
chmod 700 "$DEST"
exec 9>"$DEST/.backup.lock"
flock -n 9 || { echo "Backup already running" >&2; exit 1; }
stamp="$(date -u +%Y%m%dT%H%M%SZ)"
tmp="$(mktemp -d "$DEST/.incomplete-$stamp-XXXXXXXX")"
complete=0
cleanup() { if [[ "$complete" != 1 ]]; then rm -rf -- "$tmp"; fi; }
trap cleanup EXIT
# Database user/name are read inside the container, not from the shell or CI.
docker exec "$DB_CONTAINER" sh -c 'exec pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc' > "$tmp/postgres.dump"
test -s "$tmp/postgres.dump"
docker exec -i "$DB_CONTAINER" pg_restore -l < "$tmp/postgres.dump" > "$tmp/archive.list"
test -s "$tmp/archive.list"
(cd "$tmp" && sha256sum postgres.dump archive.list > SHA256SUMS && sha256sum -c SHA256SUMS)
printf 'created_utc=%s\nformat=pg_dump_custom\n' "$stamp" > "$tmp/metadata.txt"
chmod 600 "$tmp"/*
final="$DEST/$stamp"
[[ ! -e "$final" ]] || { echo "Backup already exists: $final" >&2; exit 1; }
mv -- "$tmp" "$final"
complete=1
echo "BACKUP_OK path=$final"
# Retention applies only to completed, timestamp-named directories in this dedicated destination.
find "$DEST" -mindepth 1 -maxdepth 1 -type d -regextype posix-extended -regex '.*/[0-9]{8}T[0-9]{6}Z' -mtime +"$((KEEP_DAYS-1))" -print0 |
while IFS= read -r -d '' old; do
  [[ -f "$old/SHA256SUMS" && -f "$old/postgres.dump" ]] || continue
  rm -rf -- "$old"
done