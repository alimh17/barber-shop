# Local tenant migration and regression report — 2026-10-28

## Data audit and reconciliation

- Applied migration `20261028_single_active_salon_membership`; Prisma reports all 8 migrations applied.
- `node e2e/audit-tenant-migration.mjs` reports zero unassigned customers, zero users with multiple active memberships, zero active appointments without matching tenant membership, and zero barber membership conflicts.
- Two historical pending appointments in salon `e2e-playwright-salon-b` were created by the E2E fixture customer belonging to salon A. They were individually verified by ID, salon slug, customer phone, and status, then changed to `CANCELLED` with `e2e/reconcile-test-bookings.mjs`. They remain in the database for audit; the report counts 2 cancelled historical cross-tenant records.
- No real customer account was auto-assigned or moved. The reconciliation script is local-only and explicitly gated.

## Regression

- Backend unit/integration: `pnpm test` — **156 passed / 156** (28 files).
- Nest HTTP E2E: `pnpm test:e2e` — **1 passed / 1**.
- TypeScript build and Prisma migration status previously passed.
- Browser E2E full run: **7 passed / 10**, with 3 failures: OTP login on a user not enrolled through a salon link; duplicate booking test (availability endpoint originally called without authorization, corrected afterwards but later OTP throttling prevented verification); tenant admin list test (development OTP throttling).
- Web unit tests: **8 passed / 10**. Route tests around `/services/new` are failing and require investigation.
- The full regression suite is **not yet green**. Do not mark release ready until failures are addressed and the full suite rerun.

## Commands

```powershell
node e2e/audit-tenant-migration.mjs
pnpm exec prisma migrate status
pnpm test
pnpm test:e2e
pnpm test:web
pnpm exec playwright test --reporter=list --workers=1
```

Run Playwright against isolated development services. The OTP rate limiter can reject repeated logins for reused fixture phones, especially across repeated test runs. Never disable OTP rate limiting in production to make tests pass.
