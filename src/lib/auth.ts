/**
 * Lightweight JWT-based auth. Uses `jose` (edge-compatible).
 * Hashed password stored in env (AUTH_PASSWORD_HASH). Plaintext never lives in code.
 */
import { SignJWT, jwtVerify } from 'jose';

const SESSION_COOKIE = 'croman_ads_session';
const SESSION_DURATION = 60 * 60 * 24 * 7; // 7 days

function getSecret(): Uint8Array {
  const s = process.env.AUTH_SECRET;
  if (!s || s.length < 32) {
    throw new Error('AUTH_SECRET missing or too short (need ≥32 chars)');
  }
  return new TextEncoder().encode(s);
}

export async function createSessionToken(email: string): Promise<string> {
  return await new SignJWT({ email })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DURATION}s`)
    .sign(getSecret());
}

export async function verifySessionToken(token: string): Promise<{ email: string } | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    if (typeof payload.email === 'string') {
      return { email: payload.email };
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
