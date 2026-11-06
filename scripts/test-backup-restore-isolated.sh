#!/usr/bin/env bash
set -Eeuo pipefail
# Entirely disposable: no staging host, network, volumes or credentials are used.
work="$(mktemp -d)"
name="barbershop-restore-test-$$"
cleanup() { docker rm -f "$name" >/dev/null 2>&1 || true; rm -rf "$work"; }
trap cleanup EXIT
docker run -d --name "$name" -e POSTGRES_USER=restore_test -e POSTGRES_PASSWORD=local_only -e POSTGRES_DB=restore_test postgres:17-alpine >/dev/null
ready=0
for i in $(seq 1 40); do
  if docker exec "$name" pg_isready -U restore_test -d restore_test >/dev/null 2>&1; then ready=1; break; fi
  sleep 1
done
[[ "$ready" == 1 ]] || { echo 'Disposable PostgreSQL failed to start'; exit 1; }
docker exec -i "$name" psql -v ON_ERROR_STOP=1 -U restore_test -d restore_test <<'SQL'
CREATE TABLE restore_fixture (id integer PRIMARY KEY, label text NOT NULL);
INSERT INTO restore_fixture VALUES (1, 'before-backup'), (2, 'verify-restore');
SQL
docker exec "$name" pg_dump -U restore_test -d restore_test -Fc > "$work/postgres.dump"
test -s "$work/postgres.dump"
docker exec -i "$name" pg_restore -l < "$work/postgres.dump" > "$work/archive.list"
test -s "$work/archive.list"
(cd "$work" && sha256sum postgres.dump > SHA256SUMS && sha256sum -c SHA256SUMS)
docker exec "$name" psql -v ON_ERROR_STOP=1 -U restore_test -d restore_test -c 'DROP TABLE restore_fixture'
docker exec "$name" createdb -U restore_test restored_copy
docker exec -i "$name" pg_restore --exit-on-error -U restore_test -d restored_copy < "$work/postgres.dump"
result="$(docker exec "$name" psql -At -U restore_test -d restored_copy -c "SELECT string_agg(label, ',' ORDER BY id) FROM restore_fixture")"
[[ "$result" == 'before-backup,verify-restore' ]] || { echo "Restore mismatch: $result"; exit 1; }
printf 'corruption' >> "$work/postgres.dump"
if (cd "$work" && sha256sum -c SHA256SUMS >/dev/null 2>&1); then
  echo 'Corrupted backup unexpectedly passed checksum'; exit 1
fi
echo 'ISOLATED_BACKUP_RESTORE_OK: restore verified, corrupted archive rejected'
