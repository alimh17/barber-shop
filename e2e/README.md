# Playwright browser E2E

Run only against an isolated development/test database. The booking journey creates a real pending appointment and confirms it, so do not target production or a shared database.

## Prerequisites

- PostgreSQL/Redis and a **development-mode** API with a dedicated test database.
- Frontend at http://127.0.0.1:5173 and API reachable through its `/api` proxy.
- A customer account, an assigned active barber account, an active salon and barber service, working hours and a free slot two days from now.
- The backend must return the OTP in development mode so Playwright can log in through the actual UI.

The Vite dev server proxies `/api` to `http://127.0.0.1:3000` by default. If the API is elsewhere, set `VITE_BACKEND_TARGET` before starting Vite. Check `http://127.0.0.1:5173/api/salons` returns HTTP 200 before running.

## Full booking journey

In PowerShell:

```powershell
$env:E2E_CUSTOMER_PHONE='09120000001'
$env:E2E_BARBER_PHONE='09120000002'
$env:E2E_SALON_NAME='Your isolated test salon'
$env:E2E_BARBER_NAME='Your test barber display name'
$env:E2E_SERVICE_NAME='Your test service'
pnpm exec playwright test e2e/booking.spec.ts --headed
```

These are example values: use actual isolated fixture data. If any required variable is missing, the test is explicitly skipped. The test does not fabricate authentication, bookings, or confirmations.

For the phone validation and optional OTP-cookie test: `pnpm test:browser`. Set `E2E_PHONE` to a valid isolated test account. Development OTP is read from the login screen. HTML report: `pnpm exec playwright show-report`.

This is browser E2E, **not** a 100-concurrent-user load test.
