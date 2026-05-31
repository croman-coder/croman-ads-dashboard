import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/api-auth';
import { setBitrixUserId, audit } from '@/lib/user-store';

export const dynamic = 'force-dynamic';

export async function PUT(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const { id } = await ctx.params;
  const b = await req.json();
  const bitrix_user_id = b.bitrix_user_id ? String(b.bitrix_user_id) : null;
  await setBitrixUserId(id, bitrix_user_id);
  await audit({ user_id: admin.userId, user_email: admin.email, action: 'user.bitrix_map', target_type: 'user', target_id: id, metadata: { bitrix_user_id } });
  return NextResponse.json({ ok: true });
}
