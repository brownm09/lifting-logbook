// Central chokepoint for reporting client-side (browser) mutation failures.
//
// Every write in lib/client-api.ts is invoked from a Client Component. On failure
// the calling form shows a generic user-facing message; before #783 most forms
// discarded the underlying error, so a real production write failure (CORS, 5xx,
// network drop, auth expiry) surfaced only as that generic string with nothing
// recorded — the exact blind spot that kept the ~month-long CORS outage (#766)
// invisible in production.
//
// This helper guarantees the caught error always reaches the browser console in a
// consistent, greppable shape, so a failure is diagnosable from devtools — the
// minimum bar set by #783. It is also the single place where web OTel export would
// attach once browser tracing is wired: today apps/web instruments only the server
// runtime via @vercel/otel (see instrumentation.ts), so there is no browser
// span/log exporter yet. Routing every call site through here means that upgrade
// touches one file instead of a dozen.
//
// Safe to log the caught error as-is: @lifting-logbook/api-client only ever throws
// `Error(message)` / `ApiClientError(message, status)` where message is the
// server's validation text or `API <status> <statusText> for <path>`. It never
// embeds the Authorization header, bearer token, or request body — so callers must
// likewise never pass secrets or raw request bodies in `context`.

/**
 * Report a client-side mutation failure so it is diagnosable in production.
 *
 * @param operation The client-api mutation that failed, e.g. `'rescheduleWorkout'`.
 *                  Used as a stable, greppable log prefix.
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
}
