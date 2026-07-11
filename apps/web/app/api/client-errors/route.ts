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
// Bound the number of context entries examined (counted per iteration, before the
// scalar-type filter) so a hostile payload can't force unbounded attribute work.
const MAX_CONTEXT_KEYS = 24;

// Truncate a known string to the per-attribute cap.
function clamp(value: string): string {
  return value.length > MAX_STRING_LENGTH ? value.slice(0, MAX_STRING_LENGTH) : value;
}

function clampString(value: unknown): string | undefined {
  return typeof value === 'string' ? clamp(value) : undefined;
}

// --- Same-origin guard (#806) -------------------------------------------------
//
// This endpoint is public and unauthenticated, and every accepted request records
// a *retained* ERROR span (the ADR-020 `errors` tail-sampling policy always keeps
// it). A page on any origin can therefore `navigator.sendBeacon('<app-origin>/api/
// client-errors', …)` from a victim's browser — sendBeacon is a CORS-"simple"
// request, so the browser sends it cross-origin with no preflight — and inject
// always-retained spans into the shared free-tier Grafana Cloud / Tempo stack.
// This guard drops such cross-origin browser beacons. Scripted / no-Origin abuse
// (curl) is out of scope here: it is the job of an infra-level rate limit
// (Cloud Armor / edge), tracked separately — see the ADR-020 #806 addendum.
//
// SAFETY — why this is observe-only until deliberately enabled. A false drop
// (classifying legit same-origin traffic as cross-origin) would *silently* kill
// this best-effort telemetry, with no error surfaced. So:
//   * The verdict is ALWAYS recorded as the `client.origin.check` span attribute,
//     even when nothing is dropped — the signal used to validate this guard in
//     staging (against the real LB/proxy chain) before enforcement is turned on.
//   * A request is only ever DROPPED when classified cross-origin via the robust
//     CLIENT_ERROR_ALLOWED_ORIGINS allowlist — never via the zero-config
//     Origin-host-vs-Host heuristic, whose entire risk is that an LB rewriting the
//     Host header could make legit same-origin traffic look cross-origin.
//
// Enablement (ADR-020 #806 addendum): set CLIENT_ERROR_ALLOWED_ORIGINS to the
// app's public origin(s); confirm in staging Tempo that legit beacons tag
// `client.origin.check=same-origin`; then set CLIENT_ERROR_DROP_CROSS_ORIGIN=true.
type OriginVerdict = 'same-origin' | 'cross-origin' | 'no-origin';

interface OriginDecision {
  verdict: OriginVerdict;
  // The raw Origin header, retained only to tag the offending value on a
  // cross-origin verdict for triage. Null when the request carried no Origin.
  origin: string | null;
  // Reject before buffering the body / starting a span.
  drop: boolean;
  // Drop was requested (CLIENT_ERROR_DROP_CROSS_ORIGIN=true) but no allowlist is
  // configured, so we deliberately did NOT drop — the Host heuristic must never
  // enforce. Tagged on the recorded span so the misconfiguration is visible.
  enforceSkipped: boolean;
}

// Exact, case-insensitive origin allowlist from the env (comma-separated origins,
// e.g. "https://app.example.com,https://www.example.com"). Empty when unset. A
// trailing slash is stripped: a serialized `Origin` header never carries one, so
// an operator who copies "https://app.example.com/" from a browser must not thereby
// have every legit same-origin beacon classified cross-origin (and, under
// enforcement, silently dropped).
function parseAllowedOrigins(raw: string | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(',')
    .map((o) => o.trim().toLowerCase().replace(/\/+$/, ''))
    .filter(Boolean);
}

// Zero-config, OBSERVE-ONLY heuristic: does the Origin's host match the request's
// Host header? Never used to drop (see the safety note above) — only to produce a
// staging verdict when no allowlist is configured. A missing Host or a malformed
// Origin (e.g. the literal "null" browsers send for opaque origins) is treated as
// cross-origin.
function originHostMatchesHost(origin: string, host: string | null): boolean {
  if (!host) return false;
  try {
    return new URL(origin).host.toLowerCase() === host.toLowerCase();
  } catch {
    return false;
  }
}

