# Staging HTTPS rollout

Domain: barbers-agency.ir; VPS: 185.110.188.173.

## Current state
Continue using the base `docker-compose.yml` only. HTTP via IP remains active. The HTTPS overlay is opt-in and MUST NOT be enabled until DNS is active and certificates exist.

As of 2026-10-29, the purchased domain is still awaiting approval. This is an external gate; do not activate the overlay or redirect domain traffic yet.

## Prerequisites
1. Wait for IRNIC approval and Cloudflare Active. Verify both staging.barbers-agency.ir and api-staging.barbers-agency.ir resolve to the VPS. Keep Cloudflare DNS only initially.
2. Obtain a ParsPack certificate covering BOTH subdomains (wildcard *.barbers-agency.ir is acceptable). Apex-only SSL does not cover them.
3. On the VPS, put the leaf plus intermediate certificates in `deploy/tls/fullchain.pem`, and the matching unencrypted PEM private key in `deploy/tls/privkey.pem`. Never commit or share keys. Set restrictive file permissions and verify Nginx can read them.
4. Allow inbound 443. Retain port 80 until HTTPS and regression tests pass.

## Activate when ready
From the VPS project root:
```bash
docker compose -f docker-compose.yml -f deploy/compose.https.yml config --quiet
docker compose -f docker-compose.yml -f deploy/compose.https.yml up -d --build nginx
docker compose -f docker-compose.yml -f deploy/compose.https.yml exec nginx nginx -t
curl -I https://staging.barbers-agency.ir/
curl -i https://staging.barbers-agency.ir/api/health
curl -i https://api-staging.barbers-agency.ir/api/health
```

The original IP HTTP configuration remains active during validation. The frontend uses same-origin /api/; direct API origin is also available. If browser clients access the separate API origin, set exact CORS_ORIGINS.

## Roll back HTTPS overlay without stopping the database
```bash
docker compose up -d --no-deps --force-recreate nginx
```
Use the base compose file only for rollback; verify with `docker compose exec nginx nginx -t`.

After HTTPS login, refresh, booking, tenant isolation and browser regression checks pass, replace IP access with a deny/reject virtual host. Do not disable IP in this phase.

Existing Certbot instructions in deploy/README.md describe an alternative to ParsPack certificates. For ParsPack renewal, replace the PEM files and reload Nginx after a successful nginx -t.
