import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';

// Readiness probe target. Must not be statically rendered or edge-cached —
// otherwise the same Clerk-init failure mode (#382) that broke production
// would again be hidden from Kubernetes during rollout.
export const dynamic = 'force-dynamic';

export async function GET() {
  if (process.env.DEV_AUTH_TOKEN) {
    return NextResponse.json({ ok: true, mode: 'dev-auth' });
  }
  try {
    await auth();
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'unknown' },
      { status: 503 },
    );
  }
}
