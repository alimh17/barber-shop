#!/usr/bin/env bash
set -Eeuo pipefail
# Disposable integration test of the *new* operational backup and restore scripts.
# Never uses the staging container, host, volumes, or credentials.
repo="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
work="$(mktemp -d)"
name="barbershop-dr-fixture-$$"
cleanup() {
  docker rm -f "$name" >/dev/null 2>&1 || true
  rm -rf -- "$work"
}
trap cleanup EXIT
docker run -d --name "$name" --network none \
  -e POSTGRES_USER=dr_fixture -e POSTGRES_PASSWORD=fixture_only \
  -e POSTGRES_DB=dr_fixture postgres:17-alpine >/dev/null
ready=0
for i in $(seq 1 60); do
  if docker exec "$name" psql -U dr_fixture -d dr_fixture -Atqc 'SELECT 1' 2>/dev/null | grep -qx 1; then
    ready=1
    break
  fi
  sleep 1
done
[[ "$ready" == 1 ]] || { echo 'Fixture PostgreSQL did not start' >&2; exit 1; }
docker exec -i "$name" psql -U dr_fixture -d dr_fixture -v ON_ERROR_STOP=1 <<'SQL'
CREATE TABLE dr_fixture_record (id integer PRIMARY KEY, value text NOT NULL);
INSERT INTO dr_fixture_record VALUES (1, 'restore-fixture'), (2, 'verified');
SQL
export BACKUP_DB_CONTAINER="$name"
export BACKUP_DIR="$work/backups"
export BACKUP_KEEP_DAYS=14
bash "$repo/scripts/backup-staging-db.sh"
mapfile -t archives < <(find "$BACKUP_DIR" -mindepth 1 -maxdepth 1 -type d -name '????????T??????Z')
[[ "${#archives[@]}" == 1 ]] || { echo 'Expected exactly one finished backup' >&2; exit 1; }
archive="${archives[0]}"
test -s "$archive/postgres.dump"
(cd "$archive" && sha256sum -c SHA256SUMS)
bash "$repo/scripts/verify-backup-restore.sh" "$archive"
# A tampered archive must be rejected before any new restore container is created.
printf 'intentional-corruption' >> "$archive/postgres.dump"
if bash "$repo/scripts/verify-backup-restore.sh" "$archive" > "$work/corrupt.log" 2>&1; then
  echo 'Corrupt archive unexpectedly passed verification' >&2
  exit 1
fi
echo 'DISASTER_RECOVERY_ISOLATED_OK: operational dump, restore and corruption rejection verified'