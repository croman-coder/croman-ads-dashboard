import { NextResponse } from 'next/server';
import { setStatus } from '@/lib/meta-api';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const { object_id, status } = await req.json();
    if (!object_id || !status) {
      return NextResponse.json({ error: 'object_id + status required' }, { status: 400 });
    }
    const result = await setStatus(object_id, status);
    return NextResponse.json({ ok: true, result });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
