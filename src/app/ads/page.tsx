'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { Sidebar } from '@/components/Sidebar';
import { TopBar } from '@/components/TopBar';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { ToastStack } from '@/components/Toast';
import { useToasts } from '@/lib/use-toasts';
import { useAccount } from '@/lib/use-account';
import {
  Play,
  Pause,
  Pencil,
  RefreshCw,
  Tag,
  Search,
  FileText,
  LayoutGrid,
  Rows,
  Video,
  ImageOff,
  CheckCircle2,
} from 'lucide-react';

type CreativeStorySpec = {
  link_data?: { message?: string; name?: string; description?: string; picture?: string };
  video_data?: { message?: string; title?: string; image_url?: string; video_id?: string };
};
type Creative = {
  id?: string;
  name?: string;
  thumbnail_url?: string;
  image_url?: string;
  video_id?: string;
  object_story_spec?: CreativeStorySpec;
};
type Ad = {
  id: string;
  name: string;
  status: string;
  effective_status: string;
  campaign_id: string;
  adset_id: string;
  creative?: Creative;
  created_time?: string;
};

const SUFFIX = ' | Claude';

function previewUrl(ad: Ad): string | null {
  const c = ad.creative;
  if (!c) return null;
  return (
    c.thumbnail_url ||
    c.image_url ||
    c.object_story_spec?.link_data?.picture ||
    c.object_story_spec?.video_data?.image_url ||
    null
  );
}

function previewKind(ad: Ad): 'video' | 'image' | 'none' {
  const c = ad.creative;
  if (!c) return 'none';
  if (c.video_id || c.object_story_spec?.video_data?.video_id) return 'video';
  if (previewUrl(ad)) return 'image';
  return 'none';
}

function adCopy(ad: Ad): string {
  const s = ad.creative?.object_story_spec;
  return s?.link_data?.message || s?.video_data?.message || s?.link_data?.name || s?.video_data?.title || '';
}

function statusDot(s: string): 'success' | 'warning' | 'danger' | 'muted' {
  if (s === 'ACTIVE') return 'success';
  if (s === 'PAUSED') return 'muted';
  if (s.includes('REJECTED') || s.includes('DISAPPROVED') || s.includes('ERROR')) return 'danger';
  return 'warning';
}

