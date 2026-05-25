import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifySessionToken, SESSION_CONFIG } from '@/lib/auth';
import { findUserById, getUserAccounts } from '@/lib/user-store';

export const dynamic = 'force-dynamic';

export async function GET() {
  const store = await cookies();
  const token = store.get(SESSION_CONFIG.cookieName)?.value;
  if (!token) return NextResponse.json({ authenticated: false });
  const session = await verifySessionToken(token);
  if (!session) return NextResponse.json({ authenticated: false });

  // Hydrate richer profile + permissions from DB so the topbar / UI can show
  // role badge and the accounts dropdown can filter without an extra call.
  const user = await findUserById(session.userId).catch(() => null);
  if (!user || !user.is_active) {
    return NextResponse.json({ authenticated: false });
  }
  const accounts = await getUserAccounts(session.userId).catch(() => []);
  return NextResponse.json({
    authenticated: true,
    email: user.email,
    full_name: user.full_name,
    role: user.role,
    user_id: user.id,
    accounts,
  });
}
