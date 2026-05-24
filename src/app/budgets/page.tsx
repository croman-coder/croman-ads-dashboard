'use client';

import { useEffect, useState, useCallback } from 'react';
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

  async function save(item: Item) {
    const value = drafts[item.id];
    if (!value) return;
    const amount = Number(value);
    if (!Number.isFinite(amount) || amount <= 0) {
      push('Monto inválido', 'error');
      return;
    }
    const type: 'daily' | 'lifetime' = item.daily_budget ? 'daily' : 'lifetime';
    setSaving(item.id);
    try {
      const r = await fetch('/api/mutation/budget', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ object_id: item.id, amount, type }),
      });
      const j = await r.json();
      if (j.error) throw new Error(j.error);
      push(`Presupuesto ${item.name}: ${fmtUSD(amount)}`, 'success');
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
        <main className="flex-1 p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Presupuestos</h1>
              <p className="text-sm text-slate-500">Edición de budget daily/lifetime — campañas y ad sets</p>
            </div>
            <button onClick={load} disabled={loading} className="flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900">
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
              Recargar
            </button>
          </div>

          {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded text-sm">{error}</div>}

          <div className="bg-amber-50 border border-amber-200 rounded px-4 py-3 text-sm text-amber-900">
            <strong>⚠ Atención:</strong> los cambios de presupuesto son inmediatos y afectan gasto real. Revisá monto antes de guardar.
          </div>

          <div className="bg-white border border-[var(--color-border)] rounded overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-[var(--color-muted)]">
                  <tr className="text-xs uppercase tracking-wider text-slate-600">
                    <th className="px-4 py-2 text-left">Nivel</th>
                    <th className="px-4 py-2 text-left">Nombre</th>
                    <th className="px-4 py-2 text-left">Estado</th>
                    <th className="px-4 py-2 text-left">Tipo</th>
                    <th className="px-4 py-2 text-right">Actual</th>
                    <th className="px-4 py-2 text-right">Nuevo</th>
                    <th className="px-4 py-2 text-right">Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {items.length === 0 && !loading && (
                    <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-400">Sin elementos con presupuesto</td></tr>
                  )}
                  {items.map((it) => {
                    const daily = it.daily_budget ? Number(it.daily_budget) / 100 : null;
                    const lifetime = it.lifetime_budget ? Number(it.lifetime_budget) / 100 : null;
                    const current = daily ?? lifetime ?? 0;
                    const type = daily ? 'daily' : 'lifetime';
                    return (
                      <tr key={it.id} className="border-t border-slate-100 hover:bg-slate-50">
                        <td className="px-4 py-2">
                          <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                            {it.level}
                          </span>
                        </td>
                        <td className="px-4 py-2">
                          <div className="font-medium text-slate-800">{it.name}</div>
                          <div className="text-[11px] text-slate-400 font-mono">{it.id}</div>
                        </td>
                        <td className="px-4 py-2"><StatusBadge status={it.effective_status} /></td>
                        <td className="px-4 py-2 text-xs font-mono">{type}</td>
                        <td className="px-4 py-2 text-right font-mono text-slate-700">{fmtUSD(current)}</td>
                        <td className="px-4 py-2 text-right">
                          <div className="relative inline-block">
                            <span className="absolute left-2 top-1.5 text-slate-400 text-xs">$</span>
                            <input
                              type="number"
                              step="0.01"
                              value={drafts[it.id] ?? ''}
                              placeholder={current.toString()}
                              onChange={(e) => setDrafts((d) => ({ ...d, [it.id]: e.target.value }))}
                              className="w-28 pl-6 pr-2 py-1 border border-[var(--color-border)] rounded text-sm font-mono text-right focus:outline-none focus:border-[var(--color-primary)]"
                            />
                          </div>
                        </td>
                        <td className="px-4 py-2 text-right">
                          <button
                            onClick={() => save(it)}
                            disabled={!drafts[it.id] || saving === it.id}
                            className="flex items-center gap-1 ml-auto bg-[var(--color-primary)] text-white px-3 py-1 rounded text-xs hover:bg-blue-800 disabled:opacity-40 disabled:cursor-not-allowed"
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
