'use client';

import { useEffect, useState, useCallback } from 'react';
import { Sidebar } from '@/components/Sidebar';
import { TopBar } from '@/components/TopBar';
import { StatusBadge } from '@/components/StatusBadge';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { ToastStack } from '@/components/Toast';
import { useToasts } from '@/lib/use-toasts';
import { useAccount } from '@/lib/use-account';
import { fmt, fmtUSD } from '@/lib/utils';
import Link from 'next/link';
import { Play, Pause, Pencil, RefreshCw, Wallet, Plus } from 'lucide-react';

type Campaign = {
  id: string;
  name: string;
  status: string;
  effective_status: string;
  objective: string;
  daily_budget?: string;
  lifetime_budget?: string;
};

export default function CampaignsPage() {
  const { account, setAccount } = useAccount();
  const [rows, setRows] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toasts, push, dismiss } = useToasts();

  // Confirm dialog state
  const [confirm, setConfirm] = useState<null | { title: string; msg: string; action: () => Promise<void>; destructive?: boolean }>(null);

  // Rename modal state
  const [renameModal, setRenameModal] = useState<null | { id: string; current: string }>(null);
  const [budgetModal, setBudgetModal] = useState<null | { id: string; current: number; type: 'daily' | 'lifetime' }>(null);

  const load = useCallback(async () => {
    if (!account) return;
    setLoading(true);
    setError(null);
    try {
      const r = await fetch(`/api/campaigns?account_id=${account}`);
      const j = await r.json();
      if (j.error) throw new Error(j.error);
      setRows(j.data || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error');
    } finally {
      setLoading(false);
    }
  }, [account]);

  useEffect(() => { load(); }, [load]);

  async function toggleStatus(c: Campaign) {
    const next = c.status === 'ACTIVE' ? 'PAUSED' : 'ACTIVE';
    setConfirm({
      title: next === 'PAUSED' ? 'Pausar campaña' : 'Activar campaña',
      msg: `${next === 'PAUSED' ? 'Pausar' : 'Activar'} "${c.name}"?`,
      destructive: next === 'PAUSED',
      action: async () => {
        const r = await fetch('/api/mutation/status', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ object_id: c.id, status: next }),
        });
        const j = await r.json();
        if (j.error) throw new Error(j.error);
        push(`Campaña ${next === 'ACTIVE' ? 'activada' : 'pausada'}`, 'success');
        load();
      },
    });
  }

  async function doRename(name: string, appendSuffix: boolean) {
    if (!renameModal) return;
    try {
      const r = await fetch('/api/mutation/rename', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ object_id: renameModal.id, name, append_suffix: appendSuffix }),
      });
      const j = await r.json();
      if (j.error) throw new Error(j.error);
      push(`Renombrado: ${j.name}`, 'success');
      setRenameModal(null);
      load();
    } catch (e) {
      push(e instanceof Error ? e.message : 'Error', 'error');
    }
  }

  async function doBudget(amount: number) {
    if (!budgetModal) return;
    try {
      const r = await fetch('/api/mutation/budget', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ object_id: budgetModal.id, amount, type: budgetModal.type }),
      });
      const j = await r.json();
      if (j.error) throw new Error(j.error);
      push(`Presupuesto actualizado a ${fmtUSD(amount)}`, 'success');
      setBudgetModal(null);
      load();
    } catch (e) {
      push(e instanceof Error ? e.message : 'Error', 'error');
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
              <h1 className="text-2xl font-bold text-slate-900">Campañas</h1>
              <p className="text-sm text-slate-500">Gestión completa — activar, pausar, renombrar, ajustar presupuesto</p>
            </div>
            <div className="flex items-center gap-2">
              <Link
                href="/campaigns/new"
                className="flex items-center gap-2 bg-[var(--color-primary)] text-white px-3 py-1.5 rounded text-sm font-medium hover:bg-blue-800"
              >
                <Plus size={14} />
                Nueva campaña
              </Link>
              <button onClick={load} disabled={loading} className="flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900">
                <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                Recargar
              </button>
            </div>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded text-sm">{error}</div>
          )}

          <div className="bg-white border border-[var(--color-border)] rounded overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-[var(--color-muted)]">
                  <tr className="text-xs uppercase tracking-wider text-slate-600">
                    <th className="px-4 py-2 text-left">Campaña</th>
                    <th className="px-4 py-2 text-left">Estado</th>
                    <th className="px-4 py-2 text-left">Objetivo</th>
                    <th className="px-4 py-2 text-right">Daily</th>
                    <th className="px-4 py-2 text-right">Lifetime</th>
                    <th className="px-4 py-2 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.length === 0 && !loading && (
                    <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-400">Sin campañas</td></tr>
                  )}
                  {rows.map((c) => {
                    const daily = c.daily_budget ? Number(c.daily_budget) / 100 : null;
                    const lifetime = c.lifetime_budget ? Number(c.lifetime_budget) / 100 : null;
                    return (
                      <tr key={c.id} className="border-t border-slate-100 hover:bg-slate-50">
                        <td className="px-4 py-2">
                          <div className="font-medium text-slate-800">{c.name}</div>
                          <div className="text-[11px] text-slate-400 font-mono">{c.id}</div>
                        </td>
                        <td className="px-4 py-2">
                          <StatusBadge status={c.effective_status} />
                        </td>
                        <td className="px-4 py-2 text-xs text-slate-600 font-mono">{c.objective}</td>
                        <td className="px-4 py-2 text-right font-mono">{daily != null ? fmtUSD(daily) : '—'}</td>
                        <td className="px-4 py-2 text-right font-mono">{lifetime != null ? fmtUSD(lifetime) : '—'}</td>
                        <td className="px-4 py-2">
                          <div className="flex justify-end gap-1">
                            <button
                              onClick={() => toggleStatus(c)}
                              className="p-1.5 rounded hover:bg-slate-100 text-slate-600 transition-colors"
                              title={c.status === 'ACTIVE' ? 'Pausar' : 'Activar'}
                            >
                              {c.status === 'ACTIVE' ? <Pause size={14} /> : <Play size={14} />}
                            </button>
                            <button
                              onClick={() => setRenameModal({ id: c.id, current: c.name })}
                              className="p-1.5 rounded hover:bg-slate-100 text-slate-600 transition-colors"
                              title="Renombrar"
                            >
                              <Pencil size={14} />
                            </button>
                            <button
                              onClick={() => {
                                if (daily != null) setBudgetModal({ id: c.id, current: daily, type: 'daily' });
                                else if (lifetime != null) setBudgetModal({ id: c.id, current: lifetime, type: 'lifetime' });
                                else push('Esta campaña usa budget a nivel ad set', 'error');
                              }}
                              className="p-1.5 rounded hover:bg-slate-100 text-slate-600 transition-colors"
                              title="Editar budget"
                              disabled={daily == null && lifetime == null}
                            >
                              <Wallet size={14} />
                            </button>
                          </div>
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

      <ConfirmDialog
        open={!!confirm}
        title={confirm?.title || ''}
        message={confirm?.msg || ''}
        destructive={confirm?.destructive}
        onConfirm={async () => {
          try {
            await confirm!.action();
          } catch (e) {
            push(e instanceof Error ? e.message : 'Error', 'error');
          } finally {
            setConfirm(null);
          }
        }}
        onCancel={() => setConfirm(null)}
      />

      {renameModal && (
        <RenameModal
          current={renameModal.current}
          onCancel={() => setRenameModal(null)}
          onConfirm={doRename}
        />
      )}

      {budgetModal && (
        <BudgetModal
          current={budgetModal.current}
          type={budgetModal.type}
          onCancel={() => setBudgetModal(null)}
          onConfirm={doBudget}
        />
      )}

      <ToastStack toasts={toasts} onDismiss={dismiss} />
    </div>
  );
}

/* ---------- Modals ---------- */

function RenameModal({
  current,
  onCancel,
  onConfirm,
}: {
  current: string;
  onCancel: () => void;
  onConfirm: (name: string, appendSuffix: boolean) => void;
}) {
  const [name, setName] = useState(current);
  const [appendSuffix, setAppendSuffix] = useState(true);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onCancel}>
      <div
        className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6 border border-[var(--color-border)]"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-base font-semibold text-slate-900 mb-3">Renombrar</h3>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full px-3 py-2 border border-[var(--color-border)] rounded text-sm focus:outline-none focus:border-[var(--color-primary)]"
        />
        <label className="flex items-center gap-2 mt-3 text-sm text-slate-600">
          <input type="checkbox" checked={appendSuffix} onChange={(e) => setAppendSuffix(e.target.checked)} />
          Agregar sufijo <span className="font-mono">| Claude</span>
        </label>
        <div className="flex justify-end gap-2 mt-5">
          <button onClick={onCancel} className="px-3 py-1.5 rounded text-sm border border-[var(--color-border)] hover:bg-slate-50">Cancelar</button>
          <button onClick={() => onConfirm(name, appendSuffix)} className="px-3 py-1.5 rounded text-sm font-medium text-white bg-[var(--color-primary)] hover:bg-blue-800">Guardar</button>
        </div>
      </div>
    </div>
  );
}

