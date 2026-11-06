#!/usr/bin/env bash
set -Eeuo pipefail
# This runner only targets the disposable GitHub Actions Docker project.
[[ "${CI:-}" == "true" ]] || { echo "CI=true required"; exit 2; }
[[ "${GITHUB_ACTIONS:-}" == "true" ]] || { echo "GitHub Actions required"; exit 2; }
[[ "${E2E_ISOLATED:-}" == "1" ]] || { echo "E2E_ISOLATED=1 required"; exit 2; }
cd "$(dirname "$0")/.."
COMPOSE=(docker compose -f deploy/compose.e2e-isolated.yml)
[[ "$("${COMPOSE[@]}" config --format json | python3 -c 'import json,sys;print(json.load(sys.stdin)["name"])')" == "barbershop-e2e" ]] || exit 2
export E2E_BASE_URL=http://127.0.0.1:18080
export E2E_API_URL="$E2E_BASE_URL/api"
export E2E_PHONE=09120000981 E2E_SALON_SLUG=e2e-playwright-salon
export E2E_CUSTOMER_PHONE=09120000981 E2E_BARBER_PHONE=09120000982
export E2E_SALON_NAME="E2E Test Salon" E2E_BARBER_NAME="E2E Barber" E2E_SERVICE_NAME="E2E Haircut"
specs=(auth.spec.ts booking-browser-actions.spec.ts booking-multitenant.spec.ts booking-security.spec.ts booking.spec.ts staging-readonly.spec.ts tenant-browser.spec.ts tenant-registration.spec.ts security-hardening.spec.ts)
mkdir -p e2e-ci-results
cleanup() { "${COMPOSE[@]}" down --volumes --remove-orphans || true; }
trap cleanup EXIT
failed=0
for spec in "${specs[@]}"; do
  echo "::group::Reset isolated database for $spec"
  "${COMPOSE[@]}" down --volumes --remove-orphans
  "${COMPOSE[@]}" up -d --wait postgres redis
  "${COMPOSE[@]}" --profile tools run --rm migrate
  "${COMPOSE[@]}" --profile tools run --rm -e E2E_ALLOW_SEED=yes -v "$PWD/e2e/seed-isolated.mjs:/app/e2e/seed-isolated.mjs:ro" migrate node e2e/seed-isolated.mjs
  "${COMPOSE[@]}" up -d --wait api web
  curl -fsS --retry 5 --retry-delay 2 "$E2E_API_URL/health"
  echo "::endgroup::"
  echo "::group::Playwright $spec"
  if pnpm exec playwright test "e2e/$spec" --workers=1 --retries=0 --reporter=list; then
    printf '%s PASS\n' "$spec" | tee -a e2e-ci-results/suites.txt
  else
    printf '%s FAIL\n' "$spec" | tee -a e2e-ci-results/suites.txt
    failed=1
  fi
  echo "::endgroup::"
done
exit "$failed"
