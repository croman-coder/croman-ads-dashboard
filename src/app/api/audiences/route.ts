import { NextResponse } from 'next/server';
import { requireSession } from '@/lib/api-auth';
import { listCustomAudiences } from '@/lib/meta-api';
import { insertProposal } from '@/lib/proposal-store';
import { audit } from '@/lib/user-store';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const session = await requireSession();
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const url = new URL(req.url);
  const account = url.searchParams.get('account_id');
  if (!account) return NextResponse.json({ error: 'account_id required' }, { status: 400 });
  try {
    const audiences = await listCustomAudiences(account);
    return NextResponse.json({ audiences });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 });
  }
}

/**
 * Create custom audience (pixel|engagement). Routes through approval gate.
 * Returns 202 { status:'pending', proposal_id }.
 */
export async function POST(req: Request) {
  const session = await requireSession();
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const b = await req.json();
  const { account_id, source, name } = b as Record<string, string>;
  if (!account_id || !source || !name) {
    return NextResponse.json({ error: 'account_id, source, name requeridos' }, { status: 400 });
  }
  if (source !== 'pixel' && source !== 'engagement') {
    return NextResponse.json({ error: 'source debe ser pixel o engagement' }, { status: 400 });
  }

  const { id } = await insertProposal({
    proposed_by: session.email,
    account_id,
    action: 'create_audience',
    scope: 'audience',
    scope_name: name,
    payload: b,
    reason: `Crear audiencia ${source}: ${name}`,
  });
  await audit({ user_id: session.userId, user_email: session.email, action: 'audience.propose', target_type: 'audience', target_id: id, metadata: { source } });
  return NextResponse.json({ status: 'pending', proposal_id: id }, { status: 202 });
}
