'use client';

import { useEffect, useMemo, useState, useCallback } from 'react';
import { Sidebar } from '@/components/Sidebar';
import { TopBar } from '@/components/TopBar';
import { StatusBadge } from '@/components/StatusBadge';
import { ToastStack } from '@/components/Toast';
import { useToasts } from '@/lib/use-toasts';
import { useAccount } from '@/lib/use-account';
import { fmtUSD } from '@/lib/utils';
import { RefreshCw, Save, Wallet } from 'lucide-react';

type Item = {
  id: string;
  name: string;
  effective_status: string;
  daily_budget?: string;
  lifetime_budget?: string;
  level: 'campaign' | 'adset';
};

export default function BudgetsPage() {
  const { account, setAccount } = useAccount();
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [onlyDelivering, setOnlyDelivering] = useState(true);
  const { toasts, push, dismiss } = useToasts();

  const load = useCallback(async () => {
    if (!account) return;
    setLoading(true);
    setError(null);
    try {
      const [campsR, adsetsR] = await Promise.all([
        fetch(`/api/campaigns?account_id=${account}`).then((r) => r.json()),
        fetch(`/api/adsets?account_id=${account}`).then((r) => r.json()),
      ]);
      if (campsR.error) throw new Error(campsR.error);
      if (adsetsR.error) throw new Error(adsetsR.error);
      const camps = (campsR.data || []).map((c: Item) => ({ ...c, level: 'campaign' as const }));
      const adsets = (adsetsR.data || []).map((a: Item) => ({ ...a, level: 'adset' as const }));
      // only items with budget
      const all = [...camps, ...adsets].filter((x) => x.daily_budget || x.lifetime_budget);
      setItems(all);
      setDrafts({});
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error');
    } finally {
      setLoading(false);
    }
  }, [account]);

  useEffect(() => { load(); }, [load]);

  // "Entregando" = effective_status ACTIVE only. Old paused/expired campaigns
  // (e.g. Leads Mirage 2024) hidden by default — they are NOT delivering.
  const visible = useMemo(
    () => (onlyDelivering ? items.filter((x) => x.effective_status === 'ACTIVE') : items),
    [items, onlyDelivering]
  );
  const deliveringCount = useMemo(
    () => items.filter((x) => x.effective_status === 'ACTIVE').length,
    [items]
  );

  const BUDGET_CAP = 1000;

  async function save(item: Item) {
    const value = drafts[item.id];
    if (!value) return;
    const amount = Number(value);
    if (!Number.isFinite(amount) || amount <= 0) {
      push('Monto inválido', 'error');
      return;
    }
    if (amount > BUDGET_CAP) {
      push(`Excede tope USD ${BUDGET_CAP}`, 'error');
      return;
    }
    const type: 'daily' | 'lifetime' = item.daily_budget ? 'daily' : 'lifetime';
    setSaving(item.id);
    try {
      const r = await fetch('/api/mutation/budget', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          object_id: item.id,
          amount,
          type,
          account_id: account,
          scope_name: item.name,
        }),
      });
      const j = await r.json();
      if (!r.ok && r.status !== 202) throw new Error(j.error || 'Error');
      if (j.status === 'pending') {
        push(`Encolado para aprobación · ${item.name}`, 'success');
      } else {
        push(`Presupuesto ${item.name}: ${fmtUSD(amount)}`, 'success');
      }
      setDrafts((d) => { const n = { ...d }; delete n[item.id]; return n; });
      load();
    } catch (e) {
      push(e instanceof Error ? e.message : 'Error', 'error');
    } finally {
      setSaving(null);
    }
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex-1 flex flex-col">
        <TopBar selected={account} onSelect={setAccount} />
        <main className="flex-1 px-8 py-8 max-w-[1500px] mx-auto w-full space-y-5">
          <div className="flex items-end justify-between flex-wrap gap-4 fade-in">
            <div>
              <p className="eyebrow mb-1 flex items-center gap-1.5"><Wallet size={12} className="text-[var(--accent)]" /> Presupuestos</p>
              <h1 className="display text-5xl">Budgets.</h1>
              <p className="text-sm text-[var(--fg-muted)] mt-2">
                <span className="text-[var(--success)]">{deliveringCount} entregando</span> · {items.length} con presupuesto
              </p>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-px bg-[var(--surface)] border border-[var(--border)] rounded-md p-0.5">
                <button
                  onClick={() => setOnlyDelivering(true)}
                  className={`px-3 py-1.5 text-[11px] uppercase tracking-[0.1em] font-semibold rounded transition-colors ${onlyDelivering ? 'bg-[var(--bg-elevated-2)] text-[var(--fg)]' : 'text-[var(--fg-muted)] hover:text-[var(--fg-soft)]'}`}
                >Entregando</button>
                <button
                  onClick={() => setOnlyDelivering(false)}
                  className={`px-3 py-1.5 text-[11px] uppercase tracking-[0.1em] font-semibold rounded transition-colors ${!onlyDelivering ? 'bg-[var(--bg-elevated-2)] text-[var(--fg)]' : 'text-[var(--fg-muted)] hover:text-[var(--fg-soft)]'}`}
                >Todos</button>
              </div>
              <button onClick={load} disabled={loading} className="btn-ghost px-3 py-1.5 flex items-center gap-1.5">
                <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
              </button>
            </div>
          </div>

          {error && <div className="card border-[var(--danger)]/30 bg-[var(--danger)]/10 text-[var(--danger)] px-4 py-3 text-sm">{error}</div>}

          <div className="card border-[var(--warning)]/40 bg-[oklch(0.80_0.16_75_/_0.08)] px-4 py-3 text-sm text-[var(--fg)]">
            <strong className="text-[var(--warning)]">Atención:</strong> cambios de presupuesto son inmediatos y afectan gasto real. <strong>Tope máximo USD {BUDGET_CAP}</strong>. Revisar monto antes de guardar.
          </div>

          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-[10px] uppercase tracking-[0.14em] text-[var(--fg-muted)] font-semibold border-b border-[var(--hairline)]">
                    <th className="px-5 py-3 text-left">Nivel</th>
                    <th className="px-4 py-3 text-left">Nombre</th>
                    <th className="px-4 py-3 text-left">Estado</th>
                    <th className="px-4 py-3 text-left">Tipo</th>
                    <th className="px-4 py-3 text-right">Actual</th>
                    <th className="px-4 py-3 text-right">Nuevo</th>
                    <th className="px-5 py-3 text-right">Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.length === 0 && !loading && (
                    <tr><td colSpan={7} className="px-4 py-12 text-center text-[var(--fg-muted)]">{onlyDelivering ? 'Ninguna campaña/ad set entregando con presupuesto' : 'Sin elementos con presupuesto'}</td></tr>
                  )}
                  {visible.map((it) => {
                    const daily = it.daily_budget ? Number(it.daily_budget) / 100 : null;
                    const lifetime = it.lifetime_budget ? Number(it.lifetime_budget) / 100 : null;
                    const current = daily ?? lifetime ?? 0;
                    const type = daily ? 'daily' : 'lifetime';
                    return (
                      <tr key={it.id} className="border-t border-[var(--hairline)] hover:bg-[var(--surface)]">
                        <td className="px-4 py-2">
                          <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-[var(--surface-2)] text-[var(--fg-soft)]">
                            {it.level}
                          </span>
                        </td>
                        <td className="px-4 py-2">
                          <div className="font-medium text-[var(--fg)]">{it.name}</div>
                          <div className="text-[11px] text-[var(--fg-faint)] font-mono">{it.id}</div>
                        </td>
                        <td className="px-4 py-2"><StatusBadge status={it.effective_status} /></td>
                        <td className="px-4 py-2 text-xs font-mono">{type}</td>
                        <td className="px-4 py-2 text-right font-mono text-[var(--fg-soft)]">{fmtUSD(current)}</td>
                        <td className="px-4 py-2 text-right">
                          <div className="relative inline-block">
                            <span className="absolute left-2 top-1.5 text-[var(--fg-faint)] text-xs">$</span>
                            <input
                              type="number"
                              step="0.01"
                              min={0}
                              max={BUDGET_CAP}
                              value={drafts[it.id] ?? ''}
                              placeholder={current.toString()}
                              onChange={(e) => setDrafts((d) => ({ ...d, [it.id]: e.target.value }))}
                              className={`w-28 pl-6 pr-2 py-1 border rounded text-sm font-mono text-right focus:outline-none focus:border-[var(--accent)] ${
                                Number(drafts[it.id]) > BUDGET_CAP
                                  ? 'border-[var(--danger)] bg-[oklch(0.65_0.20_25_/_0.1)]'
                                  : 'border-[var(--hairline)] bg-[var(--surface)] text-[var(--fg)]'
                              }`}
                            />
                          </div>
                        </td>
                        <td className="px-4 py-2 text-right">
                          <button
                            onClick={() => save(it)}
                            disabled={!drafts[it.id] || saving === it.id}
                            className="flex items-center gap-1 ml-auto bg-[var(--accent)] text-white px-3 py-1 rounded text-xs hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            {saving === it.id ? <RefreshCw size={12} className="animate-spin" /> : <Save size={12} />}
                            Guardar
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </main>
      </div>
      <ToastStack toasts={toasts} onDismiss={dismiss} />
    </div>
  );
}
