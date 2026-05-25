import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/api-auth';
import { listUsers, createUser, audit, type Role } from '@/lib/user-store';

export const dynamic = 'force-dynamic';

export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const users = await listUsers();
  return NextResponse.json({ users });
}

export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  try {
    const body = await req.json();
    const { email, password, full_name, role } = body as { email?: string; password?: string; full_name?: string; role?: Role };
    if (!email || !password) return NextResponse.json({ error: 'email + password requeridos' }, { status: 400 });
    if (password.length < 8) return NextResponse.json({ error: 'Contraseña mínimo 8 caracteres' }, { status: 400 });
    const user = await createUser({ email, password, full_name, role: role || 'operator', created_by: admin.userId });
    await audit({ user_id: admin.userId, user_email: admin.email, action: 'user.create', target_type: 'user', target_id: user.id, metadata: { email, role: user.role } });
    return NextResponse.json({ user });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 400 });
  }
}