export default function AdsPage() {
  const { account, setAccount } = useAccount();
  const [rows, setRows] = useState<Ad[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'PAUSED'>('ALL');
  const [view, setView] = useState<'grid' | 'list'>('grid');
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

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    const f = filter.toLowerCase();
    return rows.filter((a) => {
      if (statusFilter === 'ACTIVE' && a.status !== 'ACTIVE') return false;
      if (statusFilter === 'PAUSED' && a.status !== 'PAUSED') return false;
      if (!f) return true;
      return a.name.toLowerCase().includes(f) || a.id.includes(f);
    });
  }, [rows, filter, statusFilter]);

  const counts = useMemo(
    () => ({
      total: rows.length,
      active: rows.filter((r) => r.status === 'ACTIVE').length,
      paused: rows.filter((r) => r.status === 'PAUSED').length,
    }),
    [rows]
  );

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
        if (j.status === 'pending') {
          push('Activación encolada para aprobación', 'success');
        } else {
          push(`Ad ${next === 'ACTIVE' ? 'activado' : 'pausado'}`, 'success');
        }
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
        <main className="flex-1 px-8 py-8 max-w-[1600px] mx-auto w-full space-y-6">
          {/* Header */}
          <header className="flex items-end justify-between flex-wrap gap-4 fade-in">
            <div>
              <p className="text-[11px] uppercase tracking-[0.16em] text-[var(--fg-muted)] mb-1">Inventario creativo</p>
              <h1 className="display text-5xl text-[var(--fg)]">Anuncios</h1>
              <div className="flex items-center gap-5 mt-3 text-[12px] text-[var(--fg-muted)]">
                <span className="flex items-center gap-1.5">
                  <span className="dot dot-success" /> {counts.active} activos
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="dot dot-muted" /> {counts.paused} pausados
                </span>
                <span className="text-[var(--fg-faint)]">·</span>
                <span className="font-[family-name:var(--font-mono)]">{counts.total} totales</span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* Status pills */}
              <div className="flex items-center gap-px bg-[var(--surface)] border border-[var(--hairline)] rounded-md p-0.5">
                {(['ALL', 'ACTIVE', 'PAUSED'] as const).map((s) => (
                  <button
                    key={s}
                    onClick={() => setStatusFilter(s)}
                    className={`px-3 py-1.5 text-[11px] uppercase tracking-[0.1em] font-semibold rounded transition-colors ${
                      statusFilter === s
                        ? 'bg-[var(--bg-elevated-2)] text-[var(--fg)]'
                        : 'text-[var(--fg-muted)] hover:text-[var(--fg-soft)]'
                    }`}
                  >
                    {s === 'ALL' ? 'Todos' : s === 'ACTIVE' ? 'Activos' : 'Pausados'}
                  </button>
                ))}
              </div>

              <div className="relative">
                <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--fg-muted)]" />
                <input
                  type="text"
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                  placeholder="Buscar nombre o ID…"
                  className="pl-7 pr-3 py-1.5 text-sm bg-[var(--bg-deep)] border border-[var(--hairline)] rounded-md text-[var(--fg)] placeholder:text-[var(--fg-faint)] focus:outline-none focus:border-[var(--accent)] w-56"
                />
              </div>

              {/* View toggle */}
              <div className="flex items-center gap-px bg-[var(--surface)] border border-[var(--hairline)] rounded-md p-0.5">
                <button
                  onClick={() => setView('grid')}
                  className={`p-1.5 rounded transition-colors ${
                    view === 'grid' ? 'bg-[var(--bg-elevated-2)] text-[var(--fg)]' : 'text-[var(--fg-muted)] hover:text-[var(--fg-soft)]'
                  }`}
                  aria-label="Vista grid"
                >
                  <LayoutGrid size={14} />
                </button>
                <button
                  onClick={() => setView('list')}
                  className={`p-1.5 rounded transition-colors ${
                    view === 'list' ? 'bg-[var(--bg-elevated-2)] text-[var(--fg)]' : 'text-[var(--fg-muted)] hover:text-[var(--fg-soft)]'
                  }`}
                  aria-label="Vista lista"
                >
                  <Rows size={14} />
                </button>
              </div>

              <button
                onClick={load}
                disabled={loading}
                className="btn-ghost px-3 py-1.5 rounded-md flex items-center gap-1.5 text-xs"
                aria-label="Recargar"
              >
                <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
                <span className="hidden sm:inline">Recargar</span>
              </button>
            </div>
          </header>

          {/* Bulk actions bar */}
          {selectedIds.size > 0 && (
            <div className="card flex items-center justify-between px-5 py-3 fade-in">
              <div className="flex items-center gap-3">
                <CheckCircle2 size={15} className="text-[var(--accent)]" />
                <span className="text-sm text-[var(--fg)] font-medium">{selectedIds.size} seleccionados</span>
              </div>
              <div className="flex gap-2">
                <button onClick={bulkLabelClaude} className="btn-primary flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md">
                  <Tag size={12} /> Aplicar | Claude
                </button>
                <button onClick={() => setSelectedIds(new Set())} className="btn-ghost text-xs px-3 py-1.5 rounded-md">
                  Limpiar
                </button>
              </div>
            </div>
          )}

          {error && (
            <div className="card border-[var(--danger)]/30 bg-[oklch(0.65_0.20_25_/_0.08)] text-[var(--danger)] px-4 py-3 text-sm">
              {error}
            </div>
          )}

          {/* Loading skeleton */}
          {loading && rows.length === 0 && (
            <div className={view === 'grid' ? 'grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4' : 'space-y-2'}>
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="card animate-pulse">
                  <div className="aspect-square bg-[var(--bg-elevated-2)] rounded-t-md" />
                  <div className="p-4 space-y-2">
                    <div className="h-3 bg-[var(--bg-elevated-2)] rounded w-3/4" />
                    <div className="h-2 bg-[var(--bg-elevated-2)] rounded w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Empty state */}
          {!loading && filtered.length === 0 && (
            <div className="card py-20 text-center fade-in">
              <ImageOff size={36} className="mx-auto text-[var(--fg-faint)] mb-3" />
              <div className="display text-2xl text-[var(--fg-soft)] mb-1">Sin anuncios</div>
              <p className="text-sm text-[var(--fg-muted)]">
                {filter || statusFilter !== 'ALL'
                  ? 'Cambiá filtros o limpiá búsqueda.'
                  : 'Esta cuenta no tiene anuncios todavía.'}
              </p>
            </div>
          )}

          {/* GRID view */}
          {!loading && view === 'grid' && filtered.length > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4 stagger">
              {filtered.map((a) => {
                const url = previewUrl(a);
                const kind = previewKind(a);
                const copy = adCopy(a);
                const selected = selectedIds.has(a.id);
                return (
                  <article
                    key={a.id}
                    className={`card overflow-hidden group transition-all duration-200 ${
                      selected ? 'ring-2 ring-[var(--accent)] border-[var(--accent)]' : 'hover:border-[var(--border-strong)]'
                    }`}
                  >
                    {/* Preview */}
                    <div className="relative aspect-square bg-[var(--bg-deep)] overflow-hidden">
                      {url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={url}
                          alt={a.name}
                          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                          loading="lazy"
                        />
                      ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center gap-1.5 text-[var(--fg-faint)]">
                          <ImageOff size={28} />
                          <span className="text-[10px] uppercase tracking-[0.14em]">Sin preview</span>
                        </div>
                      )}

                      {kind === 'video' && (
                        <span className="absolute top-2 left-2 flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-black/70 text-white text-[10px] backdrop-blur-sm">
                          <Video size={10} /> Video
                        </span>
                      )}

                      <div className="absolute top-2 right-2">
                        <input
                          type="checkbox"
                          checked={selected}
                          onChange={() => toggleSelect(a.id)}
                          className="w-4 h-4 accent-[var(--accent)] cursor-pointer"
                          onClick={(e) => e.stopPropagation()}
                          aria-label="Seleccionar"
                        />
                      </div>

                      <div className="absolute bottom-2 left-2 flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-black/70 backdrop-blur-sm">
                        <span className={`dot dot-${statusDot(a.effective_status)}`} />
                        <span className="text-[10px] uppercase tracking-wider text-white font-medium">
                          {a.effective_status}
                        </span>
                      </div>
                    </div>

                    {/* Body */}
                    <div className="p-4 space-y-3">
                      <div>
                        <h3 className="text-sm font-medium text-[var(--fg)] truncate" title={a.name}>
                          {a.name}
                        </h3>
                        <div className="text-[10px] font-[family-name:var(--font-mono)] text-[var(--fg-faint)] mt-0.5">
                          {a.id}
                        </div>
                      </div>

                      {copy && (
                        <p className="text-[12px] text-[var(--fg-muted)] line-clamp-2 leading-snug">{copy}</p>
                      )}

                      <div className="flex items-center justify-between pt-2 border-t border-[var(--hairline)]">
                        <button
                          onClick={() => toggleStatusOne(a)}
                          className="flex items-center gap-1.5 text-[11px] text-[var(--fg-soft)] hover:text-[var(--fg)] transition-colors"
                          title={a.status === 'ACTIVE' ? 'Pausar' : 'Activar'}
                        >
                          {a.status === 'ACTIVE' ? <Pause size={12} /> : <Play size={12} />}
                          {a.status === 'ACTIVE' ? 'Pausar' : 'Activar'}
                        </button>
                        <div className="flex gap-px">
                          <button
                            onClick={() => setRenameModal({ id: a.id, current: a.name })}
                            className="p-1.5 rounded hover:bg-[var(--surface)] text-[var(--fg-muted)] hover:text-[var(--fg)] transition-colors"
                            title="Renombrar"
                          >
                            <Pencil size={12} />
                          </button>
                          <button
                            onClick={() => setSwapModal({ ad: a })}
                            className="p-1.5 rounded hover:bg-[var(--surface)] text-[var(--fg-muted)] hover:text-[var(--fg)] transition-colors"
                            title="Cambiar lead form"
                          >
                            <FileText size={12} />
                          </button>
                        </div>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}

          {/* LIST view */}
          {!loading && view === 'list' && filtered.length > 0 && (
            <div className="card overflow-hidden fade-in">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-[10px] uppercase tracking-[0.14em] text-[var(--fg-muted)] font-semibold border-b border-[var(--hairline)]">
                      <th className="px-4 py-3 w-10">
                        <input
                          type="checkbox"
                          checked={filtered.length > 0 && selectedIds.size === filtered.length}
                          onChange={toggleSelectAll}
                          className="accent-[var(--accent)] cursor-pointer"
                        />
                      </th>
                      <th className="py-3 w-16" />
                      <th className="px-4 py-3 text-left">Anuncio</th>
                      <th className="px-4 py-3 text-left">Estado</th>
                      <th className="px-4 py-3 text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((a) => {
                      const url = previewUrl(a);
                      const kind = previewKind(a);
                      return (
                        <tr
                          key={a.id}
                          className="border-t border-[var(--hairline)] hover:bg-[var(--surface)] transition-colors"
                        >
                          <td className="px-4 py-3">
                            <input
                              type="checkbox"
                              checked={selectedIds.has(a.id)}
                              onChange={() => toggleSelect(a.id)}
                              className="accent-[var(--accent)] cursor-pointer"
                            />
                          </td>
                          <td className="py-2">
                            <div className="w-14 h-14 rounded bg-[var(--bg-deep)] overflow-hidden border border-[var(--hairline)] relative">
                              {url ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={url} alt="" className="w-full h-full object-cover" loading="lazy" />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center text-[var(--fg-faint)]">
                                  <ImageOff size={16} />
                                </div>
                              )}
                              {kind === 'video' && (
                                <span className="absolute bottom-0 right-0 bg-black/70 text-white p-0.5 rounded-tl">
                                  <Video size={9} />
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="text-[var(--fg)] font-medium truncate max-w-xs">{a.name}</div>
                            <div className="text-[10px] font-[family-name:var(--font-mono)] text-[var(--fg-faint)] mt-0.5">
                              {a.id}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1.5">
                              <span className={`dot dot-${statusDot(a.effective_status)}`} />
                              <span className="text-[11px] uppercase tracking-wider text-[var(--fg-soft)]">
                                {a.effective_status}
                              </span>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex justify-end gap-px">
                              <button
                                onClick={() => toggleStatusOne(a)}
                                className="p-1.5 rounded hover:bg-[var(--bg-elevated-2)] text-[var(--fg-muted)] hover:text-[var(--fg)] transition-colors"
                                title={a.status === 'ACTIVE' ? 'Pausar' : 'Activar'}
                              >
                                {a.status === 'ACTIVE' ? <Pause size={13} /> : <Play size={13} />}
                              </button>
                              <button
                                onClick={() => setRenameModal({ id: a.id, current: a.name })}
                                className="p-1.5 rounded hover:bg-[var(--bg-elevated-2)] text-[var(--fg-muted)] hover:text-[var(--fg)] transition-colors"
                                title="Renombrar"
                              >
                                <Pencil size={13} />
                              </button>
                              <button
                                onClick={() => setSwapModal({ ad: a })}
                                className="p-1.5 rounded hover:bg-[var(--bg-elevated-2)] text-[var(--fg-muted)] hover:text-[var(--fg)] transition-colors"
                                title="Cambiar lead form"
                              >
                                <FileText size={13} />
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

      {swapModal && (
        <SwapFormModal
          ad={swapModal.ad}
          accountId={account}
          onCancel={() => setSwapModal(null)}
          onDone={(msg, type) => {
            push(msg, type);
            setSwapModal(null);
            load();
          }}
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
  const [forms, setForms] = useState<Array<{ id: string; name: string; leads_count?: number; status?: string; created_time?: string }>>([]);
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
        else
          setForms(
            (j.data || []).sort(
              (a: { created_time?: string }, b: { created_time?: string }) =>
                (b.created_time || '').localeCompare(a.created_time || '')
            )
          );
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onCancel}>
      <div
        className="card max-w-lg w-full mx-4 p-6 max-h-[80vh] overflow-y-auto shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="display text-2xl text-[var(--fg)] mb-1">Cambiar Lead Form</h3>
        <p className="text-xs text-[var(--fg-muted)] mb-5">Ad: {ad.name}</p>

        <label className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--fg-muted)]">Página</label>
        <select
          value={pageId}
          onChange={(e) => setPageId(e.target.value)}
          disabled={loadingPages}
          className="w-full mt-1.5 px-3 py-2 bg-[var(--bg-deep)] border border-[var(--hairline)] rounded-md text-sm text-[var(--fg)]"
        >
          {pages.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} ({p.id})
            </option>
          ))}
        </select>

        <label className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--fg-muted)] mt-5 block">
          Lead Form ({forms.length})
        </label>
        <div className="border border-[var(--hairline)] rounded-md mt-1.5 max-h-72 overflow-y-auto bg-[var(--bg-deep)]">
          {loadingForms && <div className="p-3 text-sm text-[var(--fg-muted)]">Cargando forms…</div>}
          {!loadingForms && forms.length === 0 && (
            <div className="p-3 text-sm text-[var(--fg-faint)]">Sin forms</div>
          )}
          {forms.map((f) => (
            <button
              key={f.id}
              onClick={() => setSelectedForm(f.id)}
              className={`w-full text-left px-3 py-2 border-b border-[var(--hairline)] text-sm transition-colors ${
                selectedForm === f.id
                  ? 'bg-[var(--accent-soft)] text-[var(--fg)]'
                  : 'text-[var(--fg-soft)] hover:bg-[var(--surface)]'
              }`}
            >
              <div className="font-medium">{f.name}</div>
              <div className="text-[10px] font-[family-name:var(--font-mono)] text-[var(--fg-faint)]">
                {f.id} · {f.leads_count || 0} leads · {f.status}
              </div>
            </button>
          ))}
        </div>

        <div className="flex justify-end gap-2 mt-6">
          <button onClick={onCancel} disabled={saving} className="btn-ghost px-3 py-1.5 rounded-md text-sm">
            Cancelar
          </button>
          <button
            onClick={swap}
            disabled={!selectedForm || saving}
            className="btn-primary px-4 py-1.5 rounded-md text-sm disabled:opacity-40"
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onCancel}>
      <div
        className="card max-w-md w-full mx-4 p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="display text-2xl text-[var(--fg)] mb-4">Renombrar anuncio</h3>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full px-3 py-2 bg-[var(--bg-deep)] border border-[var(--hairline)] rounded-md text-sm text-[var(--fg)] focus:outline-none focus:border-[var(--accent)]"
        />
        <label className="flex items-center gap-2 mt-3 text-sm text-[var(--fg-soft)]">
          <input
            type="checkbox"
            checked={appendSuffix}
            onChange={(e) => setAppendSuffix(e.target.checked)}
            className="accent-[var(--accent)]"
          />
          Agregar sufijo <span className="font-[family-name:var(--font-mono)] text-[var(--fg)]">| Claude</span>
        </label>
        <div className="flex justify-end gap-2 mt-6">
          <button onClick={onCancel} className="btn-ghost px-3 py-1.5 rounded-md text-sm">
            Cancelar
          </button>
          <button onClick={() => onConfirm(name, appendSuffix)} className="btn-primary px-4 py-1.5 rounded-md text-sm">
            Guardar
          </button>
        </div>
      </div>
    </div>
  );
}
