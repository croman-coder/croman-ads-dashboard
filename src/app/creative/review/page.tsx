'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Sidebar } from '@/components/Sidebar';
import { TopBar } from '@/components/TopBar';
import { ToastStack } from '@/components/Toast';
import { useToasts } from '@/lib/use-toasts';
import { useAccount } from '@/lib/use-account';
import {
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Check,
  CheckCircle2,
  Pencil,
  Rocket,
  FileText,
  X,
  Loader2,
} from 'lucide-react';

type Asset = { url: string; name: string; size: number; type: string };

type Draft = {
  brief: string;
  objective: string;
  tone: string;
  audience: string;
  budget: string;
  assets: Asset[];
  account: string;
};

type CopyVariation = {
  id: string;
  primary: string;
  headline: string;
  description: string;
  status: 'pending' | 'approved' | 'edited';
};

// Stub generator — template-based. Future: replace with Gemini/Nanobanana call.
function generateVariations(draft: Draft): CopyVariation[] {
  const briefShort = draft.brief.slice(0, 120).trim();
  const toneLower = (draft.tone || 'profesional').toLowerCase();

  const hookByTone: Record<string, string[]> = {
    profesional: ['Descubrí', 'Conocé', 'Te presentamos', 'Innovación que', 'La solución'],
    cercano: ['¿Sabías que…', 'Imaginate', 'Hoy te traemos', '¿Y si te decimos…', 'Te va a encantar'],
    urgente: ['🔥 Solo hoy:', '⏰ Última oportunidad —', '¡No te lo pierdas!', '🚨 Quedan pocos', 'Aprovechá ya'],
    aspiracional: ['Viví la experiencia', 'Hacé realidad', 'Reinventá tu', 'Llegó el momento de', 'Animate a'],
    educativo: ['¿Cómo elegir', 'Te explicamos', 'Lo que necesitás saber', 'Guía rápida:', 'Aprendé a'],
    promocional: ['💥 OFERTA:', '¡Promo activa!', 'Descuento exclusivo —', 'Promo limitada:', '🎉 Lanzamiento'],
  };

  const ctaByObjective: Record<string, string> = {
    LEAD_GENERATION: 'Dejá tus datos para más info',
    MESSAGES: 'Escribinos por WhatsApp',
    TRAFFIC: 'Conocé más en nuestro sitio',
    CONVERSIONS: 'Comprá ahora',
  };
  const cta = ctaByObjective[draft.objective] || 'Más info';

  const headlineSuffix = ['Hoy', 'Disponible', 'En tu zona', 'Sin esperas', 'Probalo'];
  const desc = [
    'Envío gratis para la primera consulta.',
    'Atención personalizada en menos de 24 h.',
    'Stock limitado — consultá disponibilidad.',
    'Asesoramiento sin compromiso.',
    'Financiación a tu medida.',
  ];

  const hooks = hookByTone[toneLower] || hookByTone.profesional;

  return hooks.map((h, i) => ({
    id: `v${i + 1}`,
    primary: `${h} ${briefShort} ${cta} →`,
    headline: `${(briefShort.split(/\s+/)[0] || 'Oferta')} ${headlineSuffix[i] || ''}`.trim(),
    description: desc[i] || desc[0],
    status: 'pending' as const,
  }));
}

