'use client';

import { useCallback, useEffect, useState } from 'react';
import { Sidebar } from '@/components/Sidebar';
import { TopBar } from '@/components/TopBar';
import { useAccount } from '@/lib/use-account';
import { ToastStack } from '@/components/Toast';
import { useToasts } from '@/lib/use-toasts';
import {
  Users, RefreshCw, Plus, Radio, Heart, FileText, UploadCloud, Copy as CopyIcon,
  Loader2, X, Sparkles, TrendingUp,
} from 'lucide-react';
// Loader2 used inside modals

type Audience = {
  id: string;
  name: string;
  subtype: string;
  approximate_count_lower_bound?: number;
  approximate_count_upper_bound?: number;
  delivery_status?: { code: number; description: string };
  time_created?: string;
};

type Source = 'pixel' | 'engagement' | 'leadform' | 'customer';

const SUBTYPE_LABEL: Record<string, string> = {
  WEBSITE: 'Pixel', ENGAGEMENT: 'Engagement', LEAD_GEN: 'Lead form',
  CUSTOM: 'Lista clientes', LOOKALIKE: 'Lookalike',
};

function fmtSize(a: Audience) {
  const lo = a.approximate_count_lower_bound, hi = a.approximate_count_upper_bound;
  if (lo == null && hi == null) return '—';
  if (lo != null && hi != null) return `${lo.toLocaleString('es-PY')}–${hi.toLocaleString('es-PY')}`;
  return (hi ?? lo ?? 0).toLocaleString('es-PY');
}