function BudgetModal({
  current,
  type,
  onCancel,
  onConfirm,
}: {
  current: number;
  type: 'daily' | 'lifetime';
  onCancel: () => void;
  onConfirm: (amount: number) => void;
}) {
  const [amount, setAmount] = useState(current.toString());
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onCancel}>
      <div
        className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6 border border-[var(--color-border)]"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-base font-semibold text-slate-900 mb-1">Editar presupuesto</h3>
        <p className="text-xs text-slate-500 mb-3">Tipo: <span className="font-mono">{type}</span> · Actual: <span className="font-mono">{fmtUSD(current)}</span></p>
        <div className="relative">
          <span className="absolute left-3 top-2.5 text-slate-500 text-sm">$</span>
          <input
            type="number"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-full pl-7 pr-3 py-2 border border-[var(--color-border)] rounded text-sm focus:outline-none focus:border-[var(--color-primary)] font-mono"
          />
        </div>
        <div className="text-xs text-slate-500 mt-2">⚠ Cambio inmediato. Aplica solo si campaña no usa budget a nivel adset.</div>
        <div className="flex justify-end gap-2 mt-5">
          <button onClick={onCancel} className="px-3 py-1.5 rounded text-sm border border-[var(--color-border)] hover:bg-slate-50">Cancelar</button>
          <button onClick={() => onConfirm(Number(amount))} className="px-3 py-1.5 rounded text-sm font-medium text-white bg-[var(--color-primary)] hover:bg-blue-800">Guardar</button>
        </div>
      </div>
    </div>
  );
}
