#!/usr/bin/env bash
set -euo pipefail
cd /home/deploy/barbershop-e2e
test "$(pwd)" = /home/deploy/barbershop-e2e
test "$(docker compose config --format json | python3 -c 'import json,sys;print(json.load(sys.stdin)["name"])')" = barbershop-e2e
test -f .env
test -f seed-isolated.mjs
test -f nginx/e2e.conf
echo "[e2e] Removing ONLY barbershop-e2e containers and named volumes"
docker compose down --volumes --remove-orphans
docker compose up -d --wait postgres redis
echo "[e2e] Applying migrations"
docker compose --profile tools run --rm migrate
echo "[e2e] Seeding isolated fixtures"
docker compose --profile tools run --rm -e E2E_ALLOW_SEED=yes -v /home/deploy/barbershop-e2e/seed-isolated.mjs:/app/e2e/seed-isolated.mjs:ro migrate node e2e/seed-isolated.mjs
docker compose up -d --wait api web
curl --fail --silent --show-error http://127.0.0.1:18080/api/health
echo
echo "[e2e] Reset and readiness OK"
