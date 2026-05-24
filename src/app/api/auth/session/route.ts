import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifySessionToken, SESSION_CONFIG } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET() {
  const store = await cookies();
  const token = store.get(SESSION_CONFIG.cookieName)?.value;
  if (!token) return NextResponse.json({ authenticated: false });
  const session = await verifySessionToken(token);
  if (!session) return NextResponse.json({ authenticated: false });
  return NextResponse.json({ authenticated: true, email: session.email });
}
