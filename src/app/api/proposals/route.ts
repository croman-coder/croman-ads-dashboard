import { NextResponse } from 'next/server';
import { listProposals, countPending, type ProposalStatus, type ProposalAction } from '@/lib/proposal-store';
import { requireSession } from '@/lib/api-auth';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const session = await requireSession();
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const url = new URL(req.url);
  const status = url.searchParams.get('status') ?? undefined;
  const action = url.searchParams.get('action') ?? undefined;
  const account_id = url.searchParams.get('account_id') ?? undefined;
  const countOnly = url.searchParams.get('count') === 'true';

  try {
    if (countOnly) {
      const n = await countPending(account_id);
      return NextResponse.json({ count: n });
    }
    const data = await listProposals({
      status: status as ProposalStatus | undefined,
      action: action as ProposalAction | undefined,
      account_id,
      limit: Number(url.searchParams.get('limit') || 200),
      offset: Number(url.searchParams.get('offset') || 0),
    });
    return NextResponse.json({ data });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 });
  }
}
