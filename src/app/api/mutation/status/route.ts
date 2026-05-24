import { NextResponse } from 'next/server';
import { setStatus } from '@/lib/meta-api';
import { requiresApproval } from '@/lib/approval-policy';
import { insertProposal } from '@/lib/proposal-store';
import { requireSession } from '@/lib/api-auth';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const session = await requireSession();
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  try {
    const { object_id, status, account_id, scope_name, scope } = await req.json();
    if (!object_id || !status) {
      return NextResponse.json({ error: 'object_id + status required' }, { status: 400 });
    }
    if (typeof object_id !== 'string' || !/^\d+$/.test(object_id)) {
      return NextResponse.json({ error: 'object_id inválido' }, { status: 400 });
    }

    const upper = String(status).toUpperCase();
    if (upper === 'ACTIVE' && requiresApproval('activate')) {
      const proposal = await insertProposal({
        proposed_by: session.email,
        account_id: account_id || 'unknown',
        action: 'activate',
        scope: scope || 'campaign',
        scope_id: object_id,
        scope_name: scope_name || object_id,
        payload: { object_id },
        current_state: { status: 'PAUSED' },
      });
      return NextResponse.json(
        { status: 'pending', proposal_id: proposal.id, message: 'Activación encolada' },
        { status: 202 }
      );
    }

    const result = await setStatus(object_id, upper);
    return NextResponse.json({ ok: true, result });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 });
  }
}
