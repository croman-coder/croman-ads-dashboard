import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { createSessionToken, SESSION_CONFIG } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const { email, password } = await req.json();
    if (!email || !password) {
      return NextResponse.json({ error: 'Email y contraseña requeridos' }, { status: 400 });
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
