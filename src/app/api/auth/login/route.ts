import { NextResponse } from 'next/server';
import { createSessionToken, SESSION_CONFIG } from '@/lib/auth';
import { rateLimit, getClientIp } from '@/lib/rate-limit';
import { findUserByEmail, verifyPassword, touchLastLogin, audit } from '@/lib/user-store';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
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

    const user = await findUserByEmail(email.trim());
    if (!user || !user.is_active) {
      return NextResponse.json({ error: 'Credenciales inválidas' }, { status: 401 });
    }

    const ok = await verifyPassword(password, user.password_hash);
    if (!ok) {
      return NextResponse.json({ error: 'Credenciales inválidas' }, { status: 401 });
    }

    await touchLastLogin(user.id);
    await audit({ user_id: user.id, user_email: user.email, action: 'login', ip });

    const token = await createSessionToken({ userId: user.id, email: user.email, role: user.role });
    const res = NextResponse.json({ ok: true, email: user.email, role: user.role, full_name: user.full_name });
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
