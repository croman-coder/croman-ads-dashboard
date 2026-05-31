import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/api-auth';
import { listPageRoutes, setPageRoute, deletePageRoute, audit } from '@/lib/user-store';

export const dynamic = 'force-dynamic';

export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const routes = await listPageRoutes();
  return NextResponse.json({ routes });
}

export async function PUT(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const b = await req.json();
  const { page_id, page_name, bitrix_user_id } = b as { page_id?: string; page_name?: string; bitrix_user_id?: string };
  if (!page_id || !bitrix_user_id) {
    return NextResponse.json({ error: 'page_id + bitrix_user_id requeridos' }, { status: 400 });
  }
  await setPageRoute(page_id, page_name ?? null, bitrix_user_id, admin.userId);
  await audit({ user_id: admin.userId, user_email: admin.email, action: 'page_routing.set', target_type: 'page', target_id: page_id, metadata: { bitrix_user_id } });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const pageId = new URL(req.url).searchParams.get('page_id');
  if (!pageId) return NextResponse.json({ error: 'page_id required' }, { status: 400 });
  await deletePageRoute(pageId);
  return NextResponse.json({ ok: true });
}
