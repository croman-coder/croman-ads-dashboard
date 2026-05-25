'use client';

import { useCallback, useEffect, useState } from 'react';
import { Sidebar } from '@/components/Sidebar';
import { TopBar } from '@/components/TopBar';
import { ToastStack } from '@/components/Toast';
import { useToasts } from '@/lib/use-toasts';
import { useAccount } from '@/lib/use-account';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import {
  RefreshCw,
  Search,
  ImageOff,
  Trash2,
  Copy as CopyIcon,
  Download,
  LayoutGrid,
  Rows,
  FileVideo,
  FileImage,
  Upload,
} from 'lucide-react';
import Link from 'next/link';

type BlobItem = {
  url: string;
  pathname: string;
  size: number;
  uploadedAt: string;
};

function isVideo(name: string): boolean {
  return /\.(mp4|mov|webm)$/i.test(name);
}
function fmtSize(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}
function fmtDate(s: string): string {
  return new Date(s).toLocaleDateString('es-PY', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function LibraryPage() {
  const { account, setAccount } = useAccount();
  const { toasts, push, dismiss } = useToasts();
  const [items, setItems] = useState<BlobItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<'grid' | 'list'>('grid');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'ALL' | 'image' | 'video'>('ALL');
  const [confirm, setConfirm] = useState<null | { target: string; name: string }>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch('/api/library');
      const j = await r.json();
      if (j.error) throw new Error(j.error);
      setItems(j.blobs || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function doDelete(url: string) {
    try {
      const r = await fetch(`/api/library?url=${encodeURIComponent(url)}`, { method: 'DELETE' });
      const j = await r.json();
      if (j.error) throw new Error(j.error);
      push('Archivo eliminado', 'success');
      load();
    } catch (e) {
      push(e instanceof Error ? e.message : 'Error', 'error');
    } finally {
      setConfirm(null);
    }
  }

  function copyUrl(url: string) {
    navigator.clipboard.writeText(url);
    push('URL copiada', 'success');
  }

  const filtered = items.filter((b) => {
    const video = isVideo(b.pathname);
    if (filter === 'image' && video) return false;
    if (filter === 'video' && !video) return false;
    if (search && !b.pathname.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const totalSize = items.reduce((s, b) => s + b.size, 0);

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex-1 flex flex-col">
        <TopBar selected={account} onSelect={setAccount} />
        <main className="flex-1 px-8 py-8 max-w-[1600px] mx-auto w-full space-y-6">
          {/* Header */}
          <header className="flex items-end justify-between flex-wrap gap-4 fade-in">
            <div>
              <p className="eyebrow mb-1">Materiales subidos</p>
              <h1 className="display text-5xl">Biblioteca</h1>
              <p className="text-sm text-[var(--fg-muted)] mt-2">
                <span className="text-[var(--fg)] font-medium">{items.length}</span> archivos · {fmtSize(totalSize)} en Vercel Blob
              </p>
            </div>
            <Link href="/creative/new" className="btn-gradient px-5 py-2.5 flex items-center gap-2">
              <Upload size={14} />
              Subir nuevos
            </Link>
          </header>

          {/* Toolbar */}
          <div className="flex items-center justify-between flex-wrap gap-3 border-b border-[var(--hairline)]">
            <div className="flex items-center gap-1">
              {(['ALL', 'image', 'video'] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`px-4 py-2.5 text-[12px] uppercase tracking-[0.12em] font-semibold border-b-2 transition-colors -mb-px ${
                    filter === f
                      ? 'border-[var(--accent)] text-[var(--fg)]'
                      : 'border-transparent text-[var(--fg-muted)] hover:text-[var(--fg-soft)]'
                  }`}
                >
                  {f === 'ALL' ? 'Todos' : f === 'image' ? 'Imágenes' : 'Videos'}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2 pb-2">
              <div className="relative">
                <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--fg-muted)]" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar archivo…"
                  className="pl-7 pr-3 py-1.5 bg-[var(--bg-elevated)] border border-[var(--border)] rounded-md text-sm text-[var(--fg)] placeholder:text-[var(--fg-faint)] focus:outline-none focus:border-[var(--accent)] w-56 shadow-sm"
                />
              </div>
              <div className="flex items-center gap-px bg-[var(--bg-elevated)] border border-[var(--border)] rounded-md p-0.5 shadow-sm">
                <button onClick={() => setView('grid')} className={`p-1.5 rounded ${view === 'grid' ? 'bg-[var(--surface-2)] text-[var(--fg)]' : 'text-[var(--fg-muted)]'}`}>
                  <LayoutGrid size={14} />
                </button>
                <button onClick={() => setView('list')} className={`p-1.5 rounded ${view === 'list' ? 'bg-[var(--surface-2)] text-[var(--fg)]' : 'text-[var(--fg-muted)]'}`}>
                  <Rows size={14} />
                </button>
              </div>
              <button onClick={load} disabled={loading} className="btn-ghost px-3 py-1.5 flex items-center gap-1.5">
                <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
              </button>
            </div>
          </div>

          {error && (
            <div className="card border-[var(--danger)]/30 bg-[var(--danger)]/10 text-[var(--danger)] px-4 py-3 text-sm">
              {error}
              {error.includes('BLOB_READ_WRITE_TOKEN') && (
                <p className="text-[12px] text-[var(--fg-muted)] mt-2">
                  Provisionar Vercel Blob en Dashboard → Storage → Blob.
                </p>
              )}
            </div>
          )}

          {!loading && filtered.length === 0 && !error && (
            <div className="card py-20 text-center">
              <ImageOff size={36} className="mx-auto text-[var(--fg-faint)] mb-3" />
              <h3 className="display text-2xl text-[var(--fg-soft)] mb-1">Sin materiales</h3>
              <p className="text-sm text-[var(--fg-muted)]">{search ? 'No coincide con la búsqueda.' : 'Subí tus primeros materiales desde Crear con IA.'}</p>
            </div>
          )}

          {/* GRID */}
          {!loading && view === 'grid' && filtered.length > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 stagger">
              {filtered.map((b) => {
                const video = isVideo(b.pathname);
                const name = b.pathname.split('/').pop() || b.pathname;
                return (
                  <article key={b.url} className="card lift overflow-hidden group">
                    <div className="relative aspect-square bg-[var(--bg-elevated-2)] overflow-hidden">
                      {video ? (
                        <video src={b.url} className="w-full h-full object-cover" muted preload="metadata" />
                      ) : (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={b.url} alt={name} className="w-full h-full object-cover transition-transform group-hover:scale-105" loading="lazy" />
                      )}
                      {video && (
                        <span className="absolute top-2 left-2 flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-black/70 text-white text-[10px] backdrop-blur-sm">
                          <FileVideo size={10} /> Video
                        </span>
                      )}
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100">
                        <button onClick={() => copyUrl(b.url)} className="w-9 h-9 rounded-full bg-white/95 text-[var(--fg)] flex items-center justify-center hover:scale-110 transition-transform" title="Copiar URL">
                          <CopyIcon size={14} />
                        </button>
                        <a href={b.url} download className="w-9 h-9 rounded-full bg-white/95 text-[var(--fg)] flex items-center justify-center hover:scale-110 transition-transform" title="Descargar">
                          <Download size={14} />
                        </a>
                        <button onClick={() => setConfirm({ target: b.url, name })} className="w-9 h-9 rounded-full bg-[var(--danger)] text-white flex items-center justify-center hover:scale-110 transition-transform" title="Eliminar">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                    <div className="p-3">
                      <div className="text-[12px] text-[var(--fg)] font-medium truncate" title={name}>{name}</div>
                      <div className="text-[10px] text-[var(--fg-faint)] mt-0.5 flex items-center justify-between">
                        <span>{fmtSize(b.size)}</span>
                        <span>{fmtDate(b.uploadedAt)}</span>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}

          {/* LIST */}
          {!loading && view === 'list' && filtered.length > 0 && (
            <div className="card overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-[10px] uppercase tracking-[0.14em] text-[var(--fg-muted)] font-semibold border-b border-[var(--hairline)]">
                    <th className="px-4 py-3 text-left w-16"></th>
                    <th className="px-4 py-3 text-left">Archivo</th>
                    <th className="px-4 py-3 text-right">Tamaño</th>
                    <th className="px-4 py-3 text-left">Subido</th>
                    <th className="px-4 py-3 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((b) => {
                    const video = isVideo(b.pathname);
                    const name = b.pathname.split('/').pop() || b.pathname;
                    return (
                      <tr key={b.url} className="border-t border-[var(--hairline)] hover:bg-[var(--surface)]">
                        <td className="py-2">
                          <div className="w-12 h-12 rounded overflow-hidden bg-[var(--bg-elevated-2)] border border-[var(--hairline)]">
                            {video ? (
                              <div className="w-full h-full flex items-center justify-center text-[var(--fg-faint)]"><FileVideo size={14} /></div>
                            ) : (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={b.url} alt="" className="w-full h-full object-cover" loading="lazy" />
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-2">
                          <div className="text-[var(--fg)] font-medium truncate max-w-md flex items-center gap-2">
                            {video ? <FileVideo size={11} className="text-[var(--fg-muted)]" /> : <FileImage size={11} className="text-[var(--fg-muted)]" />}
                            {name}
                          </div>
                        </td>
                        <td className="px-4 py-2 text-right font-[family-name:var(--font-mono)]">{fmtSize(b.size)}</td>
                        <td className="px-4 py-2 text-[12px] text-[var(--fg-muted)] font-[family-name:var(--font-mono)]">{fmtDate(b.uploadedAt)}</td>
                        <td className="px-4 py-2">
                          <div className="flex justify-end gap-1">
                            <button onClick={() => copyUrl(b.url)} className="p-1.5 rounded hover:bg-[var(--surface-2)] text-[var(--fg-soft)] hover:text-[var(--fg)] transition-colors" title="Copiar URL">
                              <CopyIcon size={13} />
                            </button>
                            <a href={b.url} download className="p-1.5 rounded hover:bg-[var(--surface-2)] text-[var(--fg-soft)] hover:text-[var(--fg)] transition-colors" title="Descargar">
                              <Download size={13} />
                            </a>
                            <button onClick={() => setConfirm({ target: b.url, name })} className="p-1.5 rounded hover:bg-[var(--surface-2)] text-[var(--danger)] transition-colors" title="Eliminar">
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </main>
      </div>

      <ConfirmDialog
        open={!!confirm}
        title="Eliminar material"
        message={`Eliminar ${confirm?.name}? Esta acción no se puede deshacer.`}
        destructive
        onConfirm={() => confirm && doDelete(confirm.target)}
        onCancel={() => setConfirm(null)}
      />

      <ToastStack toasts={toasts} onDismiss={dismiss} />
    </div>
  );
}
