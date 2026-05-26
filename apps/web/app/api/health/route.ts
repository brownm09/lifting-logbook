import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';

const API_URL = process.env.API_URL ?? 'http://localhost:3004';

// Authenticated health check — verifies the full auth path:
// browser session cookies → Clerk server-side validation → backend API.
// Used by staging integration tests (test 5) to confirm auth propagation
// without relying on window.Clerk.session, which is unreliable in dev mode.
export async function GET() {
  const { getToken } = await auth();
  const token = await getToken();

  if (!token) {
    // 403 = Clerk session present but getToken() returned null (dev-mode TTL or invalid session)
    return NextResponse.json({ error: 'unauthenticated' }, { status: 403 });
  }

  const res = await fetch(`${API_URL}/users/me/settings`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  });

  if (!res.ok) {
    return NextResponse.json(
      { error: `api returned ${res.status}` },
      { status: 503 },
    );
  }

  return NextResponse.json({ ok: true });
}
