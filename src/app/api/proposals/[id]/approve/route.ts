import { NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';
import { lockPendingForApproval, updateProposalStatus } from '@/lib/proposal-store';
import { executeProposal } from '@/lib/proposal-executor';
import { requireSession } from '@/lib/api-auth';

export const dynamic = 'force-dynamic';

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession();
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const note = typeof body?.note === 'string' ? body.note : undefined;

  try {
    await sql.query('BEGIN');
    const proposal = await lockPendingForApproval(id);
    if (!proposal) {
      await sql.query('ROLLBACK');
      return NextResponse.json({ error: 'No disponible (procesado/expirado)' }, { status: 409 });
    }
    await updateProposalStatus(id, {
      status: 'approved',
      decided_by: session.email,
      decision_note: note,
    });
    await sql.query('COMMIT');

    const exec = await executeProposal(proposal);
    if (exec.ok) {
      const r = await updateProposalStatus(id, {
        status: 'executed',
        meta_response: exec.meta_response,
        executed_at: new Date(),
      });
      return NextResponse.json({ ok: true, data: r });
    } else {
      const r = await updateProposalStatus(id, { status: 'failed', error: exec.error });
      return NextResponse.json({ ok: false, error: exec.error, data: r }, { status: 502 });
    }
  } catch (e) {
    try { await sql.query('ROLLBACK'); } catch {}
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 });
  }
}
