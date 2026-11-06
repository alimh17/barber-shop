#!/usr/bin/env bash
set -Eeuo pipefail
# Run actual rollback with mocked Docker and HTTP. No real staging access.
repo="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
root="$(mktemp -d)"
trap 'rm -rf "$root"' EXIT
export HOME="$root/home"
mkdir -p "$HOME/barbershop-deploy-state" "$root/bin" "$root/old/deploy" "$root/backup" "$root/current"
printf 'services: {}\n' > "$root/old/docker-compose.yml"
for file in compose.https.yml compose.monitoring.yml; do printf 'services: {}\n' > "$root/old/deploy/$file"; done
printf 'barbershop-api-api:main-previous\n' > "$root/backup/previous-api-image"
printf 'barbershop-api-nginx:main-previous\n' > "$root/backup/previous-nginx-image"
printf '%s\n' "$root/old" > "$root/backup/previous-release"
ln -s "$root/current" "$HOME/barbershop-deploy-state/current"
cat > "$root/bin/docker" <<'SH'
#!/usr/bin/env bash
printf 'docker %s\n' "$*" >> "$TEST_COMMAND_LOG"
case "$1 $2" in
  'image inspect') [[ "${TEST_MISSING_IMAGE:-0}" != 1 ]] ;;
  'compose -p') [[ "${TEST_COMPOSE_FAIL:-0}" != 1 ]] ;;
  'exec barbershop-api-nginx-1') exit 0 ;;
  *) echo "Unexpected docker invocation: $*" >&2; exit 19 ;;
esac
SH
cat > "$root/bin/curl" <<'SH'
#!/usr/bin/env bash
printf 'curl %s\n' "$*" >> "$TEST_COMMAND_LOG"
[[ "${TEST_HEALTH_FAIL:-0}" != 1 ]]
SH
chmod +x "$root/bin/docker" "$root/bin/curl"
export PATH="$root/bin:$PATH"
export TEST_COMMAND_LOG="$root/commands"
run_rollback() { bash "$repo/scripts/rollback-staging.sh" "$root/backup"; }
run_rollback > "$root/success.log"
grep -q STAGING_ROLLBACK_OK "$root/success.log"
[[ "$(readlink "$HOME/barbershop-deploy-state/current")" == "$root/old" ]]
grep -q 'compose -p barbershop-api' "$TEST_COMMAND_LOG"
grep -q 'curl .*api-staging.barbers-agency.ir/api/health' "$TEST_COMMAND_LOG"
grep -q 'curl .*staging.barbers-agency.ir/' "$TEST_COMMAND_LOG"
ln -sfn "$root/current" "$HOME/barbershop-deploy-state/current"
export TEST_MISSING_IMAGE=1
if run_rollback > "$root/missing-image.log" 2>&1; then echo 'Missing image accepted' >&2; exit 1; fi
[[ "$(readlink "$HOME/barbershop-deploy-state/current")" == "$root/current" ]]
unset TEST_MISSING_IMAGE
export TEST_HEALTH_FAIL=1
if run_rollback > "$root/health-failure.log" 2>&1; then echo 'Failed health check accepted' >&2; exit 1; fi
[[ "$(readlink "$HOME/barbershop-deploy-state/current")" == "$root/current" ]]
unset TEST_HEALTH_FAIL
mv "$root/backup/previous-release" "$root/backup/previous-release.hidden"
if run_rollback > "$root/missing-manifest.log" 2>&1; then echo 'Missing manifest accepted' >&2; exit 1; fi
if grep -Eiq 'docker (volume rm|compose .*down|.*postgres)|pg_restore|dropdb|psql' "$TEST_COMMAND_LOG"; then
  echo 'Unexpected database or volume operation' >&2; exit 1
fi
echo 'ISOLATED_ROLLBACK_OK: success and failure paths verified; no staging calls made'