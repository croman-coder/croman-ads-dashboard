import { NextResponse } from 'next/server';
import { listAccounts } from '@/lib/meta-api';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const data = await listAccounts();
    return NextResponse.json({ data });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