export default function CreativeReviewPage() {
  const router = useRouter();
  const { account, setAccount } = useAccount();
  const { toasts, push, dismiss } = useToasts();

  const [draft, setDraft] = useState<Draft | null>(null);
  const [variations, setVariations] = useState<CopyVariation[]>([]);
  const [idx, setIdx] = useState(0);
  const [editing, setEditing] = useState(false);
  const [launching, setLaunching] = useState(false);

  // Editable fields when editing
  const [editPrimary, setEditPrimary] = useState('');
  const [editHeadline, setEditHeadline] = useState('');
  const [editDescription, setEditDescription] = useState('');

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const raw = localStorage.getItem('croman_ads_creative_draft');
      if (!raw) {
        push('Sin borrador activo — volvé a /creative/new', 'error');
        setTimeout(() => router.replace('/creative/new'), 800);
        return;
      }
      const d: Draft = JSON.parse(raw);
      setDraft(d);
      setVariations(generateVariations(d));
    } catch {
      push('Error al leer borrador', 'error');
    }
  }, [router, push]);

  const current = variations[idx];
  const total = variations.length;
  const approvedCount = useMemo(() => variations.filter((v) => v.status !== 'pending').length, [variations]);
  const allApproved = total > 0 && approvedCount === total;

  function startEdit() {
    if (!current) return;
    setEditPrimary(current.primary);
    setEditHeadline(current.headline);
    setEditDescription(current.description);
    setEditing(true);
  }

  function saveEdit() {
    setVariations((prev) =>
      prev.map((v, i) => (i === idx ? { ...v, primary: editPrimary, headline: editHeadline, description: editDescription, status: 'edited' } : v))
    );
    setEditing(false);
    push('Edición guardada', 'success');
  }

  function approve() {
    setVariations((prev) => prev.map((v, i) => (i === idx ? { ...v, status: v.status === 'edited' ? 'edited' : 'approved' } : v)));
    if (idx < total - 1) setIdx(idx + 1);
    else push('Todas aprobadas — lanzá la estrategia', 'success');
  }

  async function launch() {
    if (!allApproved || !draft) return;
    setLaunching(true);
    try {
      const body = {
        action: 'create_campaign',
        account_id: draft.account,
        payload: {
          name: `IA · ${(draft.brief.split('\n')[0] || 'campaña').slice(0, 40)}`,
          objective: draft.objective,
          daily_budget: Number(draft.budget) * 100 || 5000,
          targeting: { locations: ['PY'] },
          assets: draft.assets.map((a) => a.url),
          copys: variations,
          tone: draft.tone,
          audience: draft.audience,
        },
        reason: 'Generación IA aprobada manualmente',
      };
      const r = await fetch('/api/campaign/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'Error');
      if (j.status === 'pending' || j.proposal_id) {
        push('Estrategia encolada para aprobación final', 'success');
        localStorage.removeItem('croman_ads_creative_draft');
        setTimeout(() => router.push('/approvals'), 1000);
      } else {
        push('Campaña creada', 'success');
        setTimeout(() => router.push('/campaigns'), 1000);
      }
    } catch (e) {
      push(e instanceof Error ? e.message : 'Error', 'error');
    } finally {
      setLaunching(false);
    }
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex-1 flex flex-col">
        <TopBar selected={account} onSelect={setAccount} />
        <main className="flex-1 px-8 py-8 max-w-[1100px] mx-auto w-full space-y-6">
          {/* Breadcrumb */}
          <nav className="flex items-center gap-2 text-[12px] text-[var(--fg-muted)] fade-in">
            <Link href="/campaigns" className="hover:text-[var(--fg)] transition-colors">Mis estrategias</Link>
            <span className="text-[var(--fg-faint)]">/</span>
            <Link href="/creative/new" className="hover:text-[var(--fg)] transition-colors">Crear con IA</Link>
            <span className="text-[var(--fg-faint)]">/</span>
            <span className="text-[var(--fg-soft)]">Generar piezas</span>
            <span className="text-[var(--fg-faint)]">/</span>
            <span className="text-[var(--fg)] font-medium">Copys</span>
          </nav>

          {/* Top bar — assets strip + launch CTA */}
          <header className="flex items-center justify-between gap-4 flex-wrap fade-in">
            <div className="flex items-center gap-2">
              {draft?.assets?.slice(0, 6).map((a) => (
                <div key={a.url} className="w-12 h-12 rounded border border-[var(--hairline)] bg-[var(--bg-elevated-2)] overflow-hidden shrink-0">
                  {a.type.startsWith('image/') ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={a.url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-[var(--fg-faint)] text-[10px]">VIDEO</div>
                  )}
                </div>
              ))}
              {draft?.assets && draft.assets.length > 6 && (
                <div className="w-12 h-12 rounded border border-[var(--hairline)] bg-[var(--surface-2)] flex items-center justify-center text-[12px] font-semibold text-[var(--fg-soft)]">
                  +{draft.assets.length - 6}
                </div>
              )}
            </div>
            <button
              onClick={launch}
              disabled={!allApproved || launching}
              className="btn-gradient px-5 py-2.5 flex items-center gap-2"
            >
              {launching ? <Loader2 size={14} className="animate-spin" /> : <Rocket size={14} />}
              Lanzar estrategia
            </button>
          </header>

          {/* Progress dots */}
          <section className="flex flex-col items-center gap-3 pt-4">
            <div className="flex items-center gap-2">
              {variations.map((v, i) => {
                const isCurrent = i === idx;
                const done = v.status !== 'pending';
                return (
                  <button
                    key={v.id}
                    onClick={() => { setIdx(i); setEditing(false); }}
                    className={`w-9 h-9 rounded border flex items-center justify-center transition-all ${
                      isCurrent
                        ? 'border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]'
                        : done
                        ? 'border-[var(--success)] bg-[var(--success)]/10 text-[var(--success)]'
                        : 'border-[var(--border)] bg-[var(--bg-elevated)] text-[var(--fg-muted)]'
                    }`}
                    aria-label={`Variación ${i + 1}`}
                  >
                    {done ? <Check size={14} strokeWidth={2.5} /> : <FileText size={13} />}
                  </button>
                );
              })}
            </div>
            <p className="text-[12px] text-[var(--fg-muted)]">
              Debes aprobar <span className="text-[var(--fg)] font-semibold">{total - approvedCount}</span> variaciones de copys
            </p>
          </section>

          {/* Heading */}
          <div className="text-center fade-in pt-4">
            <p className="eyebrow flex items-center justify-center gap-1.5 mb-3">
              <Sparkles size={11} className="text-[var(--accent)]" />
              Generado con IA
            </p>
            <h1 className="display text-5xl">Aprueba o edita los copys</h1>
            <p className="text-sm text-[var(--fg-muted)] mt-3">Con eso dejamos tu campaña lista para lanzar.</p>
          </div>

          {/* Copy card with arrows */}
          <section className="grid grid-cols-[44px_1fr_44px] gap-4 items-center pt-4">
            <button
              onClick={() => { setIdx((i) => Math.max(0, i - 1)); setEditing(false); }}
              disabled={idx === 0}
              className="btn-ghost w-11 h-11 flex items-center justify-center rounded-full disabled:opacity-30"
              aria-label="Anterior"
            >
              <ChevronLeft size={16} />
            </button>

            <div className="card p-6 min-h-[260px] flex flex-col">
              {!current ? (
                <div className="text-center text-[var(--fg-muted)] py-12">Generando variaciones…</div>
              ) : (
                <>
                  {/* Status pill */}
                  <div className="flex items-center justify-between mb-5">
                    {current.status === 'pending' && (
                      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 text-[10px] uppercase tracking-[0.12em] font-bold border border-[var(--border)] bg-[var(--surface)] text-[var(--fg-muted)] rounded">
                        Pendiente
                      </span>
                    )}
                    {current.status === 'approved' && (
                      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 text-[10px] uppercase tracking-[0.12em] font-bold border border-[oklch(0.58_0.20_152_/_0.45)] bg-[oklch(0.58_0.20_152_/_0.10)] text-[var(--success)] rounded">
                        <CheckCircle2 size={10} /> Aprobado
                      </span>
                    )}
                    {current.status === 'edited' && (
                      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 text-[10px] uppercase tracking-[0.12em] font-bold border border-[oklch(0.66_0.22_252_/_0.45)] bg-[var(--accent-soft)] text-[var(--accent)] rounded">
                        <Pencil size={10} /> Editado · aprobado
                      </span>
                    )}
                    <span className="text-[10px] text-[var(--fg-faint)] font-[family-name:var(--font-mono)]">
                      {idx + 1} / {total}
                    </span>
                  </div>

                  {/* Body */}
                  {editing ? (
                    <div className="space-y-4 flex-1">
                      <div>
                        <div className="eyebrow mb-1.5">Texto principal</div>
                        <textarea
                          value={editPrimary}
                          onChange={(e) => setEditPrimary(e.target.value)}
                          rows={4}
                          className="w-full bg-[var(--bg-deep)] border border-[var(--hairline)] rounded px-3 py-2 text-[14px] text-[var(--fg)] focus:outline-none focus:border-[var(--accent)] resize-none"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <div className="eyebrow mb-1.5">Titular</div>
                          <input
                            value={editHeadline}
                            onChange={(e) => setEditHeadline(e.target.value)}
                            className="w-full bg-[var(--bg-deep)] border border-[var(--hairline)] rounded px-3 py-2 text-[13px] text-[var(--fg)] focus:outline-none focus:border-[var(--accent)]"
                          />
                        </div>
                        <div>
                          <div className="eyebrow mb-1.5">Descripción</div>
                          <input
                            value={editDescription}
                            onChange={(e) => setEditDescription(e.target.value)}
                            className="w-full bg-[var(--bg-deep)] border border-[var(--hairline)] rounded px-3 py-2 text-[13px] text-[var(--fg)] focus:outline-none focus:border-[var(--accent)]"
                          />
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4 flex-1">
                      <p className="text-[15px] text-[var(--fg)] leading-relaxed font-[family-name:var(--font-display)]" style={{ fontVariationSettings: "'opsz' 96, 'SOFT' 30" }}>
                        {current.primary}
                      </p>
                      <div className="pt-3 border-t border-[var(--hairline)]">
                        <div className="text-[15px] text-[var(--fg)] font-semibold">{current.headline}</div>
                        <div className="text-[13px] text-[var(--fg-muted)] mt-0.5">{current.description}</div>
                      </div>
                    </div>
                  )}

                  {/* Footer actions */}
                  <div className="flex items-center justify-between mt-6 pt-4 border-t border-[var(--hairline)]">
                    <div className="w-8 h-8 rounded-full border border-[var(--border)] flex items-center justify-center text-[12px] font-semibold text-[var(--fg-soft)]">
                      {idx + 1}
                    </div>
                    {editing ? (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setEditing(false)}
                          className="btn-ghost px-4 py-2 flex items-center gap-1.5"
                        >
                          <X size={13} /> Cancelar
                        </button>
                        <button
                          onClick={saveEdit}
                          className="btn-primary px-4 py-2 flex items-center gap-1.5"
                        >
                          <Check size={13} /> Guardar y aprobar
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={startEdit}
                          className="text-[11px] uppercase tracking-[0.14em] font-semibold text-[var(--fg-muted)] hover:text-[var(--fg)] transition-colors flex items-center gap-1.5 px-3"
                        >
                          <Pencil size={12} /> Editar
                        </button>
                        <button
                          onClick={approve}
                          className="btn-primary px-4 py-2 flex items-center gap-1.5 text-[13px]"
                          style={{ background: 'oklch(0.58 0.20 152)', borderColor: 'oklch(0.58 0.20 152)' }}
                        >
                          <CheckCircle2 size={14} /> {current.status !== 'pending' ? 'Aprobado' : 'Aprobar'}
                        </button>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>

            <button
              onClick={() => { setIdx((i) => Math.min(total - 1, i + 1)); setEditing(false); }}
              disabled={idx >= total - 1}
              className="btn-ghost w-11 h-11 flex items-center justify-center rounded-full disabled:opacity-30"
              aria-label="Siguiente"
            >
              <ChevronRight size={16} />
            </button>
          </section>

          {/* Bottom hint */}
          <p className="text-center text-[11px] text-[var(--fg-faint)] pt-4">
            La estrategia se encola en <span className="text-[var(--accent)]">/approvals</span> al lanzarse. Nada llega a Meta sin tu confirmación final.
          </p>
        </main>
      </div>
      <ToastStack toasts={toasts} onDismiss={dismiss} />
    </div>
  );
}
