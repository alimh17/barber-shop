# Production deployment (Ubuntu VPS)

## 1. Prepare secrets and DNS

- Install Docker Engine and the Compose plugin on the VPS.
- Point your API domain's A/AAAA records to the VPS. Do not enable the TLS server block until DNS and certificates are ready.
- Create `.env` from `.env.example`; use long unique hex secrets for `POSTGRES_PASSWORD` and `REDIS_PASSWORD` (for example, `openssl rand -hex 32` for each). Hex avoids URL-encoding problems in the connection URLs. Keep `.env` out of Git and restrict permissions (for example, `chmod 600 .env`).
- Configure real SMS provider credentials. Keep `OTP_EXPOSE_CODE=false`.

## 2. Validate and start services

```bash
docker compose config --quiet
docker compose build --pull api
docker compose up -d postgres redis
docker compose ps
```

Back up the database before applying migrations. Apply migrations using the dedicated one-off image that includes the Prisma CLI:

```bash
docker compose --profile tools run --rm migrate
```

Then start the API and Nginx:

```bash
docker compose up -d --build api nginx
docker compose ps
docker compose logs --tail=100 api redis postgres nginx
```

The API, PostgreSQL, and Redis have no published host ports. Only Nginx publishes ports 80 and 443. Allow SSH, 80, and 443 in the VPS firewall; do not expose 3000, 5432, or 6379.

The API container health check calls `/api/health` and verifies database connectivity. Nginx waits for the API health check before starting.

## 3. TLS

The included Nginx configuration deliberately returns a closed connection for unknown HTTP hosts and leaves the TLS virtual host commented until a domain exists. After DNS points to this VPS, enable the domain-specific HTTP server block (leave TLS commented), then run Certbot from the project root, replacing the domain and email:

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

Ensure port 80 remains available for HTTP-01 validation and arrange certificate renewal plus an Nginx reload after renewal.

## 4. Trust proxy

Set `TRUST_PROXY_HOPS=1` only if exactly one trusted reverse proxy (the Nginx container) is in front of Nest. If there are additional load balancers/CDNs, configure the exact trusted topology. Never trust arbitrary client-supplied forwarded headers.

## Notes

- Redis uses password authentication, append-only persistence, a 128 MB memory cap, and `noeviction` so memory pressure cannot silently evict rate-limit counters. At the cap, Redis writes fail and OTP routes fail closed with HTTP 503. Keep cache TTLs bounded and monitor Redis memory; for higher traffic, split cache and security counters into separate Redis instances with different memory policies.
- Back up PostgreSQL independently and test restore procedures. Redis persistence is not a substitute for database backups.
- The production API image installs only production dependencies. The separate `migrate` service uses the build stage so the Prisma CLI is available without including the development toolchain in the API image.
