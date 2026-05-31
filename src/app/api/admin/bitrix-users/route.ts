import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/api-auth';
import { listBitrixUsers, isBitrixConfigured } from '@/lib/bitrix';

export const dynamic = 'force-dynamic';

export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (!isBitrixConfigured()) return NextResponse.json({ error: 'BITRIX_WEBHOOK_URL ausente', users: [] }, { status: 503 });
  try {
    const users = await listBitrixUsers();
    return NextResponse.json({ users });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 });
  }
}
