# Development load and scenario testing

These tools are restricted to a disposable development database. They must not run with `NODE_ENV=production` or real Kavenegar delivery.

## Dataset

```bash
pnpm seed:load
```

The default deterministic dataset contains 1,000 users: 20 admins, 100 barbers and 880 customers across 20 salons, plus services, schedules, 880 future booking fixtures and 240 historical completed appointments for revenue reporting. Re-running the command is idempotent. Set `LOAD_USERS` to generate another size.

## Role and tenant scenarios

Start the API with `NODE_ENV=development` and `SMS_PROVIDER=mock`, then run:

```bash
pnpm test:scenarios
```

The suite checks representative ADMIN, BARBER and CUSTOMER access, cross-tenant denial, SMS-settings isolation and tenant-scoped OTP rejection.

## Mixed API load

```bash
pnpm test:load
```

Defaults: 1,000 iterations, 50 concurrent workers, error rate at most 1%, and p95 at most 500ms. Overrides:

```bash
LOAD_CONCURRENCY=200 LOAD_ITERATIONS=2000 LOAD_MAX_P95_MS=1200 pnpm test:load
```

The runner uses three authenticated role sessions and mixes salon, user and appointment reads. It prints throughput, error rate, p50, p95 and p99. Do not interpret local-machine results as production capacity; repeat on staging with production-like CPU, PostgreSQL, Redis and network settings.