function decideOrigin(request: Request): OriginDecision {
  const origin = request.headers.get('origin');
  const allowlist = parseAllowedOrigins(process.env.CLIENT_ERROR_ALLOWED_ORIGINS);
  const dropEnabled = process.env.CLIENT_ERROR_DROP_CROSS_ORIGIN === 'true';

  let verdict: OriginVerdict;
  if (!origin) {
    // Non-browser clients (curl/scripts) omit Origin, as does a same-origin
    // navigation — not the cross-origin-browser vector this guard targets. Allow.
    verdict = 'no-origin';
  } else if (allowlist.length > 0) {
    verdict = allowlist.includes(origin.toLowerCase()) ? 'same-origin' : 'cross-origin';
  } else {
    verdict = originHostMatchesHost(origin, request.headers.get('host'))
      ? 'same-origin'
      : 'cross-origin';
  }

  const wantDrop = dropEnabled && verdict === 'cross-origin';
  return {
    verdict,
    origin,
    // Only the allowlist path may enforce; the Host heuristic never drops.
    drop: wantDrop && allowlist.length > 0,
    enforceSkipped: wantDrop && allowlist.length === 0,
  };
}

function noContent(): NextResponse {
  // Beacons are fire-and-forget — the client ignores the response. A 204 (rather
  // than a 4xx on bad input) keeps garbage-in from polluting web-server error-rate
  // metrics; malformed payloads are simply dropped without a span.
  return new NextResponse(null, { status: 204 });
}

function recordClientErrorSpan(payload: Record<string, unknown>, origin: OriginDecision): void {
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

    // Origin provenance (#806) — always tagged, even when nothing is dropped, so
    // staging can validate the same-origin verdict against known-legit traffic
    // before CLIENT_ERROR_DROP_CROSS_ORIGIN is enabled. On a cross-origin verdict
    // the offending origin is recorded (clamped) for triage.
    span.setAttribute('client.origin.check', origin.verdict);
    if (origin.verdict === 'cross-origin' && origin.origin) {
      span.setAttribute('client.origin.value', clamp(origin.origin));
    }
    if (origin.enforceSkipped) {
      span.setAttribute('client.origin.enforce_skipped', true);
    }

    const { context } = payload;
    if (context && typeof context === 'object' && !Array.isArray(context)) {
      let keys = 0;
      for (const [key, value] of Object.entries(context as Record<string, unknown>)) {
        if (keys >= MAX_CONTEXT_KEYS) break;
        keys += 1;
        // Clamp the key too — a hostile payload could carry a multi-KB key within
        // the body cap. Only scalar domain ids become attributes; never serialize
        // arbitrary nested objects/arrays.
        const attrKey = `client.context.${clamp(key)}`;
        if (typeof value === 'string') {
          span.setAttribute(attrKey, clamp(value));
        } else if (typeof value === 'number' || typeof value === 'boolean') {
          span.setAttribute(attrKey, value);
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
    // Same-origin guard (#806). Evaluate the Origin first: when enforcement is on
    // and the request is a cross-origin browser beacon (per the allowlist), reject
    // it before buffering the body or starting a span — the cheapest path, and the
    // point of the guard: no retained ERROR span for cross-origin spam.
    const origin = decideOrigin(request);
    if (origin.drop) {
      return noContent();
    }

    // Reject oversized bodies by their declared length *before* buffering. This
    // endpoint is public/unauthenticated, so the size cap must be load-bearing
    // rather than applied only after the whole body is already in memory.
    const declaredLength = Number(request.headers.get('content-length'));
    if (Number.isFinite(declaredLength) && declaredLength > MAX_BODY_BYTES) {
      return noContent();
    }

    const raw = await request.text();
    // Byte length, not string .length (UTF-16 code units), so the cap is exact.
    if (raw.length === 0 || new TextEncoder().encode(raw).length > MAX_BODY_BYTES) {
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

    recordClientErrorSpan(payload as Record<string, unknown>, origin);
    return noContent();
  } catch {
    // A telemetry sink must never 500 — swallow and acknowledge.
    return noContent();
  }
}
