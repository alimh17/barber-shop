# Regression readiness — 2026-10-29

Scope: local Windows workspace only. No VPS access, deployment, or production migration performed.

## Verified

- `pnpm test`: 175/175 passed across 31 files, including PostgreSQL concurrency and overlap tests.
- `pnpm test:e2e`: 1/1 passed.
- `pnpm test:web`: 10/10 passed after isolating localStorage cleanup between tests.
- `pnpm build:all`: passed.
- `pnpm lint:all`: passed without warnings.
- Migration `20261029150000_add_salon_sms_config` was applied successfully; `prisma migrate status` reports the development database up to date.
- Load dataset: 1,000 users, 20 salons and 880 appointments.
- Role/tenant scenario suite: all 7 checks passed.
- Mixed read load results on the local development machine:
  - 50 concurrent / 1,000 iterations: 0% errors, 219.92 req/s, p95 374.32ms.
  - 200 concurrent / 2,000 iterations: 0% errors, 254.60 req/s, p95 1256.02ms; failed the 1200ms latency threshold.
  - 500 concurrent / 3,000 iterations: 0% errors, 240.35 req/s, p95 3412.20ms.
  - 1,000 concurrent / 5,000 iterations: 0% errors, 255.26 req/s, p95 6561.54ms.
- Docker/Compose validation could not run because the `docker` executable is not installed or not available in PATH.
- Existing Playwright suite previously ran 7/10 with failures in OTP auth, booking-security, and tenant-registration due to shared fixture / rate limiting. Not rerun in this session.

## Change in this iteration

- `e2e/auth.spec.ts` requires explicitly provided E2E_PHONE and E2E_OTP and optionally E2E_SALON_SLUG, rather than using OTP exposed in the development UI. Without credentials, cookie test skips; a skip is NOT proof of HTTPS cookie correctness.
- Do not turn off OTP rate limits in staging/production.
- Real API tests use hard-coded local fixture IDs and must not run against a non-disposable database without fixture isolation and cleanup.

## Staging gate

1. Add isolated Playwright users, an OTP test strategy, idempotent setup/teardown and non-destructive assertions.
2. Re-run the complete Playwright suite against this development dataset or a dedicated disposable staging database.
3. Profile database queries and connection-pool behavior before treating the local load figures as a capacity target.
4. Domain approval is pending. Do not enable the HTTPS overlay until DNS resolves and certificate files exist.
5. After approval, verify TLS, HttpOnly/Secure/SameSite cookie behavior, CORS, salon isolation, concurrency and migration backup/restore on staging.
6. Repeat load tests with production-like CPU, PostgreSQL, Redis and network settings, then close direct IP HTTP access only after the HTTPS checks pass.
