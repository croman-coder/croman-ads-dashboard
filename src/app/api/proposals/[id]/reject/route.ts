import { NextResponse } from 'next/server';
import { getProposal, updateProposalStatus } from '@/lib/proposal-store';
import { requireSession } from '@/lib/api-auth';

export const dynamic = 'force-dynamic';

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession();
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const note = typeof body?.note === 'string' ? body.note : undefined;
  try {
    const p = await getProposal(id);
    if (!p) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });
    if (p.status !== 'pending') {
      return NextResponse.json({ error: `Estado ${p.status}, no se puede rechazar` }, { status: 409 });
    }
    const r = await updateProposalStatus(id, {
      status: 'rejected',
      decided_by: session.email,
      decision_note: note,
    });
    return NextResponse.json({ ok: true, data: r });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 });
  }
}
