import { NextResponse } from 'next/server';
import { setBudget } from '@/lib/meta-api';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const { object_id, amount, type } = await req.json();
    if (!object_id || !amount || !type) {
      return NextResponse.json({ error: 'object_id + amount + type required' }, { status: 400 });
    }
    if (!['daily', 'lifetime'].includes(type)) {
      return NextResponse.json({ error: 'type must be daily or lifetime' }, { status: 400 });
    }
    const result = await setBudget(object_id, Number(amount), type);
    return NextResponse.json({ ok: true, result });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
