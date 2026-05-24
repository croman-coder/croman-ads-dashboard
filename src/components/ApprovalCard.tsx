'use client';

import { useState } from 'react';
import type { Proposal } from '@/lib/proposal-store';
import { DiffViewer } from './DiffViewer';
import { Check, X, ChevronRight } from 'lucide-react';
import Link from 'next/link';

const ACTION_LABEL: Record<string, string> = {
  set_budget: 'Subir/bajar presupuesto',
  activate: 'Activar anuncio',
  create_campaign: 'Crear campaña',
  duplicate_campaign: 'Duplicar campaña',
};

function hoursLeft(expires_at: string): number {
  const ms = new Date(expires_at).getTime() - Date.now();
  return Math.max(0, Math.floor(ms / 3600_000));
}

interface Props {
  proposal: Proposal;
  onChange: () => void;
}

export function ApprovalCard({ proposal, onChange }: Props) {
  const [busy, setBusy] = useState<'approve' | 'reject' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const hrs = hoursLeft(proposal.expires_at);
  const urgent = hrs < 12;
  const isPending = proposal.status === 'pending';

  async function act(kind: 'approve' | 'reject') {
    setBusy(kind);
    setError(null);
    try {
      const r = await fetch(`/api/proposals/${proposal.id}/${kind}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const j = await r.json();
      if (!r.ok && !j.ok) throw new Error(j.error || 'Error');
      onChange();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error');
    } finally {
      setBusy(null);
    }
  }

  return (
    <article className="card p-5">
      <div className="flex items-start justify-between gap-4 mb-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className={`dot ${
              proposal.status === 'pending' ? 'dot-warning' :
              proposal.status === 'executed' ? 'dot-success' :
              proposal.status === 'failed' ? 'dot-danger' : 'dot-muted'
            }`} />
            <span className="text-[10px] uppercase tracking-[0.14em] font-bold text-[var(--fg-muted)]">
              {proposal.status}
            </span>
            {isPending && (
              <span className={`text-[10px] ${urgent ? 'text-[var(--danger)] font-bold' : 'text-[var(--fg-muted)]'}`}>
                · expira en {hrs}h
              </span>
            )}
          </div>
          <h3 className="text-base font-semibold text-[var(--fg)]">
            {ACTION_LABEL[proposal.action]} · {proposal.scope_name}
          </h3>
          <p className="text-[11px] text-[var(--fg-muted)] mt-0.5">
            propuesto por {proposal.proposed_by} · {new Date(proposal.created_at).toLocaleString('es')}
          </p>
        </div>
        <Link
          href={`/approvals/${proposal.id}`}
          className="text-[var(--fg-muted)] hover:text-[var(--fg)] flex items-center gap-1 text-xs"
        >
          Detalle <ChevronRight size={12} />
        </Link>
      </div>

      <div className="mb-4 py-3 px-4 bg-[var(--surface)] border border-[var(--hairline)] rounded">
        <DiffViewer proposal={proposal} />
      </div>

      {error && (
        <div className="text-[var(--danger)] text-xs mb-2">{error}</div>
      )}

      {isPending && (
        <div className="flex gap-2">
          <button
            onClick={() => act('approve')}
            disabled={busy !== null}
            className="btn-primary px-4 py-2 rounded text-sm flex items-center gap-2 disabled:opacity-50"
          >
            <Check size={14} />
            {busy === 'approve' ? 'Aprobando…' : 'Aprobar'}
          </button>
          <button
            onClick={() => act('reject')}
            disabled={busy !== null}
            className="btn-danger px-4 py-2 rounded text-sm flex items-center gap-2 disabled:opacity-50"
          >
            <X size={14} />
            Rechazar
          </button>
        </div>
      )}
    </article>
  );
}
