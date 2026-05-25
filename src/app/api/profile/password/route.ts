import { NextResponse } from 'next/server';
import { requireSession } from '@/lib/api-auth';
import { findUserById, findUserByEmail, verifyPassword, changePassword, audit } from '@/lib/user-store';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const session = await requireSession();
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const body = await req.json();
  const { current_password, new_password } = body as { current_password?: string; new_password?: string };
  if (!current_password || !new_password) return NextResponse.json({ error: 'current_password + new_password requeridos' }, { status: 400 });
  if (new_password.length < 8) return NextResponse.json({ error: 'Nueva contraseña mínimo 8 caracteres' }, { status: 400 });

  const me = await findUserById(session.userId);
  if (!me) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  // Need the hashed password too — refetch via email.
  const fullMe = await findUserByEmail(me.email);
  if (!fullMe) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const ok = await verifyPassword(current_password, fullMe.password_hash);
  if (!ok) return NextResponse.json({ error: 'Contraseña actual incorrecta' }, { status: 401 });

  await changePassword(me.id, new_password);
  await audit({ user_id: me.id, user_email: me.email, action: 'profile.password' });
  return NextResponse.json({ ok: true });
}
