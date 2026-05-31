import { NextResponse } from 'next/server';
import { requireSession } from '@/lib/api-auth';
import { getReachEstimate } from '@/lib/meta-api';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const session = await requireSession();
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const b = await req.json();
  const { account_id, targeting, optimization_goal } = b as {
    account_id?: string;
    targeting?: Record<string, unknown>;
    optimization_goal?: string;
  };
  if (!account_id || !targeting) {
    return NextResponse.json({ error: 'account_id + targeting requeridos' }, { status: 400 });
  }
  try {
    const est = await getReachEstimate(account_id, { targeting, optimization_goal });
    return NextResponse.json({ estimate: est });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 });
  }
}
