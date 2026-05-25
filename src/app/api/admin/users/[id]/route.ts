import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/api-auth';
import { updateUserRole, setUserActive, changePassword, audit, type Role } from '@/lib/user-store';

export const dynamic = 'force-dynamic';

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const { id } = await ctx.params;
  const body = await req.json();
  const { role, is_active, password } = body as { role?: Role; is_active?: boolean; password?: string };

  if (id === admin.userId && is_active === false) {
    return NextResponse.json({ error: 'No podés desactivarte a vos mismo' }, { status: 400 });
  }
  if (id === admin.userId && role && role !== 'admin') {
    return NextResponse.json({ error: 'No podés degradar tu propio rol' }, { status: 400 });
  }

  try {
    if (role) {
      await updateUserRole(id, role);
      await audit({ user_id: admin.userId, user_email: admin.email, action: 'user.role', target_type: 'user', target_id: id, metadata: { role } });
    }
    if (typeof is_active === 'boolean') {
      await setUserActive(id, is_active);
      await audit({ user_id: admin.userId, user_email: admin.email, action: 'user.active', target_type: 'user', target_id: id, metadata: { is_active } });
    }
    if (password) {
      if (password.length < 8) return NextResponse.json({ error: 'Contraseña mínimo 8 caracteres' }, { status: 400 });
      await changePassword(id, password);
      await audit({ user_id: admin.userId, user_email: admin.email, action: 'user.password_reset', target_type: 'user', target_id: id });
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 400 });
  }
}
