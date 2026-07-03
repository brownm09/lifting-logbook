import { NextResponse } from 'next/server';
import { deleteCurrentCycle } from '@/lib/api';

// Test-support endpoint for the staging Playwright suite (issue #647). Deletes the
// requesting user's current cycle (and its dependent rows) so the onboarding write-
// path test can run repeatedly against the same account without hitting the
// "cycle already exists" short-circuit in switchProgram
// (apps/api/src/programs/switch-program.controller.ts).
//
// Uses the SAME auth mechanism as the real "Start My Program" flow (lib/api.ts's
// X-Clerk-Authorization strategy) rather than a special-cased path — see
// docs/adr/ADR-023-staging-integration-test-design.md's "Alternatives Considered"
// for why the two more "obvious" shortcuts (server getToken()+forward, client
// getToken()+direct-fetch) are both already known to be flaky against this
// specific staging Clerk instance; this route intentionally does not reinvent
// either.
//
// Not linked from any UI; not documented as a public API.
export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const program = searchParams.get('program') ?? 'rpt';

  try {
    await deleteCurrentCycle(program);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(`[reset-cycle] failed for program "${program}":`, e);
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
