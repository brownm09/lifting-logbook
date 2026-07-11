// Central chokepoint for reporting client-side (browser) mutation failures.
//
// Every write in lib/client-api.ts is invoked from a Client Component. On failure
// the calling form shows a generic user-facing message; before #783 most forms
// discarded the underlying error, so a real production write failure (CORS, 5xx,
// network drop, auth expiry) surfaced only as that generic string with nothing
// recorded — the exact blind spot that kept the ~month-long CORS outage (#766)
// invisible in production.
//
// This helper does two best-effort things with the caught error:
//   1. console.error in a consistent, greppable shape so a failure is diagnosable
//      from browser devtools — the minimum bar set by #783.
//   2. Beacons it to the same-origin `/api/client-errors` route handler (#798),
//      which records it as an OTel error span so it lands in Grafana (Tempo).
//      apps/web instruments only the server runtime via @vercel/otel (see
//      instrumentation.ts) — there is no browser OTel SDK — so this same-origin
//      beacon is how a browser failure reaches the backend telemetry pipeline.
//      Routing every call site through here means the export attaches in one file.
//
// Safe to log and send the caught error as-is: @lifting-logbook/api-client only
// ever throws `Error(message)` / `ApiClientError(message, status)` where message
// is the server's validation text or `API <status> <statusText> for <path>`. It
// never embeds the Authorization header, bearer token, or request body — so
// callers must likewise never pass secrets or raw request bodies in `context`.

// Same-origin path — kept in sync with the route handler at
// apps/web/app/api/client-errors/route.ts.
const CLIENT_ERROR_ENDPOINT = '/api/client-errors';

interface ClientErrorReport {
  operation: string;
  name?: string;
  message: string;
  context?: Record<string, unknown>;
}

function buildReport(
  operation: string,
  error: unknown,
  context?: Record<string, unknown>,
): ClientErrorReport {
  const report: ClientErrorReport = {
    operation,
    message: error instanceof Error ? error.message : String(error),
  };
  if (error instanceof Error && error.name) report.name = error.name;
  if (context && Object.keys(context).length > 0) report.context = context;
  return report;
}

// Best-effort, non-blocking, browser-only. Never throws — a telemetry dispatch
// must never disrupt the caller's catch block.
//
// navigator.sendBeacon is purpose-built for this: fire-and-forget, and it survives
// page unload (a failed mutation may be navigating away as it reports). It is
// same-origin, so it needs no auth header and triggers no CORS. We deliberately do
// NOT fall back to fetch(): apps/web forbids raw fetch() in app/lib (the
// `no-raw-fetch-outside-api-client` lint rule — API calls must route through the
// typed api-client for auth headers), and sendBeacon is universally supported in
// the app's target browsers. If sendBeacon is unavailable or its queue is full,
// this one report is dropped — the console.error above still records the failure.
function dispatchClientErrorBeacon(
  operation: string,
  error: unknown,
  context?: Record<string, unknown>,
): void {
  try {
    if (typeof navigator === 'undefined' || typeof navigator.sendBeacon !== 'function') {
      return;
    }
    // buildReport runs String(error) on non-Error values, which can itself throw
    // (e.g. a null-prototype object or a throwing toString) — so it must live
    // inside this try, or that throw would leak into the caller's catch block and
    // break the "never throws" contract below.
    const report = buildReport(operation, error, context);
    // Send the JSON as a string body (Content-Type: text/plain). The route handler
    // reads the raw text and JSON.parses it, so the content-type is immaterial — a
    // string is the conventional sendBeacon payload and avoids a Blob dependency.
    navigator.sendBeacon(CLIENT_ERROR_ENDPOINT, JSON.stringify(report));
  } catch {
    // Never let beacon dispatch (including report construction) throw into the caller.
  }
}

/**
 * Report a client-side mutation failure so it is diagnosable in production.
 *
 * @param operation The client-api mutation that failed, e.g. `'rescheduleWorkout'`.
 *                  Used as a stable, greppable log prefix and the span operation.
 * @param error     The caught error, logged as-is (typed `unknown` — a `catch`
 *                  binding can be anything).
 * @param context   Optional structured context (ids, action) to aid triage.
 *                  Never pass secrets, tokens, or request bodies.
 */
export function logClientError(
  operation: string,
  error: unknown,
  context?: Record<string, unknown>,
): void {
  if (context && Object.keys(context).length > 0) {
    console.error(`[client-mutation] ${operation} failed`, error, context);
  } else {
    console.error(`[client-mutation] ${operation} failed`, error);
  }
  dispatchClientErrorBeacon(operation, error, context);
}
