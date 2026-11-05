# Logging and incident debugging

## Backend request telemetry

Every API request receives an `X-Request-Id` response header and every API error body includes `requestId`. Ask the reporter for that ID, the approximate time, page, and action; **never** ask for OTPs, access tokens, passwords, or complete personal records.

Set `HTTP_LOG_LEVEL=all` for all HTTP request summaries, `HTTP_LOG_LEVEL=errors` (default) for only HTTP 4xx/5xx, or `HTTP_LOG_LEVEL=off` to suppress request summaries. Server errors still generate a minimal correlated `unhandled_http_error` record.

Logs are newline-delimited JSON on stdout/stderr and include timestamp, severity, event, requestId, HTTP method, matched route template, status, and duration. They deliberately **exclude** request/response bodies, query strings, cookies, Authorization headers, phone numbers, and raw exception messages.

Example:

`{"timestamp":"2026-11-01T12:00:00.000Z","level":"error","event":"http_request","requestId":"...","method":"POST","route":"/appointments","status":500,"durationMs":43.2}`

On Docker staging, use `docker compose logs --since=30m api` (adjust service name if needed). Filter by request ID. Configure Docker log rotation on the server (e.g. json-file max-size 10m, max-file 5), retention, access restrictions, and alerts before production. Avoid posting raw logs in public tickets.

## Monitoring and alerts

Existing `GET /api/health` checks application dependencies. Monitor it externally with a private uptime monitor, and alert on failed checks, repeated 5xx responses, high response latency, or container restarts. This change does not install or configure an external dashboard or alert delivery. Log volume and retention depend on the deployment environment.

## Frontend

The API response header `X-Request-Id` can be read in browser network tools (same-origin API) and the response JSON also contains `requestId`. Share that ID when reporting a bug; use it to correlate with backend logs.

## Privacy and security

Do not add user IDs, phone numbers, OTPs, access tokens, or request bodies to telemetry. Avoid exposing metrics endpoints publicly without authentication. Access to server logs should be restricted to authorized operators.
