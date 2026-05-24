import { NextResponse } from 'next/server';
import { listPromotePages } from '@/lib/meta-api';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const accountId = url.searchParams.get('account_id');
    if (!accountId) return NextResponse.json({ error: 'account_id required' }, { status: 400 });
    const data = await listPromotePages(accountId);
    return NextResponse.json({ data });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
