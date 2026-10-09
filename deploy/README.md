# Production deployment (Ubuntu VPS)

## 1. Prepare secrets and DNS

- Install Docker Engine and the Compose plugin on the VPS.
- Point your API domain's A/AAAA records to the VPS. Do not enable the TLS server block until DNS and certificates are ready.
- Create `.env` from `.env.example`; use long unique hex secrets for `POSTGRES_PASSWORD` and `REDIS_PASSWORD` (for example, `openssl rand -hex 32` for each). Hex avoids URL-encoding problems in the connection URLs. Keep `.env` out of Git.
- Configure your real SMS provider credentials. Keep `OTP_EXPOSE_CODE=false`.

## 2. Start the stack

```bash
docker compose config
docker compose up -d --build
docker compose ps
docker compose logs --tail=100 api redis postgres nginx
```

The API, PostgreSQL, and Redis have no published host ports. Only Nginx publishes ports 80 and 443. Allow SSH, 80, and 443 in the VPS firewall; do not expose 3000, 5432, or 6379.

## 3. Database migrations

Before enabling traffic, run the reviewed migrations against the production database:

```bash
docker compose run --rm api pnpm prisma migrate deploy
```

This uses the Compose-internal PostgreSQL hostname and the production `DATABASE_URL`. Do not run `prisma migrate dev` in production. Back up the database before the first deployment and inspect migration status if this database already contains application data.

## 4. TLS

The included Nginx configuration deliberately returns a closed connection for unknown HTTP hosts and leaves the TLS virtual host commented until a domain exists. After DNS points to this VPS, temporarily add the domain-specific HTTP redirect server block (leave the TLS block commented), then run Certbot from the project root, replacing the domain and email:

Run the dedicated Certbot image:

```bash
docker run --rm -it \
  -v "$PWD/deploy/certbot/conf:/etc/letsencrypt" \
  -v "$PWD/deploy/certbot/www:/var/www/certbot" \
  certbot/certbot certonly --webroot -w /var/www/certbot \
  -d api.example.com --email admin@example.com --agree-tos --no-eff-email
```

Then update both `server_name` and certificate paths in `deploy/nginx/default.conf`, enable the TLS and HTTP redirect blocks, and validate with:

```bash
docker compose exec nginx nginx -t
docker compose exec nginx nginx -s reload
```

## 5. Trust proxy

Set `TRUST_PROXY_HOPS=1` only if exactly one trusted reverse proxy (the Nginx container) is in front of Nest. If there are additional load balancers/CDNs, configure the exact trusted topology. Never trust arbitrary client-supplied forwarded headers.

## Notes

- Redis uses password authentication, append-only persistence, a 128 MB memory cap, and `noeviction` so memory pressure cannot silently evict rate-limit counters. At the cap, Redis writes fail and OTP routes fail closed with HTTP 503. Keep cache TTLs bounded and monitor Redis memory; for higher traffic, split cache and security counters into separate Redis instances with different memory policies.
- Back up PostgreSQL independently and test restore procedures. Redis persistence is not a substitute for database backups.
