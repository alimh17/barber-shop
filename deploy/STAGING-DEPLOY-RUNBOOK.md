# Staging deployment and rollback runbook

## Scope and safeguards

- Staging only: `staging.barbers-agency.ir` and `api-staging.barbers-agency.ir`.
- Source of truth: the latest `origin/main` commit. Deployments are immutable Git worktrees at `/home/deploy/barbershop-release-<sha12>`.
- Docker Compose project **must remain** `barbershop-api`. Only `api` and `nginx` are recreated; never run `down -v` or reset the live database.
- The VPS working tree at `/opt/barbershop-api` contains staging-specific, uncommitted Nginx and SMS changes. The scripts do not reset or overwrite it.
- HTTPS origin restrictions, TLS, .env, and monitoring config are copied from the existing VPS installation. Never commit these files or print their contents in CI logs.
- A custom-format PostgreSQL dump, config archive, and Git diff are stored with restricted permissions under `~/barbershop-deploy-state/backups/<UTC timestamp>` **before** changing containers.
- Deploy aborts if committed Prisma migrations differ between the existing base revision and target. Schema migration and schema rollback require a separately reviewed plan; restoring a database dump is never automatic.

## GitHub setup (one time)

Create the GitHub Environment `staging` and restrict it to `main`. Enable required reviewers if desired. Configure the following **environment secrets**:

| Name | Meaning |
|---|---|
| `STAGING_HOST` | VPS SSH hostname/IP |
| `STAGING_USER` | `deploy` (the authorized unprivileged account) |
| `STAGING_SSH_KEY` | Dedicated private SSH deploy key, with minimum permissions |
| `STAGING_KNOWN_HOSTS` | Independently verified SSH host-key line, pinned to this VPS |

Never put the private key, `.env`, database dump, TLS keys, or server IP into the repository. Add the deploy key's public half to the VPS user's `authorized_keys`. Verify the SSH host fingerprint out of band before setting `STAGING_KNOWN_HOSTS`; do not blindly trust `ssh-keyscan`.

Set repository variable `STAGING_DEPLOY_ENABLED` to `true` **only after** the environment secrets and permissions are verified. Until then, deployments remain disabled. The `CI` workflow runs on pull requests and branch pushes; only a successful `CI` run on main triggers the staging workflow. A manual `workflow_dispatch` is also available, but still requires the enable flag and the target to equal current `origin/main`.

GitHub Actions must have permission to read the repository; no write permission or personal access token is needed for deployment. The SSH account must have access to Docker and `/opt/barbershop-api`.

## Automated sequence

1. CI installs dependencies, builds API/frontend Docker targets, runs unit tests and lint.
2. After CI succeeds on main, staging job connects using the pinned SSH host key.
3. VPS deployment script obtains an exclusive lock, fetches main, validates SHA, backs up DB/config/Git and validates the dump with `pg_restore -l`.
4. It creates a separate worktree, copies runtime-only config, validates Compose, builds SHA-tagged API and nginx images, then recreates only those two services.
5. It verifies Docker health, Nginx config and both HTTPS endpoints; on failure after container switch it attempts automatic image rollback.
6. GitHub runs five read-only Playwright staging checks. A failure after successful deployment triggers image rollback and retains test artifacts.

## Manual rollback

The last backup manifest is stored at `~/barbershop-deploy-state/last-backup`. SSH to the VPS as `deploy` and run:

```bash
bash /home/deploy/rollback-staging.sh
```

Or choose a specific validated backup:

```bash
bash /home/deploy/rollback-staging.sh /home/deploy/barbershop-deploy-state/backups/YYYYMMDDTHHMMSSZ
```

Rollback switches only API and nginx images and checks health. PostgreSQL, Redis, monitoring services, volumes, and data are **not** reset or restored. A schema-changing release must be handled separately. If a deployment fails before container replacement, no rollback is necessary.

## Manual deployment (emergency only)

Use the script on the VPS after verifying the target is the current `origin/main` SHA:

```bash
bash /home/deploy/deploy-staging.sh <40-character-main-commit-sha>
```

The normal path is GitHub Actions. Do not run `git reset --hard` in `/opt/barbershop-api` or overwrite its staging configuration.

## Verification and troubleshooting

```bash
docker compose -p barbershop-api ps
docker exec barbershop-api-nginx-1 nginx -t
curl -fsS https://api-staging.barbers-agency.ir/api/health
curl -I https://staging.barbers-agency.ir/
docker logs --tail 100 barbershop-api-api-1
```

If Docker health is good but public HTTPS fails, check Cloudflare DNS, origin access allowlist, and certificate mounts before changing the application. The isolated Playwright suite should be run separately from the live staging database; only the read-only smoke suite targets real staging.

## Current baseline

Initial manual staging deployment of main `993f83a` succeeded on 2026-11-05; five read-only Playwright tests passed. The pre-deployment backup was stored at `/home/deploy/barbershop-safe-deploy-20261105T183556Z`. This predates the automated backup layout. The automated workflow has not yet been enabled until GitHub environment configuration is complete.
