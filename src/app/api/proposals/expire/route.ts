import { NextResponse } from 'next/server';
import { expireStaleProposals } from '@/lib/proposal-store';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const authHeader = req.headers.get('authorization');
  const expected = `Bearer ${process.env.CRON_SECRET}`;
  if (!process.env.CRON_SECRET || authHeader !== expected) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }
  try {
    const n = await expireStaleProposals();
    return NextResponse.json({ ok: true, expired: n });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 });
  }
}
