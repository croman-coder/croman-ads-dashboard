import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { createSessionToken, SESSION_CONFIG } from '@/lib/auth';
import { rateLimit, getClientIp } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    // Rate limit: 5 login attempts per 15 min per IP
    const ip = getClientIp(req);
    const rl = rateLimit(`login:${ip}`, 5, 900);
    if (!rl.allowed) {
      const retrySec = Math.ceil((rl.resetAt - Date.now()) / 1000);
      return NextResponse.json(
        { error: `Demasiados intentos. Reintentar en ${retrySec}s.` },
        { status: 429, headers: { 'Retry-After': String(retrySec) } }
      );
    }

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Body inválido' }, { status: 400 });
    }
    const { email, password } = body as { email?: string; password?: string };
    if (!email || !password || typeof email !== 'string' || typeof password !== 'string') {
      return NextResponse.json({ error: 'Email y contraseña requeridos' }, { status: 400 });
    }
    if (email.length > 200 || password.length > 200) {
      return NextResponse.json({ error: 'Credenciales inválidas' }, { status: 401 });
    }

    const expectedEmail = process.env.AUTH_EMAIL;
    const hashB64 = process.env.AUTH_PASSWORD_HASH_B64;
    const hashRaw = process.env.AUTH_PASSWORD_HASH;
    const passwordHash = hashB64 ? Buffer.from(hashB64, 'base64').toString('utf8') : hashRaw;
    if (!expectedEmail || !passwordHash) {
      return NextResponse.json({ error: 'Auth no configurada (env vars missing)' }, { status: 500 });
    }

    if (email.toLowerCase().trim() !== expectedEmail.toLowerCase().trim()) {
      return NextResponse.json({ error: 'Credenciales inválidas' }, { status: 401 });
    }

    const ok = await bcrypt.compare(password, passwordHash);
    if (!ok) {
      return NextResponse.json({ error: 'Credenciales inválidas' }, { status: 401 });
    }

    const token = await createSessionToken(email);
    const res = NextResponse.json({ ok: true, email });
    res.cookies.set(SESSION_CONFIG.cookieName, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: SESSION_CONFIG.maxAge,
      path: '/',
    });
    return res;
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
