import { NextResponse } from 'next/server';
import { requireSession } from '@/lib/api-auth';
import { insertProposal } from '@/lib/proposal-store';
import { audit } from '@/lib/user-store';

export const dynamic = 'force-dynamic';

/** Create lookalike from seed audience → approval gate. */
export async function POST(req: Request) {
  const session = await requireSession();
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const b = await req.json();
  const { account_id, name, origin_audience_id, ratio = 0.02, country = 'PY' } = b as Record<string, string | number>;
  if (!account_id || !name || !origin_audience_id) {
    return NextResponse.json({ error: 'account_id, name, origin_audience_id requeridos' }, { status: 400 });
  }
  const { id } = await insertProposal({
    proposed_by: session.email,
    account_id: String(account_id),
    action: 'create_lookalike',
    scope: 'audience',
    scope_name: String(name),
    payload: { account_id, name, origin_audience_id, ratio, country },
    reason: `Lookalike ${(Number(ratio) * 100).toFixed(0)}% ${country} desde ${origin_audience_id}`,
  });
  await audit({ user_id: session.userId, user_email: session.email, action: 'lookalike.propose', target_type: 'audience', target_id: id });
  return NextResponse.json({ status: 'pending', proposal_id: id }, { status: 202 });
}
