'use client';

import { useEffect, useState, useCallback } from 'react';
import { Sidebar } from '@/components/Sidebar';
import { TopBar } from '@/components/TopBar';
import { ApprovalCard } from '@/components/ApprovalCard';
import { useAccount } from '@/lib/use-account';
import type { Proposal } from '@/lib/proposal-store';
import { RefreshCw } from 'lucide-react';

type Tab = 'pending' | 'history';

export default function ApprovalsPage() {
  const { account, setAccount } = useAccount();
  const [tab, setTab] = useState<Tab>('pending');
  const [items, setItems] = useState<Proposal[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (tab === 'pending') params.set('status', 'pending');
      const r = await fetch(`/api/proposals?${params}`);
      const j = await r.json();
      if (j.error) throw new Error(j.error);
      setItems(j.data || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error');
    } finally {
      setLoading(false);
    }
  }, [tab]);

  useEffect(() => { load(); }, [load]);

  const filtered = tab === 'history'
    ? items.filter((p) => p.status !== 'pending')
    : items;

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex-1 flex flex-col">
        <TopBar selected={account} onSelect={setAccount} />
        <main className="flex-1 px-8 py-8 max-w-[1200px] mx-auto w-full space-y-6">
          <div className="flex items-end justify-between flex-wrap gap-4 fade-in">
            <div>
              <p className="text-[11px] uppercase tracking-[0.16em] text-[var(--fg-muted)] mb-1">Cola de aprobación</p>
              <h1 className="display text-5xl text-[var(--fg)]">Aprobaciones</h1>
              <p className="text-sm text-[var(--fg-muted)] mt-2">
                Todas las mutaciones risky (presupuesto, activar, crear campaña) requieren tu OK.
              </p>
            </div>
            <button onClick={load} disabled={loading} className="btn-ghost px-3 py-2 rounded text-xs flex items-center gap-2">
              <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
              Recargar
            </button>
          </div>

          <div className="flex border-b border-[var(--hairline)]">
            {(['pending', 'history'] as Tab[]).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 ${
                  tab === t
                    ? 'border-[var(--accent)] text-[var(--fg)]'
                    : 'border-transparent text-[var(--fg-muted)] hover:text-[var(--fg)]'
                }`}
              >
                {t === 'pending' ? 'Pendientes' : 'Histórico'}
              </button>
            ))}
          </div>

          {error && (
            <div className="bg-[oklch(0.65_0.20_25_/_0.1)] border border-[var(--danger)] text-[var(--danger)] px-4 py-3 rounded text-sm">
              {error}
            </div>
          )}

          {filtered.length === 0 && !loading ? (
            <div className="card p-12 text-center">
              <p className="display text-2xl text-[var(--fg)]">
                {tab === 'pending' ? 'Nada pendiente' : 'Sin histórico'}
              </p>
              <p className="text-sm text-[var(--fg-muted)] mt-2">
                {tab === 'pending'
                  ? 'No hay cambios esperando aprobación.'
                  : 'Aún no se decidió ninguna propuesta.'}
              </p>
            </div>
          ) : (
            <div className="space-y-3 stagger">
              {filtered.map((p) => (
                <ApprovalCard key={p.id} proposal={p} onChange={load} />
              ))}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
