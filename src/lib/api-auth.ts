import { cookies } from 'next/headers';
import { verifySessionToken, SESSION_CONFIG } from './auth';

export async function requireSession(): Promise<{ email: string } | null> {
  const store = await cookies();
  const token = store.get(SESSION_CONFIG.cookieName)?.value;
  if (!token) return null;
  return await verifySessionToken(token);
}
