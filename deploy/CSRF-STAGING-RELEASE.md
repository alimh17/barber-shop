# CSRF Guard Staging Release Checklist

Status: Candidate only; do not deploy to staging until isolated regression is green.

## Included changes
- `src/auth/guards/refresh-origin.guard.ts`: strict Origin allowlist for POST /api/auth/refresh.
- `src/auth/auth.controller.ts`: apply guard to refresh endpoint.
- `src/auth/guards/refresh-origin.guard.spec.ts`: unit tests.
- `e2e/security-hardening.spec.ts`: security regression scenarios.
- `scripts/run-isolated-security.ps1`: isolated VPS security runner.

## Preflight
1. Review and commit only the listed source/test files; do not include `test-results`, generated reports, `.env`, or TLS private keys.
2. Confirm `CORS_ORIGINS` on staging contains the exact browser frontend origins (for example `https://staging.barbers-agency.ir`); do not use wildcard origins with credentials.
3. Run TypeScript build and unit tests, then isolated security and booking/auth regression against the candidate image.
4. Record existing staging API image digest and keep it available for rollback; back up staging database before deployment. Do not reset staging database.
5. Deploy only after regression is green and verify login, refresh, logout, appointments, tenant isolation, health endpoint and HTTPS in staging.
6. Roll back API image to previous digest if health or auth smoke tests fail; keep database intact.

## Limitations
The guard rejects explicitly untrusted Origin headers, but permits requests with no Origin for non-browser compatibility. This is defense-in-depth, not a complete CSRF strategy. Additional Fetch Metadata checks or a CSRF token policy may be appropriate for cookie-authenticated actions.

## Staging rollout 2026-11-04
- API candidate: `barbershop-api-api:e2e-csrf-guard`; use `deploy/compose.csrf-staging.yml` alongside base and HTTPS overlays.
- Previous API: `barbershop-api-api:rollback-20261104`, image digest `sha256:1cb46c719b8d9176dc28706f0b2605091678182c1aaf4bbfba56a38755b0c744`.
- Explicit CORS allowlist: `https://staging.barbers-agency.ir,https://api-staging.barbers-agency.ir`.
- HTTPS Nginx overlay enabled; both staging health endpoints returned HTTP 200.
- Read-only browser smoke on actual staging: 5/5 passed.

Rollback (API only, no database changes):
```bash
cd /opt/barbershop-api
docker compose -f docker-compose.yml -f deploy/compose.https.yml -f deploy/compose.csrf-rollback.yml config --quiet
docker compose -f docker-compose.yml -f deploy/compose.https.yml -f deploy/compose.csrf-rollback.yml up -d --no-deps api
curl -fsS https://staging.barbers-agency.ir/api/health
```
Do not use `down --volumes`, run migrations, or recreate PostgreSQL/Redis for rollback. Keep monitoring services untouched.
