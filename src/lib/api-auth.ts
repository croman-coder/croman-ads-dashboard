import { cookies } from 'next/headers';
import { verifySessionToken, SESSION_CONFIG, type SessionPayload } from './auth';

export async function requireSession(): Promise<SessionPayload | null> {
  const store = await cookies();
  const token = store.get(SESSION_CONFIG.cookieName)?.value;
  if (!token) return null;
  return await verifySessionToken(token);
}

export async function requireAdmin(): Promise<SessionPayload | null> {
  const s = await requireSession();
  if (!s || s.role !== 'admin') return null;
  return s;
}
