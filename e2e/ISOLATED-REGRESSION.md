## Repeatable isolated VPS regression

Run from the Windows development machine with Desktop Commander/SSH access:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/run-isolated-regression.ps1
```

This runner uses the dedicated VPS Compose project `barbershop-e2e` and localhost-only `127.0.0.1:18080` through an SSH tunnel. It resets the **E2E** PostgreSQL volume and Redis for **each** Playwright spec, applies all Prisma migrations, seeds two salons/eight users/three barbers/two services, waits for API/web health, then runs the spec with one worker and no retries. It collects suite exit codes in `e2e-regression-results.json`. On failure, other suites continue; a failed reset stops the run. The tunnel closes when the run ends. The final E2E environment remains available with the last suite's test data.

**Destructive scope:** `deploy/reset-e2e-isolated.sh` invokes `docker compose down --volumes --remove-orphans` only after verifying its working directory and Compose project name are `barbershop-e2e`. It permanently deletes the isolated test database on each run. Never change the project name or point the runner at staging/production. No staging DB credentials are used. The E2E API runs in development mode with mock SMS to return test OTP; it is not publicly exposed.

Prerequisites: `/home/deploy/barbershop-e2e` with its private `.env`, `compose.yml`, `nginx/e2e.conf`, `seed-isolated.mjs`, and local Docker images `barbershop-api-api:latest`, `barbershop-api-migrate:latest`, `barbershop-api-nginx:latest`; Windows SSH key at `~/.ssh/private-key-file.pem`, Node/pnpm and Playwright Chromium installed. The runner uploads the reset shell script automatically. If the server images are updated, verify they match the code being tested before running.

Do not run this reset script with any other Compose project. For the **read-only staging smoke** tests, use `e2e/staging-readonly.spec.ts` separately and do not run the destructive runner against staging.