async function sha256(s: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

export default function AudiencesPage() {
  const { account, setAccount } = useAccount();
  const { toasts, push, dismiss } = useToasts();
  const [rows, setRows] = useState<Audience[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [lalSeed, setLalSeed] = useState<Audience | null>(null);

  const load = useCallback(async () => {
    if (!account) return;
    setLoading(true); setError(null);
    try {
      const r = await fetch(`/api/audiences?account_id=${account}`);
      const j = await r.json();
      if (j.error) throw new Error(j.error);
      setRows(j.audiences || []);
    } catch (e) { setError(e instanceof Error ? e.message : 'Error'); }
    finally { setLoading(false); }
  }, [account]);

  useEffect(() => { load(); }, [load]);

  const customCount = rows.filter((r) => r.subtype !== 'LOOKALIKE').length;
  const lalCount = rows.filter((r) => r.subtype === 'LOOKALIKE').length;

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex-1 flex flex-col">
        <TopBar selected={account} onSelect={setAccount} />
        <main className="flex-1 px-8 py-8 max-w-[1500px] mx-auto w-full space-y-6">
          <header className="flex items-end justify-between flex-wrap gap-4 fade-in">
            <div>
              <p className="eyebrow mb-1 flex items-center gap-1.5"><Users size={12} className="text-[var(--accent)]" /> Audiencias</p>
              <h1 className="display text-5xl">Públicos.</h1>
              <p className="text-sm text-[var(--fg-muted)] mt-2">{customCount} custom · {lalCount} lookalikes · retargeting + LAL</p>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => setCreateOpen(true)} className="btn-gradient px-4 py-2.5 flex items-center gap-2">
                <Plus size={14} /> Nueva audiencia
              </button>
              <button onClick={load} disabled={loading} className="btn-ghost px-3 py-2 flex items-center gap-1.5">
                <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
              </button>
            </div>
          </header>

          {error && <div className="card border-[var(--danger)]/30 bg-[var(--danger)]/10 text-[var(--danger)] px-4 py-3 text-sm">{error}</div>}

          {!loading && rows.length === 0 && !error && (
            <div className="card py-20 text-center">
              <Users size={36} className="mx-auto text-[var(--fg-faint)] mb-3" />
              <h3 className="display text-2xl text-[var(--fg-soft)] mb-1">Sin audiencias</h3>
              <p className="text-sm text-[var(--fg-muted)]">Creá tu primera audiencia de retargeting o lista de clientes.</p>
            </div>
          )}

          {rows.length > 0 && (
            <div className="card overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-[10px] uppercase tracking-[0.14em] text-[var(--fg-muted)] font-semibold border-b border-[var(--hairline)]">
                    <th className="px-6 py-3 text-left">Audiencia</th>
                    <th className="px-4 py-3 text-left">Tipo</th>
                    <th className="px-4 py-3 text-right">Tamaño</th>
                    <th className="px-4 py-3 text-left">Estado</th>
                    <th className="px-6 py-3 text-right">Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((a) => (
                    <tr key={a.id} className="border-t border-[var(--hairline)] hover:bg-[var(--surface)]">
                      <td className="px-6 py-3">
                        <div className="text-[var(--fg)] font-medium">{a.name}</div>
                        <div className="text-[10px] font-[family-name:var(--font-mono)] text-[var(--fg-faint)]">{a.id}</div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-[11px] px-2 py-0.5 rounded-full border border-[var(--border)] text-[var(--fg-soft)]">{SUBTYPE_LABEL[a.subtype] || a.subtype}</span>
                      </td>
                      <td className="px-4 py-3 text-right font-[family-name:var(--font-mono)] text-[var(--fg-soft)]">{fmtSize(a)}</td>
                      <td className="px-4 py-3 text-[11px] text-[var(--fg-muted)]">{a.delivery_status?.description || '—'}</td>
                      <td className="px-6 py-3 text-right">
                        {a.subtype !== 'LOOKALIKE' && (
                          <button onClick={() => setLalSeed(a)} className="btn-glass px-3 py-1.5 text-[12px] inline-flex items-center gap-1.5">
                            <Sparkles size={12} /> Crear LAL
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </main>
      </div>

      {createOpen && <CreateModal account={account} onClose={() => setCreateOpen(false)} push={push} onDone={() => { setCreateOpen(false); load(); }} />}
      {lalSeed && <LookalikeModal account={account} seed={lalSeed} onClose={() => setLalSeed(null)} push={push} onDone={() => { setLalSeed(null); load(); }} />}

      <ToastStack toasts={toasts} onDismiss={dismiss} />
      <style jsx global>{`.ainput{width:100%;background:var(--bg-elevated-2);border:1px solid var(--border);border-radius:var(--radius);padding:9px 12px;font-size:13px;color:var(--fg)}.ainput:focus{outline:none;border-color:var(--accent)}.ainput::placeholder{color:var(--fg-faint)}`}</style>
    </div>
  );

  // ---- Modals (closures over sha256/source) ----
  function CreateModal({ account, onClose, push, onDone }: { account: string; onClose: () => void; push: (m: string, t: 'success'|'error') => void; onDone: () => void }) {
    const [source, setSource] = useState<Source>('pixel');
    const [name, setName] = useState('');
    const [pixelId, setPixelId] = useState('');
    const [pageId, setPageId] = useState('');
    const [event, setEvent] = useState('Lead');
    const [retention, setRetention] = useState(90);
    const [schema, setSchema] = useState<'EMAIL_SHA256' | 'PHONE_SHA256'>('EMAIL_SHA256');
    const [raw, setRaw] = useState('');
    const [saving, setSaving] = useState(false);

    const SOURCES: Array<{ id: Source; icon: typeof Radio; title: string; desc: string }> = [
      { id: 'pixel', icon: Radio, title: 'Pixel', desc: 'Visitantes web / eventos (Lead, Purchase)' },
      { id: 'engagement', icon: Heart, title: 'Engagement', desc: 'Interactuaron con IG / Facebook' },
      { id: 'leadform', icon: FileText, title: 'Lead form', desc: 'Abrieron / enviaron formularios' },
      { id: 'customer', icon: UploadCloud, title: 'Lista clientes', desc: 'CSV email/tel — hash SHA256 local' },
    ];

    async function submit() {
      if (!name.trim()) { push('Falta nombre', 'error'); return; }
      setSaving(true);
      try {
        if (source === 'customer') {
          const lines = raw.split(/[\n,;]+/).map((s) => s.trim()).filter(Boolean);
          if (!lines.length) { push('Pegá emails/teléfonos', 'error'); setSaving(false); return; }
          const norm = lines.map((l) => schema === 'EMAIL_SHA256' ? l.toLowerCase() : l.replace(/[^\d]/g, ''));
          const hashed = await Promise.all(norm.map(sha256));
          const r = await fetch('/api/audiences/customer-list', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ account_id: account, name, schema, hashed_data: hashed }),
          });
          const j = await r.json();
          if (!r.ok) throw new Error(j.error || 'Error');
          push(`Lista encolada: ${hashed.length} contactos hasheados`, 'success');
        } else {
          const body: Record<string, unknown> = { account_id: account, name, source: source === 'leadform' ? 'engagement' : source };
          if (source === 'pixel') { body.pixel_id = pixelId; body.event = event; body.retention_days = retention; }
          else { body.page_id = pageId; body.engagement_type = source === 'leadform' ? 'leadform' : 'page'; body.retention_days = retention; }
          const r = await fetch('/api/audiences', {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
          });
          const j = await r.json();
          if (!r.ok) throw new Error(j.error || 'Error');
          push('Audiencia encolada para aprobación', 'success');
        }
        onDone();
      } catch (e) { push(e instanceof Error ? e.message : 'Error', 'error'); }
      finally { setSaving(false); }
    }

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
        <div className="card max-w-lg w-full mx-4 p-6 max-h-[85vh] overflow-y-auto shadow-2xl" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="display text-2xl">Nueva audiencia</h3>
            <button onClick={onClose} className="text-[var(--fg-muted)] hover:text-[var(--fg)]"><X size={18} /></button>
          </div>

          <div className="grid grid-cols-2 gap-2 mb-5">
            {SOURCES.map((s) => {
              const Icon = s.icon; const sel = source === s.id;
              return (
                <button key={s.id} onClick={() => setSource(s.id)}
                  className={`text-left p-3 rounded-lg border transition-all ${sel ? 'border-[var(--accent)] bg-[var(--accent-soft)]' : 'border-[var(--border)] hover:border-[var(--border-strong)]'}`}>
                  <Icon size={16} className={sel ? 'text-[var(--accent)]' : 'text-[var(--fg-muted)]'} />
                  <div className="text-[13px] font-semibold text-[var(--fg)] mt-1.5">{s.title}</div>
                  <div className="text-[10px] text-[var(--fg-muted)] leading-tight mt-0.5">{s.desc}</div>
                </button>
              );
            })}
          </div>

          <div className="space-y-3">
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nombre audiencia" className="ainput" />

            {source === 'pixel' && (
              <>
                <input value={pixelId} onChange={(e) => setPixelId(e.target.value)} placeholder="Pixel ID (ver en /pixel)" className="ainput" />
                <div className="grid grid-cols-2 gap-3">
                  <select value={event} onChange={(e) => setEvent(e.target.value)} className="ainput">
                    {['Todos', 'ViewContent', 'Lead', 'Purchase'].map((ev) => <option key={ev} value={ev === 'Todos' ? '' : ev}>{ev}</option>)}
                  </select>
                  <select value={retention} onChange={(e) => setRetention(Number(e.target.value))} className="ainput">
                    {[30, 60, 90, 180].map((d) => <option key={d} value={d}>{d} días</option>)}
                  </select>
                </div>
              </>
            )}

            {(source === 'engagement' || source === 'leadform') && (
              <>
                <input value={pageId} onChange={(e) => setPageId(e.target.value)} placeholder="Page ID / IG ID" className="ainput" />
                <select value={retention} onChange={(e) => setRetention(Number(e.target.value))} className="ainput">
                  {[30, 60, 90, 180, 365].map((d) => <option key={d} value={d}>{d} días</option>)}
                </select>
              </>
            )}

            {source === 'customer' && (
              <>
                <div className="flex gap-1.5">
                  {(['EMAIL_SHA256', 'PHONE_SHA256'] as const).map((s) => (
                    <button key={s} onClick={() => setSchema(s)} className={`flex-1 py-2 rounded-lg text-[12px] border ${schema === s ? 'border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]' : 'border-[var(--border)] text-[var(--fg-soft)]'}`}>
                      {s === 'EMAIL_SHA256' ? 'Email' : 'Teléfono'}
                    </button>
                  ))}
                </div>
                <textarea value={raw} onChange={(e) => setRaw(e.target.value)} rows={5}
                  placeholder={schema === 'EMAIL_SHA256' ? 'Pegá emails (uno por línea)' : 'Pegá teléfonos E.164 (uno por línea)'}
                  className="ainput resize-none" />
                <p className="text-[11px] text-[var(--success)] flex items-center gap-1.5"><Sparkles size={11} /> Se hashea SHA256 en tu navegador. El dato crudo nunca sale.</p>
              </>
            )}
          </div>

          <div className="flex justify-end gap-2 mt-6">
            <button onClick={onClose} className="btn-ghost px-4 py-2">Cancelar</button>
            <button onClick={submit} disabled={saving} className="btn-gradient px-4 py-2 flex items-center gap-2">
              {saving && <Loader2 size={14} className="animate-spin" />} Crear (→ aprobación)
            </button>
          </div>
        </div>
      </div>
    );
  }

  function LookalikeModal({ account, seed, onClose, push, onDone }: { account: string; seed: Audience; onClose: () => void; push: (m: string, t: 'success'|'error') => void; onDone: () => void }) {
    const [ratio, setRatio] = useState(0.02);
    const [name, setName] = useState(`LAL ${(0.02 * 100).toFixed(0)}% · ${seed.name}`.slice(0, 60));
    const [saving, setSaving] = useState(false);

    async function submit() {
      setSaving(true);
      try {
        const r = await fetch('/api/audiences/lookalike', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ account_id: account, name, origin_audience_id: seed.id, ratio, country: 'PY' }),
        });
        const j = await r.json();
        if (!r.ok) throw new Error(j.error || 'Error');
        push('Lookalike encolado para aprobación', 'success');
        onDone();
      } catch (e) { push(e instanceof Error ? e.message : 'Error', 'error'); }
      finally { setSaving(false); }
    }

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
        <div className="card max-w-md w-full mx-4 p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center gap-2 mb-1"><TrendingUp size={16} className="text-[var(--accent)]" /><h3 className="display text-2xl">Crear Lookalike</h3></div>
          <p className="text-[12px] text-[var(--fg-muted)] mb-5">Semilla: <span className="text-[var(--fg-soft)]">{seed.name}</span></p>
          <input value={name} onChange={(e) => setName(e.target.value)} className="ainput mb-4" />
          <div className="eyebrow mb-2">Ratio (similaridad)</div>
          <div className="flex gap-1.5 mb-1">
            {[0.01, 0.02, 0.03, 0.05].map((r) => (
              <button key={r} onClick={() => { setRatio(r); setName(`LAL ${(r * 100).toFixed(0)}% · ${seed.name}`.slice(0, 60)); }}
                className={`flex-1 py-2 rounded-lg text-[13px] border ${ratio === r ? 'border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]' : 'border-[var(--border)] text-[var(--fg-soft)]'}`}>
                {(r * 100).toFixed(0)}%
              </button>
            ))}
          </div>
          <p className="text-[11px] text-[var(--fg-muted)]">1% = más parecido/menor alcance. 5% = más amplio. País: PY.</p>
          <div className="flex justify-end gap-2 mt-6">
            <button onClick={onClose} className="btn-ghost px-4 py-2">Cancelar</button>
            <button onClick={submit} disabled={saving} className="btn-gradient px-4 py-2 flex items-center gap-2">
              {saving && <Loader2 size={14} className="animate-spin" />} Crear LAL (→ aprobación)
            </button>
          </div>
        </div>
      </div>
    );
  }
}
