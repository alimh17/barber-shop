#!/bin/sh
set -eu
cd "$HOME/barbershop-e2e"
umask 077
if [ ! -f .env ]; then
  {
    printf 'E2E_DB_PASSWORD=%s\n' "$(openssl rand -hex 24)"
    printf 'E2E_REDIS_PASSWORD=%s\n' "$(openssl rand -hex 24)"
    printf 'E2E_JWT_ACCESS_SECRET=%s\n' "$(openssl rand -hex 48)"
    printf 'E2E_JWT_REFRESH_SECRET=%s\n' "$(openssl rand -hex 48)"
  } > .env
fi
chmod 600 .env
docker compose -f compose.yml config --quiet
docker compose -f compose.yml up -d postgres redis
docker compose -f compose.yml --profile tools run --rm migrate
docker compose -f compose.yml up -d api web
docker compose -f compose.yml ps
curl --fail --silent --show-error --max-time 8 http://127.0.0.1:18080/api/health
