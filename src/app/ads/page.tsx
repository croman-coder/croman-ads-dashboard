'use client';

import { useEffect, useState, useCallback } from 'react';
import { Sidebar } from '@/components/Sidebar';
import { TopBar } from '@/components/TopBar';
import { StatusBadge } from '@/components/StatusBadge';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { ToastStack } from '@/components/Toast';
import { useToasts } from '@/lib/use-toasts';
import { useAccount } from '@/lib/use-account';
import { Play, Pause, Pencil, RefreshCw, Tag, Search, FileText } from 'lucide-react';

type Ad = {
  id: string;
  name: string;
  status: string;
  effective_status: string;
  campaign_id: string;
  adset_id: string;
};

const SUFFIX = ' | Claude';

export default function AdsPage() {
  const { account, setAccount } = useAccount();
  const [rows, setRows] = useState<Ad[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const { toasts, push, dismiss } = useToasts();
  const [confirm, setConfirm] = useState<null | { title: string; msg: string; action: () => Promise<void>; destructive?: boolean }>(null);
  const [renameModal, setRenameModal] = useState<null | { id: string; current: string }>(null);
  const [swapModal, setSwapModal] = useState<null | { ad: Ad }>(null);

  const load = useCallback(async () => {
    if (!account) return;
    setLoading(true);
    setError(null);
    try {
      const r = await fetch(`/api/ads?account_id=${account}`);
      const j = await r.json();
      if (j.error) throw new Error(j.error);
      setRows(j.data || []);
      setSelectedIds(new Set());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error');
    } finally {
      setLoading(false);
    }
  }, [account]);

  useEffect(() => { load(); }, [load]);

  const filtered = rows.filter((a) => {
    const f = filter.toLowerCase();
    if (!f) return true;
    return a.name.toLowerCase().includes(f) || a.id.includes(f);
  });

  function toggleStatusOne(ad: Ad) {
    const next = ad.status === 'ACTIVE' ? 'PAUSED' : 'ACTIVE';
    setConfirm({
      title: next === 'PAUSED' ? 'Pausar anuncio' : 'Activar anuncio',
      msg: `${next === 'PAUSED' ? 'Pausar' : 'Activar'} "${ad.name}"?`,
      destructive: next === 'PAUSED',
      action: async () => {
        const r = await fetch('/api/mutation/status', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ object_id: ad.id, status: next }),
        });
        const j = await r.json();
        if (j.error) throw new Error(j.error);
        push(`Ad ${next === 'ACTIVE' ? 'activado' : 'pausado'}`, 'success');
        load();
      },
    });
  }

  async function bulkLabelClaude() {
    if (selectedIds.size === 0) return;
    setConfirm({
      title: 'Aplicar label Claude',
      msg: `Agregar sufijo " | Claude" a ${selectedIds.size} anuncios seleccionados?`,
      action: async () => {
        let ok = 0;
        let err = 0;
        for (const id of selectedIds) {
          const ad = rows.find((r) => r.id === id);
          if (!ad) continue;
          if (ad.name.endsWith(SUFFIX)) continue;
          try {
            const r = await fetch('/api/mutation/rename', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ object_id: id, name: ad.name, append_suffix: true }),
            });
            const j = await r.json();
            if (j.error) throw new Error(j.error);
            ok++;
          } catch {
            err++;
          }
        }
        push(`Label aplicado: ${ok} ok, ${err} errores`, err ? 'error' : 'success');
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

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (selectedIds.size === filtered.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(filtered.map((a) => a.id)));
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex-1 flex flex-col">
        <TopBar selected={account} onSelect={setAccount} />
        <main className="flex-1 p-6 space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Anuncios</h1>
              <p className="text-sm text-slate-500">{filtered.length} de {rows.length} anuncios</p>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search size={14} className="absolute left-2 top-2.5 text-slate-400" />
                <input
                  type="text"
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                  placeholder="Buscar nombre o ID…"
                  className="pl-7 pr-3 py-1.5 text-sm border border-[var(--color-border)] rounded focus:outline-none focus:border-[var(--color-primary)] w-56"
                />
              </div>
              <button onClick={load} disabled={loading} className="flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900">
                <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
              </button>
            </div>
          </div>

          {selectedIds.size > 0 && (
            <div className="bg-blue-50 border border-blue-200 rounded px-4 py-2 flex items-center justify-between">
              <span className="text-sm text-blue-900 font-medium">{selectedIds.size} seleccionados</span>
              <div className="flex gap-2">
                <button onClick={bulkLabelClaude} className="flex items-center gap-1 text-xs bg-[var(--color-primary)] text-white px-3 py-1.5 rounded hover:bg-blue-800">
                  <Tag size={12} /> Aplicar | Claude
                </button>
                <button onClick={() => setSelectedIds(new Set())} className="text-xs text-slate-600 px-2">Limpiar</button>
              </div>
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded text-sm">{error}</div>
          )}

          <div className="bg-white border border-[var(--color-border)] rounded overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-[var(--color-muted)]">
                  <tr className="text-xs uppercase tracking-wider text-slate-600">
                    <th className="px-3 py-2 w-10">
                      <input
                        type="checkbox"
                        checked={filtered.length > 0 && selectedIds.size === filtered.length}
                        onChange={toggleSelectAll}
                      />
                    </th>
                    <th className="px-4 py-2 text-left">Anuncio</th>
                    <th className="px-4 py-2 text-left">Estado</th>
                    <th className="px-4 py-2 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 && !loading && (
                    <tr><td colSpan={4} className="px-4 py-8 text-center text-slate-400">Sin anuncios</td></tr>
                  )}
                  {filtered.map((a) => (
                    <tr key={a.id} className="border-t border-slate-100 hover:bg-slate-50">
                      <td className="px-3 py-2">
                        <input type="checkbox" checked={selectedIds.has(a.id)} onChange={() => toggleSelect(a.id)} />
                      </td>
                      <td className="px-4 py-2">
                        <div className="font-medium text-slate-800">{a.name}</div>
                        <div className="text-[11px] text-slate-400 font-mono">{a.id} · adset {a.adset_id}</div>
                      </td>
                      <td className="px-4 py-2">
                        <StatusBadge status={a.effective_status} />
                      </td>
                      <td className="px-4 py-2">
                        <div className="flex justify-end gap-1">
                          <button
                            onClick={() => toggleStatusOne(a)}
                            className="p-1.5 rounded hover:bg-slate-100 text-slate-600"
                            title={a.status === 'ACTIVE' ? 'Pausar' : 'Activar'}
                          >
                            {a.status === 'ACTIVE' ? <Pause size={14} /> : <Play size={14} />}
                          </button>
                          <button
                            onClick={() => setRenameModal({ id: a.id, current: a.name })}
                            className="p-1.5 rounded hover:bg-slate-100 text-slate-600"
                            title="Renombrar"
                          >
                            <Pencil size={14} />
                          </button>
                          <button
                            onClick={() => setSwapModal({ ad: a })}
                            className="p-1.5 rounded hover:bg-slate-100 text-slate-600"
                            title="Cambiar lead form"
                          >
                            <FileText size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
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

      {swapModal && (
        <SwapFormModal
          ad={swapModal.ad}
          accountId={account}
          onCancel={() => setSwapModal(null)}
          onDone={(msg, type) => { push(msg, type); setSwapModal(null); load(); }}
        />
      )}

      <ToastStack toasts={toasts} onDismiss={dismiss} />
    </div>
  );
}

function SwapFormModal({
  ad,
  accountId,
  onCancel,
  onDone,
}: {
  ad: Ad;
  accountId: string;
  onCancel: () => void;
  onDone: (msg: string, type: 'success' | 'error') => void;
}) {
  const [pages, setPages] = useState<Array<{ id: string; name: string }>>([]);
  const [pageId, setPageId] = useState('');
  const [forms, setForms] = useState<Array<{ id: string; name: string; leads_count?: number; status?: string }>>([]);
  const [selectedForm, setSelectedForm] = useState('');
  const [loadingPages, setLoadingPages] = useState(false);
  const [loadingForms, setLoadingForms] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!accountId) return;
    setLoadingPages(true);
    fetch(`/api/pages?account_id=${accountId}`)
      .then((r) => r.json())
      .then((j) => {
        if (!j.error) {
          setPages(j.data || []);
          if (j.data?.[0]) setPageId(j.data[0].id);
        }
      })
      .finally(() => setLoadingPages(false));
  }, [accountId]);

  useEffect(() => {
    if (!pageId) return;
    setLoadingForms(true);
    setForms([]);
    fetch(`/api/leadgen-forms?page_id=${pageId}`)
      .then((r) => r.json())
      .then((j) => {
        if (j.error) onDone(j.error, 'error');
        else setForms((j.data || []).sort((a: { created_time?: string }, b: { created_time?: string }) => (b.created_time || '').localeCompare(a.created_time || '')));
      })
      .finally(() => setLoadingForms(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageId]);

  async function swap() {
    if (!selectedForm) return;
    setSaving(true);
    try {
      const r = await fetch('/api/mutation/swap-form', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ad_id: ad.id, new_form_id: selectedForm, account_id: accountId }),
      });
      const j = await r.json();
      if (j.error) throw new Error(j.error);
      onDone(`Form swap OK · nuevo creative ${j.new_creative_id}`, 'success');
    } catch (e) {
      onDone(e instanceof Error ? e.message : 'Error', 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onCancel}>
      <div
        className="bg-white rounded-lg shadow-xl max-w-lg w-full mx-4 p-6 border border-[var(--color-border)] max-h-[80vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-base font-semibold text-slate-900 mb-1">Cambiar Lead Form</h3>
        <p className="text-xs text-slate-500 mb-4">Ad: {ad.name}</p>

        <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">Página</label>
        <select
          value={pageId}
          onChange={(e) => setPageId(e.target.value)}
          disabled={loadingPages}
          className="w-full mt-1 px-3 py-2 border border-[var(--color-border)] rounded text-sm bg-white"
        >
          {pages.map((p) => (
            <option key={p.id} value={p.id}>{p.name} ({p.id})</option>
          ))}
        </select>

        <label className="text-xs font-semibold uppercase tracking-wider text-slate-500 mt-4 block">Lead Form ({forms.length})</label>
        <div className="border border-[var(--color-border)] rounded mt-1 max-h-72 overflow-y-auto">
          {loadingForms && <div className="p-3 text-sm text-slate-500">Cargando forms…</div>}
          {!loadingForms && forms.length === 0 && (
            <div className="p-3 text-sm text-slate-400">Sin forms</div>
          )}
          {forms.map((f) => (
            <button
              key={f.id}
              onClick={() => setSelectedForm(f.id)}
              className={`w-full text-left px-3 py-2 border-b border-slate-100 text-sm hover:bg-slate-50 ${
                selectedForm === f.id ? 'bg-blue-50 border-l-2 border-l-[var(--color-primary)]' : ''
              }`}
            >
              <div className="font-medium text-slate-800">{f.name}</div>
              <div className="text-[11px] text-slate-400 font-mono">{f.id} · {f.leads_count || 0} leads · {f.status}</div>
            </button>
          ))}
        </div>

        <div className="flex justify-end gap-2 mt-5">
          <button onClick={onCancel} disabled={saving} className="px-3 py-1.5 rounded text-sm border border-[var(--color-border)] hover:bg-slate-50">Cancelar</button>
          <button
            onClick={swap}
            disabled={!selectedForm || saving}
            className="px-3 py-1.5 rounded text-sm font-medium text-white bg-[var(--color-primary)] hover:bg-blue-800 disabled:opacity-50"
          >
            {saving ? 'Aplicando…' : 'Aplicar swap'}
          </button>
        </div>
      </div>
    </div>
  );
}

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
        <h3 className="text-base font-semibold text-slate-900 mb-3">Renombrar anuncio</h3>
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
