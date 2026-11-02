# Staging monitoring
Use docker compose -f docker-compose.yml -f deploy/compose.monitoring.yml up -d --no-build.
Set GRAFANA_ADMIN_PASSWORD in server .env before startup. Never commit secrets.
Grafana binds to 127.0.0.1:3001 only. Tunnel with ssh -L 3001:127.0.0.1:3001 deploy@SERVER_IP and open http://localhost:3001.
Prometheus queries: probe_success{job="api-health"}, up.
Loki query: {job="docker"} |= "requestId".
Prometheus and Loki retain seven days of data. Logs are read from Docker json-file log files.
Alerts and per-route API latency metrics are not yet configured.
