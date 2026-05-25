import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/api-auth';
import { getUserAccounts, setUserAccounts, audit } from '@/lib/user-store';

export const dynamic = 'force-dynamic';

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const { id } = await ctx.params;
  const accounts = await getUserAccounts(id);
  return NextResponse.json({ accounts });
}

export async function PUT(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const { id } = await ctx.params;
  const body = await req.json();
  const grants = (body.accounts || []) as Array<{ account_id: string; account_name?: string }>;
  try {
    await setUserAccounts(
      id,
      grants.map((g) => ({ account_id: g.account_id, account_name: g.account_name ?? null })),
      admin.userId
    );
    await audit({ user_id: admin.userId, user_email: admin.email, action: 'user.accounts', target_type: 'user', target_id: id, metadata: { count: grants.length } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 400 });
  }
}
