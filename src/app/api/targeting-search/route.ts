import { NextResponse } from 'next/server';
import { requireSession } from '@/lib/api-auth';
import { searchInterests } from '@/lib/meta-api';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const session = await requireSession();
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const q = new URL(req.url).searchParams.get('q')?.trim();
  if (!q || q.length < 2) return NextResponse.json({ interests: [] });
  try {
    const interests = await searchInterests(q);
    return NextResponse.json({ interests });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 });
  }
}
