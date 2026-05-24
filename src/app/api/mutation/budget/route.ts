import { NextResponse } from 'next/server';
import { setBudget } from '@/lib/meta-api';

export const dynamic = 'force-dynamic';

const MAX_BUDGET_USD = Number(process.env.BUDGET_CAP_USD || 1000);

export async function POST(req: Request) {
  try {
    const { object_id, amount, type } = await req.json();
    if (!object_id || amount === undefined || amount === null || !type) {
      return NextResponse.json({ error: 'object_id + amount + type required' }, { status: 400 });
    }
    if (!['daily', 'lifetime'].includes(type)) {
      return NextResponse.json({ error: 'type must be daily or lifetime' }, { status: 400 });
    }
    const num = Number(amount);
    if (!Number.isFinite(num) || num <= 0) {
      return NextResponse.json({ error: 'Monto inválido' }, { status: 400 });
    }
    if (num > MAX_BUDGET_USD) {
      return NextResponse.json({
        error: `Presupuesto excede el tope permitido USD ${MAX_BUDGET_USD}. Solicitado USD ${num.toFixed(2)}.`,
        cap: MAX_BUDGET_USD,
      }, { status: 422 });
    }
    if (typeof object_id !== 'string' || !/^\d+$/.test(object_id)) {
      return NextResponse.json({ error: 'object_id inválido' }, { status: 400 });
    }
    const result = await setBudget(object_id, num, type);
    return NextResponse.json({ ok: true, result, cap: MAX_BUDGET_USD });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
