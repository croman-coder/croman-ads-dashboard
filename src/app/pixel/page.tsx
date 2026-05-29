'use client';

import { useCallback, useEffect, useState } from 'react';
import { Sidebar } from '@/components/Sidebar';
import { TopBar } from '@/components/TopBar';
import { useAccount } from '@/lib/use-account';
import { ToastStack } from '@/components/Toast';
import { useToasts } from '@/lib/use-toasts';
import {
  RefreshCw,
  Activity,
  Radio,
  ServerCog,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Copy as CopyIcon,
} from 'lucide-react';

type PixelStat = { event: string; count: number };
type Pixel = {
  id: string;
  name: string;
  last_fired_time?: string;
  health: 'active' | 'stale' | 'missing';
  stats: { events: PixelStat[]; total: number };
  capi: { configured: boolean; last_fired_time?: string };
};

function fmtInt(n: number) {
  return n.toLocaleString('es-PY');
}
function fmtDate(s?: string) {
  if (!s) return '—';
  return new Date(s).toLocaleString('es-PY', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

const HEALTH = {
  active: { dot: 'dot-success', label: 'Activo', color: 'text-[var(--success)]' },
  stale: { dot: 'dot-warning', label: 'Sin eventos recientes', color: 'text-[var(--warning)]' },
  missing: { dot: 'dot-danger', label: 'Sin pixel', color: 'text-[var(--danger)]' },
} as const;

const STD_EVENTS = ['PageView', 'ViewContent', 'Lead', 'Purchase'];

export default function PixelPage() {
  const { account, setAccount } = useAccount();
  const { toasts, push, dismiss } = useToasts();
  const [pixels, setPixels] = useState<Pixel[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!account) return;
    setLoading(true);
    setError(null);
    try {
      const r = await fetch(`/api/pixel/${account}`);
      const j = await r.json();
      if (j.error) throw new Error(j.error);
      setPixels(j.pixels || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error');
    } finally {
      setLoading(false);
    }
  }, [account]);

  useEffect(() => { load(); }, [load]);

  function copy(t: string) {
    navigator.clipboard.writeText(t);
    push('Copiado', 'success');
  }

  const totalActive = pixels.filter((p) => p.health === 'active').length;
  const capiOn = pixels.filter((p) => p.capi?.configured).length;

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex-1 flex flex-col">
        <TopBar selected={account} onSelect={setAccount} />
        <main className="flex-1 px-8 py-8 max-w-[1500px] mx-auto w-full space-y-6">
          <header className="flex items-end justify-between flex-wrap gap-4 fade-in">
            <div>
              <p className="eyebrow mb-1 flex items-center gap-1.5"><Radio size={12} className="text-[var(--accent)]" /> Tracking</p>
              <h1 className="display text-5xl">Pixel & CAPI</h1>
              <p className="text-sm text-[var(--fg-muted)] mt-2">
                {pixels.length} pixel(s) · <span className="text-[var(--success)]">{totalActive} activos</span> · {capiOn} con CAPI server-side
              </p>
            </div>
            <button onClick={load} disabled={loading} className="btn-ghost px-4 py-2 flex items-center gap-2">
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Recargar
            </button>
          </header>

          {error && (
            <div className="card border-[var(--danger)]/30 bg-[var(--danger)]/10 text-[var(--danger)] px-4 py-3 text-sm">{error}</div>
          )}

          {loading && pixels.length === 0 && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 stagger">
              {[0, 1].map((i) => (
                <div key={i} className="card p-6 animate-pulse space-y-3">
                  <div className="h-4 bg-[var(--surface-2)] rounded w-1/2" />
                  <div className="h-20 bg-[var(--surface-2)] rounded" />
                </div>
              ))}
            </div>
          )}

          {!loading && pixels.length === 0 && !error && (
            <div className="card py-20 text-center">
              <Radio size={36} className="mx-auto text-[var(--fg-faint)] mb-3" />
              <h3 className="display text-2xl text-[var(--fg-soft)] mb-1">Sin pixel detectado</h3>
              <p className="text-sm text-[var(--fg-muted)]">Esta cuenta no tiene pixel de Meta. Instalalo desde Events Manager para habilitar retargeting y CAPI.</p>
            </div>
          )}

          {pixels.length > 0 && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 stagger">
              {pixels.map((p) => {
                const h = HEALTH[p.health];
                const evMap = Object.fromEntries(p.stats.events.map((e) => [e.event, e.count]));
                return (
                  <article key={p.id} className="card p-6 lift">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[var(--accent)] to-[oklch(0.70_0.26_330)] flex items-center justify-center">
                          <Activity size={18} className="text-white" />
                        </div>
                        <div>
                          <h2 className="text-[15px] font-semibold text-[var(--fg)]">{p.name}</h2>
                          <button onClick={() => copy(p.id)} className="text-[11px] font-[family-name:var(--font-mono)] text-[var(--fg-faint)] hover:text-[var(--accent)] flex items-center gap-1">
                            {p.id} <CopyIcon size={10} />
                          </button>
                        </div>
                      </div>
                      <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-[10px] uppercase tracking-[0.1em] font-bold border border-[var(--border)] ${h.color}`}>
                        <span className={`dot ${h.dot}`} /> {h.label}
                      </span>
                    </div>

                    {/* Event counts */}
                    <div className="grid grid-cols-4 gap-2 mb-4">
                      {STD_EVENTS.map((ev) => {
                        const cnt = evMap[ev] || 0;
                        return (
                          <div key={ev} className="card-flat p-3 text-center">
                            <div className="numeric text-lg font-semibold text-[var(--fg)]">{fmtInt(cnt)}</div>
                            <div className="text-[9px] uppercase tracking-wider text-[var(--fg-muted)] mt-0.5">{ev}</div>
                          </div>
                        );
                      })}
                    </div>

                    {/* CAPI status */}
                    <div className="flex items-center justify-between pt-4 border-t border-[var(--hairline)]">
                      <div className="flex items-center gap-2">
                        <ServerCog size={14} className={p.capi.configured ? 'text-[var(--success)]' : 'text-[var(--fg-muted)]'} />
                        <span className="text-[12px] text-[var(--fg-soft)]">Conversions API</span>
                        {p.capi.configured ? (
                          <span className="inline-flex items-center gap-1 text-[11px] text-[var(--success)]"><CheckCircle2 size={11} /> activo</span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] text-[var(--warning)]"><AlertTriangle size={11} /> no configurado</span>
                        )}
                      </div>
                      <span className="text-[11px] text-[var(--fg-faint)] font-[family-name:var(--font-mono)]">
                        últ. evento {fmtDate(p.last_fired_time)}
                      </span>
                    </div>
                  </article>
                );
              })}
            </div>
          )}

          {/* Setup guide */}
          <section className="card p-6">
            <div className="eyebrow mb-3 flex items-center gap-1.5"><ServerCog size={11} /> Guía CAPI server-side</div>
            <ol className="text-[13px] text-[var(--fg-soft)] space-y-2 list-decimal pl-5">
              <li>Las ventas del CRM (Bitrix / facturación) se envían a <code className="font-[family-name:var(--font-mono)] bg-[var(--surface-2)] px-1.5 py-0.5 rounded text-[var(--accent)]">POST /api/capi/event</code></li>
              <li>El servidor hashea email/teléfono con SHA256 antes de tocar Meta — el dato crudo nunca se guarda</li>
              <li>Meta matchea la venta con el click → cierra attribution post-iOS 17</li>
              <li>Header <code className="font-[family-name:var(--font-mono)] bg-[var(--surface-2)] px-1.5 py-0.5 rounded">x-capi-key</code> con <code className="font-[family-name:var(--font-mono)] bg-[var(--surface-2)] px-1.5 py-0.5 rounded">CAPI_INGEST_KEY</code> autoriza la fuente externa</li>
            </ol>
          </section>
        </main>
      </div>
      <ToastStack toasts={toasts} onDismiss={dismiss} />
    </div>
  );
}
