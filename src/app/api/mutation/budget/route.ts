import { NextResponse } from 'next/server';
import { setBudget, getCurrentBudget } from '@/lib/meta-api';
import { requiresApproval } from '@/lib/approval-policy';
import { insertProposal } from '@/lib/proposal-store';
import { requireSession } from '@/lib/api-auth';

export const dynamic = 'force-dynamic';

const MAX_BUDGET_USD = Number(process.env.BUDGET_CAP_USD || 1000);

export async function POST(req: Request) {
  const session = await requireSession();
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  try {
    const { object_id, amount, type, account_id, scope_name } = await req.json();
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
      return NextResponse.json(
        { error: `Excede tope USD ${MAX_BUDGET_USD}`, cap: MAX_BUDGET_USD },
        { status: 422 }
      );
    }
    if (typeof object_id !== 'string' || !/^\d+$/.test(object_id)) {
      return NextResponse.json({ error: 'object_id inválido' }, { status: 400 });
    }

    if (requiresApproval('set_budget')) {
      const snapshot = await getCurrentBudget(object_id).catch(() => null);
      const proposal = await insertProposal({
        proposed_by: session.email,
        account_id: account_id || 'unknown',
        action: 'set_budget',
        scope: 'campaign',
        scope_id: object_id,
        scope_name: scope_name || object_id,
        payload: { object_id, amount: num, type },
        current_state: snapshot ?? undefined,
      });
      return NextResponse.json(
        { status: 'pending', proposal_id: proposal.id, message: 'Encolado para aprobación' },
        { status: 202 }
      );
    }

    const result = await setBudget(object_id, num, type);
    return NextResponse.json({ ok: true, result });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 });
  }
}
