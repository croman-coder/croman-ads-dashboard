'use client';

import { useEffect, useMemo, useState, useCallback } from 'react';
import { Sidebar } from '@/components/Sidebar';
import { TopBar } from '@/components/TopBar';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { ToastStack } from '@/components/Toast';
import { useToasts } from '@/lib/use-toasts';
import { useAccount } from '@/lib/use-account';
import { fmtUSD } from '@/lib/utils';
import Link from 'next/link';
import { Play, Pause, Pencil, RefreshCw, Wallet, Plus, MoreVertical, Megaphone, LayoutGrid, Rows, ImageOff, Video } from 'lucide-react';

type Campaign = {
  id: string;
  name: string;
  status: string;
  effective_status: string;
  objective: string;
  daily_budget?: string;
  lifetime_budget?: string;
  start_time?: string;
  created_time?: string;
  delivering?: boolean;        // status ACTIVE + recent spend/impressions
  recent_spend?: number;
  recent_impressions?: number;
};

type Ad = {
  id: string;
  name: string;
  campaign_id: string;
  effective_status: string;
  creative?: { thumbnail_url?: string; image_url?: string; video_id?: string };
};

type StatusFilter = 'ALL' | 'ACTIVE' | 'PAUSED';

function fmtDate(s?: string): string {
  if (!s) return '—';
  return new Date(s).toLocaleDateString('es-PY', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function adThumb(a: Ad): string | null {
  const c = a.creative;
  return c?.thumbnail_url || c?.image_url || null;
}

export default function CampaignsPage() {
  const { account, setAccount } = useAccount();
  const [rows, setRows] = useState<Campaign[]>([]);
  const [ads, setAds] = useState<Ad[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<'grid' | 'list'>('grid');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
  const [search, setSearch] = useState('');
  const { toasts, push, dismiss } = useToasts();

  const [confirm, setConfirm] = useState<null | { title: string; msg: string; action: () => Promise<void>; destructive?: boolean }>(null);
  const [renameModal, setRenameModal] = useState<null | { id: string; current: string }>(null);
  const [budgetModal, setBudgetModal] = useState<null | { id: string; current: number; type: 'daily' | 'lifetime' }>(null);

  const load = useCallback(async () => {
    if (!account) return;
    setLoading(true);
    setError(null);
    try {
      const [c, a] = await Promise.all([
        fetch(`/api/campaigns?account_id=${account}`).then((r) => r.json()),
        fetch(`/api/ads?account_id=${account}`).then((r) => r.json()),
      ]);
      if (c.error) throw new Error(c.error);
      setRows(c.data || []);
      setAds(a.error ? [] : (a.data || []));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error');
    } finally {
      setLoading(false);
    }
  }, [account]);

  const adsByCampaign = useMemo(() => {
    const map = new Map<string, Ad[]>();
    for (const a of ads) {
      const list = map.get(a.campaign_id) || [];
      list.push(a);
      map.set(a.campaign_id, list);
    }
    return map;
  }, [ads]);

  // "Entregando" = backend `delivering` flag (status ACTIVE + recent spend/impr).
  // Completed campaigns (budget/end-date) report ACTIVE but don't deliver → excluded.
  const filtered = useMemo(() => {
    const s = search.toLowerCase();
    return rows.filter((c) => {
      if (statusFilter === 'ACTIVE' && !c.delivering) return false;
      if (statusFilter === 'PAUSED' && c.delivering) return false;
      if (!s) return true;
      return c.name.toLowerCase().includes(s) || c.id.includes(s);
    });
  }, [rows, statusFilter, search]);

  const counts = useMemo(
    () => ({
      total: rows.length,
      active: rows.filter((r) => r.delivering).length,
      paused: rows.filter((r) => !r.delivering).length,
    }),
    [rows]
  );

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
          body: JSON.stringify({
            object_id: c.id,
            status: next,
            account_id: account,
            scope_name: c.name,
            scope: 'campaign',
          }),
        });
        const j = await r.json();
        if (!r.ok && r.status !== 202) throw new Error(j.error || 'Error');
        if (j.status === 'pending') {
          push(`Activación encolada · ${c.name}`, 'success');
        } else {
          push(`Campaña ${next === 'ACTIVE' ? 'activada' : 'pausada'}`, 'success');
        }
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
        <main className="flex-1 px-8 py-8 max-w-[1600px] mx-auto w-full space-y-6">
          {/* Header */}
          <header className="flex items-end justify-between flex-wrap gap-4 fade-in">
            <div>
              <p className="eyebrow mb-1">Mis estrategias</p>
              <h1 className="display text-5xl">Campañas</h1>
              <p className="text-sm text-[var(--fg-muted)] mt-2">
                <span className="text-[var(--success)] font-medium">{counts.active}</span> entregando · <span className="text-[var(--fg-soft)] font-medium">{counts.paused}</span> en pausa · {counts.total} totales
              </p>
            </div>
            <Link href="/creative/new" className="btn-gradient px-5 py-2.5 flex items-center gap-2">
              <Plus size={14} />
              Nueva estrategia
            </Link>
          </header>

          {/* Tab filter + search + view toggle */}
          <div className="flex items-center justify-between flex-wrap gap-3 border-b border-[var(--hairline)]">
            <div className="flex items-center gap-1">
              {(['ALL', 'ACTIVE', 'PAUSED'] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  className={`px-4 py-2.5 text-[12px] uppercase tracking-[0.12em] font-semibold border-b-2 transition-colors -mb-px ${
                    statusFilter === s
                      ? 'border-[var(--accent)] text-[var(--fg)]'
                      : 'border-transparent text-[var(--fg-muted)] hover:text-[var(--fg-soft)]'
                  }`}
                >
                  {s === 'ALL' ? 'Todas' : s === 'ACTIVE' ? 'Entregando' : 'En pausa'}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2 pb-2">
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar nombre o ID…"
                className="bg-[var(--bg-elevated)] border border-[var(--border)] rounded-md px-3 py-1.5 text-sm text-[var(--fg)] placeholder:text-[var(--fg-faint)] focus:outline-none focus:border-[var(--accent)] w-56 shadow-sm"
              />
              <div className="flex items-center gap-px bg-[var(--bg-elevated)] border border-[var(--border)] rounded-md p-0.5 shadow-sm">
                <button onClick={() => setView('grid')} className={`p-1.5 rounded transition-colors ${view === 'grid' ? 'bg-[var(--surface-2)] text-[var(--fg)]' : 'text-[var(--fg-muted)] hover:text-[var(--fg-soft)]'}`}>
                  <LayoutGrid size={14} />
                </button>
                <button onClick={() => setView('list')} className={`p-1.5 rounded transition-colors ${view === 'list' ? 'bg-[var(--surface-2)] text-[var(--fg)]' : 'text-[var(--fg-muted)] hover:text-[var(--fg-soft)]'}`}>
                  <Rows size={14} />
                </button>
              </div>
              <button onClick={load} disabled={loading} className="btn-ghost px-3 py-1.5 flex items-center gap-1.5">
                <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
              </button>
            </div>
          </div>

          {error && (
            <div className="card border-[var(--danger)]/30 bg-[var(--danger)]/10 text-[var(--danger)] px-4 py-3 text-sm">{error}</div>
          )}

          {/* Loading skeleton */}
          {loading && rows.length === 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 stagger">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="card p-6 space-y-4 animate-pulse">
                  <div className="h-4 bg-[var(--surface-2)] rounded w-2/3" />
                  <div className="h-24 bg-[var(--surface-2)] rounded" />
                  <div className="h-3 bg-[var(--surface-2)] rounded w-1/3" />
                </div>
              ))}
            </div>
          )}

          {/* Empty state */}
          {!loading && filtered.length === 0 && (
            <div className="card py-20 text-center">
              <Megaphone size={36} className="mx-auto text-[var(--fg-faint)] mb-3" />
              <h3 className="display text-2xl text-[var(--fg-soft)] mb-1">Sin campañas</h3>
              <p className="text-sm text-[var(--fg-muted)]">{search || statusFilter !== 'ALL' ? 'Limpia filtros para ver todas.' : 'Creá la primera campaña con IA.'}</p>
            </div>
          )}

          {/* GRID view (default) */}
          {!loading && view === 'grid' && filtered.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 stagger">
              {filtered.map((c) => {
                const daily = c.daily_budget ? Number(c.daily_budget) / 100 : null;
                const lifetime = c.lifetime_budget ? Number(c.lifetime_budget) / 100 : null;
                const isActive = !!c.delivering;
                const campAds = adsByCampaign.get(c.id) || [];
                const previews = campAds.slice(0, 4);
                const extra = Math.max(0, campAds.length - 4);

                return (
                  <article key={c.id} className="card lift overflow-hidden flex flex-col">
                    {/* Top: status + menu */}
                    <div className="flex items-center justify-between px-5 pt-5">
                      <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 text-[10px] uppercase tracking-[0.12em] font-bold border rounded ${
                        isActive
                          ? 'border-[oklch(0.58_0.20_152_/_0.45)] bg-[oklch(0.58_0.20_152_/_0.10)] text-[var(--success)]'
                          : 'border-[var(--border)] bg-[var(--surface)] text-[var(--fg-muted)]'
                      }`}>
                        <span className={`dot dot-${isActive ? 'success' : 'muted'}`} />
                        {isActive ? 'Entregando' : c.effective_status}
                      </span>
                      <span className="text-[10px] eyebrow font-[family-name:var(--font-mono)]">{c.objective || '—'}</span>
                    </div>

                    {/* Title */}
                    <Link href={`/campaigns/${c.id}`} className="px-5 pt-3 pb-4 block hover:text-[var(--accent)] transition-colors">
                      <h3 className="display text-2xl text-[var(--fg)] line-clamp-2 leading-tight">{c.name}</h3>
                    </Link>

                    {/* Thumbnails strip */}
                    <div className="px-5">
                      {previews.length === 0 ? (
                        <div className="h-[68px] flex items-center justify-center text-[11px] text-[var(--fg-faint)] eyebrow bg-[var(--bg-elevated-2)] rounded">
                          Sin piezas
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          {previews.map((a) => {
                            const url = adThumb(a);
                            const video = !!a.creative?.video_id;
                            return (
                              <div key={a.id} className="relative w-[60px] h-[60px] rounded overflow-hidden bg-[var(--bg-elevated-2)] border border-[var(--hairline)] shrink-0">
                                {url ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img src={url} alt="" className="w-full h-full object-cover" loading="lazy" />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center text-[var(--fg-faint)]">
                                    <ImageOff size={14} />
                                  </div>
                                )}
                                {video && (
                                  <span className="absolute bottom-0 right-0 bg-black/70 text-white p-0.5 rounded-tl">
                                    <Video size={8} />
                                  </span>
                                )}
                              </div>
                            );
                          })}
                          {extra > 0 && (
                            <div className="w-[60px] h-[60px] rounded border border-[var(--hairline)] bg-[var(--surface-2)] flex items-center justify-center text-[13px] font-semibold text-[var(--fg-soft)]">
                              +{extra}
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Details */}
                    <div className="px-5 pt-5 pb-4 flex-1">
                      <div className="eyebrow mb-2">Detalles</div>
                      <dl className="space-y-1.5 text-[13px]">
                        <DetailRow label="Piezas" value={`${campAds.length} ${campAds.length === 1 ? 'anuncio' : 'anuncios'}`} />
                        <DetailRow label="Presupuesto diario" value={daily != null ? fmtUSD(daily) : lifetime != null ? `${fmtUSD(lifetime)} total` : '—'} />
                        <DetailRow label="Fecha inicio" value={fmtDate(c.start_time || c.created_time)} />
                      </dl>
                    </div>

                    {/* Actions */}
                    <div className="px-4 pb-4 flex items-center gap-2">
                      <button
                        onClick={() => toggleStatus(c)}
                        className={`flex-1 flex items-center justify-center gap-2 py-2 rounded text-sm font-medium transition-all ${
                          isActive
                            ? 'border border-[var(--border)] text-[var(--fg-soft)] hover:bg-[var(--surface)] hover:text-[var(--fg)]'
                            : 'btn-primary'
                        }`}
                      >
                        {isActive ? <><Pause size={13} /> Pausar estrategia</> : <><Play size={13} /> Activar estrategia</>}
                      </button>
                      <CampaignMenu
                        c={c}
                        onRename={() => setRenameModal({ id: c.id, current: c.name })}
                        onBudget={() => {
                          if (daily != null) setBudgetModal({ id: c.id, current: daily, type: 'daily' });
                          else if (lifetime != null) setBudgetModal({ id: c.id, current: lifetime, type: 'lifetime' });
                          else push('Esta campaña usa budget a nivel ad set', 'error');
                        }}
                      />
                    </div>
                  </article>
                );
              })}
            </div>
          )}

          {/* LIST view (legacy table) */}
          {!loading && view === 'list' && filtered.length > 0 && (
            <div className="card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-[10px] uppercase tracking-[0.14em] text-[var(--fg-muted)] font-semibold border-b border-[var(--hairline)]">
                      <th className="px-4 py-3 text-left">Campaña</th>
                      <th className="px-4 py-3 text-left">Estado</th>
                      <th className="px-4 py-3 text-left">Objetivo</th>
                      <th className="px-4 py-3 text-right">Daily</th>
                      <th className="px-4 py-3 text-right">Lifetime</th>
                      <th className="px-4 py-3 text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((c) => {
                      const daily = c.daily_budget ? Number(c.daily_budget) / 100 : null;
                      const lifetime = c.lifetime_budget ? Number(c.lifetime_budget) / 100 : null;
                      const isActive = !!c.delivering;
                      return (
                        <tr key={c.id} className="border-t border-[var(--hairline)] hover:bg-[var(--surface)] cursor-pointer" onClick={(e) => {
                          if ((e.target as HTMLElement).closest('button')) return;
                          window.location.href = `/campaigns/${c.id}`;
                        }}>
                          <td className="px-4 py-3">
                            <Link href={`/campaigns/${c.id}`} className="font-medium text-[var(--fg)] hover:text-[var(--accent)] transition-colors">{c.name}</Link>
                            <div className="text-[10px] text-[var(--fg-faint)] font-[family-name:var(--font-mono)]">{c.id}</div>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 text-[10px] uppercase tracking-[0.1em] font-semibold ${isActive ? 'text-[var(--success)]' : 'text-[var(--fg-muted)]'}`}>
                              <span className={`dot dot-${isActive ? 'success' : 'muted'}`} />
                              {c.effective_status}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-[11px] text-[var(--fg-soft)] font-[family-name:var(--font-mono)]">{c.objective}</td>
                          <td className="px-4 py-3 text-right font-[family-name:var(--font-mono)]">{daily != null ? fmtUSD(daily) : '—'}</td>
                          <td className="px-4 py-3 text-right font-[family-name:var(--font-mono)]">{lifetime != null ? fmtUSD(lifetime) : '—'}</td>
                          <td className="px-4 py-3">
                            <div className="flex justify-end gap-1">
                              <button onClick={() => toggleStatus(c)} className="p-1.5 rounded hover:bg-[var(--surface-2)] text-[var(--fg-soft)] transition-colors" title={isActive ? 'Pausar' : 'Activar'}>
                                {c.status === 'ACTIVE' ? <Pause size={14} /> : <Play size={14} />}
                              </button>
                              <button onClick={() => setRenameModal({ id: c.id, current: c.name })} className="p-1.5 rounded hover:bg-[var(--surface-2)] text-[var(--fg-soft)] transition-colors" title="Renombrar">
                                <Pencil size={14} />
                              </button>
                              <button onClick={() => {
                                if (daily != null) setBudgetModal({ id: c.id, current: daily, type: 'daily' });
                                else if (lifetime != null) setBudgetModal({ id: c.id, current: lifetime, type: 'lifetime' });
                                else push('Esta campaña usa budget a nivel ad set', 'error');
                              }} className="p-1.5 rounded hover:bg-[var(--surface-2)] text-[var(--fg-soft)] transition-colors" title="Editar budget" disabled={daily == null && lifetime == null}>
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
          )}
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

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-[var(--fg-muted)]">{label}</span>
      <span className="text-[var(--fg)] font-medium font-[family-name:var(--font-mono)] truncate" title={value}>{value}</span>
    </div>
  );
}

