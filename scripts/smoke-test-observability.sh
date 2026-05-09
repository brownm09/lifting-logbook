#!/usr/bin/env bash
# Smoke-tests the observability docker-compose stack end-to-end.
#
# Starts the five observability services (skips db), sends a synthetic OTLP
# trace span to the OTel Collector, and verifies Tempo received and stored it.
# Exits 0 on success, 1 on failure. Always tears down on exit.
#
# Usage:  bash scripts/smoke-test-observability.sh
# Prereq: Docker with Compose V2 (docker compose, not docker-compose).

set -euo pipefail

TRACE_ID="$(tr -dc 'a-f0-9' </dev/urandom | head -c 32)"
SPAN_ID="$(tr -dc 'a-f0-9' </dev/urandom | head -c 16)"
START_TIME_NS="$(date +%s)000000000"
END_TIME_NS="$(($(date +%s) + 1))000000000"

cleanup() {
  echo "--- Tearing down observability stack ---"
  docker compose down --timeout 10
}
trap cleanup EXIT

echo "--- Starting observability services ---"
docker compose up -d otel-collector tempo loki prometheus grafana

echo "--- Waiting for services to be healthy (up to 90s each) ---"
for service in tempo loki otel-collector; do
  echo "  Waiting for ${service}..."
  timeout 90 bash -c \
    "until docker compose ps ${service} 2>/dev/null | grep -q 'healthy'; do sleep 3; done"
  echo "  ${service} is healthy"
done

echo "--- Sending synthetic OTLP span (trace_id: ${TRACE_ID}) ---"
HTTP_STATUS=$(curl -s -o /dev/null -w '%{http_code}' \
  -X POST http://localhost:4318/v1/traces \
  -H 'Content-Type: application/json' \
  -d "{
    \"resourceSpans\": [{
      \"resource\": {
        \"attributes\": [{
          \"key\": \"service.name\",
          \"value\": {\"stringValue\": \"observability-smoke-test\"}
        }]
      },
      \"scopeSpans\": [{
        \"scope\": {\"name\": \"smoke-test\"},
        \"spans\": [{
          \"traceId\": \"${TRACE_ID}\",
          \"spanId\": \"${SPAN_ID}\",
          \"name\": \"smoke-test-span\",
          \"kind\": 1,
          \"startTimeUnixNano\": \"${START_TIME_NS}\",
          \"endTimeUnixNano\": \"${END_TIME_NS}\",
          \"status\": {\"code\": 1}
        }]
      }]
    }]
  }")

if [ "$HTTP_STATUS" != "200" ]; then
  echo "FAIL: OTel Collector rejected the span (HTTP ${HTTP_STATUS})"
  exit 1
fi
echo "  Collector accepted span (HTTP 200)"

echo "--- Waiting for batch flush (10s) ---"
sleep 10

echo "--- Querying Tempo for trace ${TRACE_ID} ---"
TEMPO_RESPONSE=$(curl -s "http://localhost:3200/api/traces/${TRACE_ID}")

if echo "${TEMPO_RESPONSE}" | grep -q "smoke-test-span"; then
  echo ""
  echo "PASS: Span found in Tempo — observability pipeline is healthy."
else
  echo ""
  echo "FAIL: Span not found in Tempo after 10s."
  echo "Tempo response: ${TEMPO_RESPONSE}"
  exit 1
fi
