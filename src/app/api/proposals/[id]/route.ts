import { NextResponse } from 'next/server';
import { getProposal } from '@/lib/proposal-store';
import { requireSession } from '@/lib/api-auth';

export const dynamic = 'force-dynamic';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession();
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  const { id } = await params;
  try {
    const p = await getProposal(id);
    if (!p) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });
    return NextResponse.json({ data: p });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 });
  }
}
