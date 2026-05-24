import { NextResponse } from 'next/server';
import { updateTargeting } from '@/lib/meta-api';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const { adset_id, targeting } = await req.json();
    if (!adset_id || !targeting) {
      return NextResponse.json({ error: 'adset_id + targeting required' }, { status: 400 });
    }
    const result = await updateTargeting(adset_id, targeting);
    return NextResponse.json({ ok: true, result });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
