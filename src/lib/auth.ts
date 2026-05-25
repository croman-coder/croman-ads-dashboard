/**
 * Lightweight JWT-based auth. Uses `jose` (edge-compatible).
 * Session payload now includes user id + role so middleware can gate routes
 * and the per-request handler can authorize without an extra DB lookup.
 */
import { SignJWT, jwtVerify } from 'jose';

const SESSION_COOKIE = 'croman_ads_session';
const SESSION_DURATION = 60 * 60 * 24 * 7; // 7 days

export type Role = 'admin' | 'operator' | 'viewer';
export type SessionPayload = {
  userId: string;
  email: string;
  role: Role;
};

function getSecret(): Uint8Array {
  const s = process.env.AUTH_SECRET;
  if (!s || s.length < 32) {
    throw new Error('AUTH_SECRET missing or too short (need ≥32 chars)');
  }
  return new TextEncoder().encode(s);
}

export async function createSessionToken(p: SessionPayload): Promise<string> {
  return await new SignJWT({ userId: p.userId, email: p.email, role: p.role })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DURATION}s`)
    .sign(getSecret());
}

export async function verifySessionToken(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    if (
      typeof payload.userId === 'string' &&
      typeof payload.email === 'string' &&
      (payload.role === 'admin' || payload.role === 'operator' || payload.role === 'viewer')
    ) {
      return { userId: payload.userId, email: payload.email, role: payload.role };
    }
    return null;
  } catch {
    return null;
  }
}

export const SESSION_CONFIG = {
  cookieName: SESSION_COOKIE,
  maxAge: SESSION_DURATION,
};
