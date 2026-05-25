import { NextResponse } from 'next/server';
import { listAccounts } from '@/lib/meta-api';
import { requireSession } from '@/lib/api-auth';
import { getUserAccounts } from '@/lib/user-store';

export const dynamic = 'force-dynamic';

type Account = { id: string; name: string; currency: string };

export async function GET() {
  try {
    const session = await requireSession();
    if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

    const data = (await listAccounts()) as Account[];

    // Admin → sees everything Meta returns.
    // Operator/viewer → filter to the accounts explicitly granted in user_account_access.
    if (session.role === 'admin') {
      return NextResponse.json({ data });
    }
    const grants = await getUserAccounts(session.userId);
    const allowed = new Set(grants.map((g) => g.account_id));
    const filtered = data.filter((a) => allowed.has(a.id) || allowed.has(`act_${a.id}`));
    return NextResponse.json({ data: filtered });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
