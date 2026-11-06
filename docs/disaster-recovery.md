# Staging disaster recovery runbook

## Scope and safety

The staging PostgreSQL volume is never restored, dropped, or replaced by automated rollback or by the verification script. A logical backup is not a point-in-time recovery system; recovery point is the most recent successful dump. Store a second encrypted, access-controlled copy off the VPS for host-loss resilience. Do not store credentials or dumps in GitHub artifacts.

## Installation (manual approval required)

Review the scripts and available disk space on the VPS first. As the deployment user, install a cron entry **only after** validating Docker permissions, available storage, and off-host replication:

```cron
17 2 * * * /usr/bin/bash /opt/barbershop-api/scripts/backup-staging-db.sh >> /home/deploy/barbershop-deploy-state/backup.log 2>&1
```

The script writes to `~/barbershop-deploy-state/daily-backups` by default, uses `flock` to prevent overlapping jobs, stores custom-format PostgreSQL dumps and SHA-256 manifests, and keeps 14 days of completed daily backups (configurable with `BACKUP_KEEP_DAYS`). Retention only removes completed timestamp-named backup directories under that dedicated directory. Ensure the scripts are present at the selected path and logs are rotated.

## Verification

Run `bash scripts/verify-backup-restore.sh /absolute/path/to/completed-backup` on a trusted Docker host with sufficient resources. It verifies checksums and restores into a newly created `postgres:17-alpine` container with networking disabled; the container is deleted afterward. The dump contains real data: restrict access and prefer an isolated trusted verification host. Schedule verification weekly, review failures, and alert operators. The CI test uses only synthetic data and is not evidence of a successful restore of staging data.

## Emergency recovery

1. Stop writes and record the incident, deployment SHA, and last successful backup.
2. Preserve the original database volume and copy it before any recovery attempt.
3. Confirm backup provenance and checksum, then restore to a **new** PostgreSQL instance in a restricted environment.
4. Validate schema, record counts, application compatibility, and access controls.
5. Obtain explicit approval before switching any staging application connection to the recovered instance.
6. Verify API health and booking workflows, then document recovery time, data-loss window, and incident outcome.

**Do not** run `pg_restore --clean`, `dropdb`, or `docker compose down -v` on staging. Automated image rollback is separate from database recovery.