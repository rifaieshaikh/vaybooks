# Observability

Logging, tracing, and correlation across the gateway and microservices.

## Correlation IDs

Every inbound HTTP request through the gateway should:

1. Accept `X-Request-Id` from the client or generate a UUID.
2. Propagate the same id to downstream service calls (`X-Request-Id` / `traceparent`).
3. Include `request_id` in structured log lines and error JSON responses.

Example response header:

```
X-Request-Id: 7f3c2a1b-4d5e-6f78-9012-3456789abcde
```

## Structured logging

- JSON logs in cloud; human-readable in local Dev.
- Fields: `timestamp`, `level`, `service`, `request_id`, `org_id`, `user_id`, `route`, `duration_ms`.

## OpenTelemetry (placeholder)

Phase 3 scaffolding — wire when services split:

| Component | Status |
|-----------|--------|
| OTel SDK (Python) | Planned — `opentelemetry-instrumentation-fastapi` |
| Export | OTLP → Grafana Tempo / Jaeger / vendor APM |
| Metrics | Request latency, error rate, Redis/Mongo pool stats |
| Electron | Optional crash reporter; no server trace from renderer |

Env placeholders:

```
OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4317
OTEL_SERVICE_NAME=vaybooks-gateway
```

## Health checks

- Gateway: `GET /health`
- Compose: Redis `PING`, Mongo `ping` (see [`docker-compose.yml`](../docker-compose.yml))
- Combined desktop process: single `/health` aggregating embedded modules

## Dashboards (future)

- Failed license consume attempts
- Sales `DEGRADED_PENDING` duration
- Outbox lag per service
