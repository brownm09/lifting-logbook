import { NextResponse } from 'next/server';
import { SpanStatusCode, trace } from '@opentelemetry/api';

// Beacon receiver for browser-side client mutation failures (#798, follows #783).
//
// apps/web instruments only the *server* runtime (`@vercel/otel` registerOTel in
// instrumentation.ts). There is no browser OTel SDK, so a `console.error` in a
// Client Component never leaves the browser — the write-failure blind spot #783
// only half-closed. `logClientError` (lib/log-client-error.ts) additionally sends
// a best-effort same-origin beacon here, and this handler records the caught
// error as an OTel *span* — the only signal the web runtime exports (no browser
// SDK, and `@vercel/otel` wires no logs exporter). The web runtime's existing
// trace pipeline exports it to the collector → Tempo; the ERROR status means the
// collector's tail-sampling `errors` policy retains it (ADR-020).
//
// Why a same-origin beacon rather than a browser OTel SDK posting to the
// collector directly: the collector is internal-only (ClusterIP on GKE, a
// localhost sidecar on Cloud Run, #768) and not browser-reachable. Exposing it
// publicly would mean an unauthenticated OTLP ingest with CORS — a spam/cost
// vector into the shared free-tier Grafana Cloud stack. Same-origin keeps PII
// control server-side and adds no browser bundle weight.
//
// PII: the payload is the safe subset `logClientError` sends — operation, error
// name/message (server validation text or `API <status> ... for <path>`, never
// the Authorization header, token, or request body; see
// packages/api-client/src/index.ts), and domain-id context. This handler
// re-validates and size-caps before setting any attribute, and never serializes
// nested/object context values.
//
// This route is deliberately public (see middleware.ts): the failure being
// reported may itself be an auth expiry, so Clerk must not gate the beacon.

// OTel span export runs in the Node runtime — the edge runtime has no NodeSDK.
export const runtime = 'nodejs';
// Never prerender or cache a telemetry sink.
export const dynamic = 'force-dynamic';

// Beacons are tiny JSON; anything larger is not a legitimate client-error report.
const MAX_BODY_BYTES = 4 * 1024;
// Cap any single string so a hostile/oversized field can't bloat a span attribute.
const MAX_STRING_LENGTH = 512;
// Bound the number of context keys promoted to attributes.
const MAX_CONTEXT_KEYS = 24;

function clampString(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  return value.length > MAX_STRING_LENGTH ? value.slice(0, MAX_STRING_LENGTH) : value;
}

function noContent(): NextResponse {
  // Beacons are fire-and-forget — the client ignores the response. A 204 (rather
  // than a 4xx on bad input) keeps garbage-in from polluting web-server error-rate
  // metrics; malformed payloads are simply dropped without a span.
  return new NextResponse(null, { status: 204 });
}

function recordClientErrorSpan(payload: Record<string, unknown>): void {
  const operation = clampString(payload.operation) ?? 'unknown';
  const errorName = clampString(payload.name);
  const errorMessage = clampString(payload.message) ?? '';

  // trace.getTracer() returns a no-op tracer when no provider is registered
  // (e.g. OTel not initialized), so every call below is a safe no-op then — the
  // handler never depends on OTel being up.
  const span = trace.getTracer('web-client-errors').startSpan('client.mutation.error');
  try {
    span.setAttribute('client.operation', operation);
    if (errorName) span.setAttribute('client.error.name', errorName);
    span.setAttribute('client.error.message', errorMessage);

    const { context } = payload;
    if (context && typeof context === 'object' && !Array.isArray(context)) {
      let keys = 0;
      for (const [key, value] of Object.entries(context as Record<string, unknown>)) {
        if (keys >= MAX_CONTEXT_KEYS) break;
        keys += 1;
        // Only scalar domain ids — never serialize arbitrary nested objects/arrays.
        if (typeof value === 'string') {
          const clamped =
            value.length > MAX_STRING_LENGTH ? value.slice(0, MAX_STRING_LENGTH) : value;
          span.setAttribute(`client.context.${key}`, clamped);
        } else if (typeof value === 'number' || typeof value === 'boolean') {
          span.setAttribute(`client.context.${key}`, value);
        }
      }
    }

    span.recordException({ name: errorName ?? 'ClientMutationError', message: errorMessage });
    span.setStatus({ code: SpanStatusCode.ERROR, message: errorMessage || operation });
  } finally {
    span.end();
  }
}

export async function POST(request: Request): Promise<Response> {
  try {
    const raw = await request.text();
    if (raw.length === 0 || raw.length > MAX_BODY_BYTES) {
      return noContent();
    }

    let payload: unknown;
    try {
      payload = JSON.parse(raw);
    } catch {
      return noContent();
    }
    if (typeof payload !== 'object' || payload === null || Array.isArray(payload)) {
      return noContent();
    }

    recordClientErrorSpan(payload as Record<string, unknown>);
    return noContent();
  } catch {
    // A telemetry sink must never 500 — swallow and acknowledge.
    return noContent();
  }
}