function CampaignMenu({ c, onRename, onBudget }: { c: Campaign; onRename: () => void; onBudget: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        className="p-2 rounded border border-[var(--border)] hover:bg-[var(--surface)] text-[var(--fg-soft)] hover:text-[var(--fg)] transition-colors"
        aria-label="Más opciones"
        title={`Acciones · ${c.name}`}
      >
        <MoreVertical size={14} />
      </button>
      {open && (
        <div className="absolute right-0 bottom-full mb-1 w-48 card shadow-xl z-30 overflow-hidden fade-in py-1">
          <button onClick={onRename} className="w-full px-3 py-2 flex items-center gap-2 text-sm text-[var(--fg-soft)] hover:bg-[var(--surface)] hover:text-[var(--fg)] transition-colors">
            <Pencil size={12} /> Renombrar
          </button>
          <button onClick={onBudget} className="w-full px-3 py-2 flex items-center gap-2 text-sm text-[var(--fg-soft)] hover:bg-[var(--surface)] hover:text-[var(--fg)] transition-colors">
            <Wallet size={12} /> Editar presupuesto
          </button>
          <Link href={`/campaigns/${c.id}`} className="w-full px-3 py-2 flex items-center gap-2 text-sm text-[var(--fg-soft)] hover:bg-[var(--surface)] hover:text-[var(--fg)] transition-colors">
            <Megaphone size={12} /> Ver detalle
          </Link>
        </div>
      )}
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
        className="bg-[var(--bg-elevated)] rounded-lg shadow-xl max-w-md w-full mx-4 p-6 border border-[var(--border)]"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-base font-semibold text-[var(--fg)] mb-3">Renombrar</h3>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full px-3 py-2 border border-[var(--border)] rounded text-sm focus:outline-none focus:border-[var(--accent)]"
        />
        <label className="flex items-center gap-2 mt-3 text-sm text-[var(--fg-soft)]">
          <input type="checkbox" checked={appendSuffix} onChange={(e) => setAppendSuffix(e.target.checked)} />
          Agregar sufijo <span className="font-mono">| Claude</span>
        </label>
        <div className="flex justify-end gap-2 mt-5">
          <button onClick={onCancel} className="px-3 py-1.5 rounded text-sm border border-[var(--border)] hover:bg-[var(--surface)]">Cancelar</button>
          <button onClick={() => onConfirm(name, appendSuffix)} className="px-3 py-1.5 rounded text-sm font-medium text-white bg-[var(--accent)] hover:opacity-90">Guardar</button>
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
        className="bg-[var(--bg-elevated)] rounded-lg shadow-xl max-w-md w-full mx-4 p-6 border border-[var(--border)]"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-base font-semibold text-[var(--fg)] mb-1">Editar presupuesto</h3>
        <p className="text-xs text-[var(--fg-muted)] mb-3">Tipo: <span className="font-mono">{type}</span> · Actual: <span className="font-mono">{fmtUSD(current)}</span></p>
        <div className="relative">
          <span className="absolute left-3 top-2.5 text-[var(--fg-muted)] text-sm">$</span>
          <input
            type="number"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-full pl-7 pr-3 py-2 border border-[var(--border)] rounded text-sm focus:outline-none focus:border-[var(--accent)] font-mono"
          />
        </div>
        <div className="text-xs text-[var(--fg-muted)] mt-2">⚠ Cambio inmediato. Aplica solo si campaña no usa budget a nivel adset.</div>
        <div className="flex justify-end gap-2 mt-5">
          <button onClick={onCancel} className="px-3 py-1.5 rounded text-sm border border-[var(--border)] hover:bg-[var(--surface)]">Cancelar</button>
          <button onClick={() => onConfirm(Number(amount))} className="px-3 py-1.5 rounded text-sm font-medium text-white bg-[var(--accent)] hover:opacity-90">Guardar</button>
        </div>
      </div>
    </div>
  );
}
