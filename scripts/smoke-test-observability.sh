#!/usr/bin/env bash
# Smoke-tests the observability docker-compose stack end-to-end.
#
# Starts the five observability services (skips db), sends a synthetic OTLP
# trace span to the OTel Collector, and polls Tempo until the span is queryable.
# Exits 0 on success, 1 on failure. Always tears down the services it started.
#
# Usage:  bash scripts/smoke-test-observability.sh
# Prereq: Docker with Compose V2 (docker compose, not docker-compose).
#
# Note: cleanup only stops the services this script started — does not touch `db`.

set -euo pipefail

SERVICES=(otel-collector tempo loki prometheus grafana)
WAIT_SERVICES=(tempo loki otel-collector)

TRACE_ID="$(openssl rand -hex 16)"
SPAN_ID="$(openssl rand -hex 8)"
START_TIME_NS="$(date +%s)000000000"
END_TIME_NS="$(($(date +%s) + 1))000000000"

cleanup() {
  echo "--- Tearing down observability services ---"
  docker compose stop "${SERVICES[@]}" >/dev/null 2>&1 || true
  docker compose rm -f "${SERVICES[@]}" >/dev/null 2>&1 || true
}
trap cleanup EXIT

echo "--- Starting observability services ---"
docker compose up -d "${SERVICES[@]}"

echo "--- Waiting for services to be healthy (up to 90s each) ---"
for service in "${WAIT_SERVICES[@]}"; do
  echo "  Waiting for ${service}..."
  timeout 90 bash -c '
    service="$1"
    while true; do
      cid=$(docker compose ps -q "$service" 2>/dev/null || true)
      if [ -n "$cid" ]; then
        status=$(docker inspect --format "{{.State.Health.Status}}" "$cid" 2>/dev/null || echo "unknown")
        if [ "$status" = "healthy" ]; then
          exit 0
        fi
        if [ "$status" = "unhealthy" ]; then
          echo "FAIL: ${service} reported unhealthy"
          docker compose logs --tail=30 "$service" || true
          exit 2
        fi
      fi
      sleep 2
    done
  ' _ "$service"
  echo "  ${service} is healthy"
done

echo "--- Sending synthetic OTLP span (trace_id: ${TRACE_ID}) ---"
RESPONSE_BODY="$(mktemp)"
HTTP_STATUS=$(curl --silent --show-error --output "$RESPONSE_BODY" \
  --write-out '%{http_code}' \
  --max-time 10 \
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
  }" || echo "000")

if [ "$HTTP_STATUS" = "000" ]; then
  echo "FAIL: could not reach OTel Collector at localhost:4318 (connection error or timeout)"
  rm -f "$RESPONSE_BODY"
  exit 1
fi
if [ "$HTTP_STATUS" != "200" ]; then
  echo "FAIL: OTel Collector rejected the span (HTTP ${HTTP_STATUS})"
  cat "$RESPONSE_BODY" 2>/dev/null || true
  rm -f "$RESPONSE_BODY"
  exit 1
fi
rm -f "$RESPONSE_BODY"
echo "  Collector accepted span (HTTP 200)"

echo "--- Polling Tempo for trace ${TRACE_ID} (up to 30s) ---"
TEMPO_RESPONSE=""
for attempt in $(seq 1 15); do
  TEMPO_RESPONSE=$(curl -s --max-time 5 "http://localhost:3200/api/traces/${TRACE_ID}" || echo "")
  # Validate the JSON contains our named span — substring match would false-pass
  # on error payloads that echo the request body.
  if [ -n "$TEMPO_RESPONSE" ] && \
     printf '%s' "$TEMPO_RESPONSE" | node -e '
       let d = "";
       process.stdin.on("data", c => d += c);
       process.stdin.on("end", () => {
         try {
           const j = JSON.parse(d);
           const batches = j.batches || (j.trace && j.trace.batches) || [];
           const found = batches.some(b =>
             (b.scopeSpans || b.instrumentationLibrarySpans || []).some(s =>
               (s.spans || []).some(sp => sp.name === "smoke-test-span")));
           process.exit(found ? 0 : 1);
         } catch (e) { process.exit(1); }
       });
     ' 2>/dev/null; then
    echo ""
    echo "PASS: Span found in Tempo on attempt ${attempt} — observability pipeline is healthy."
    exit 0
  fi
  sleep 2
done

echo ""
echo "FAIL: Span not found in Tempo after 30s of polling."
echo "Last Tempo response: ${TEMPO_RESPONSE}"
exit 1
