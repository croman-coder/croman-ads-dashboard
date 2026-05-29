'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Sidebar } from '@/components/Sidebar';
import { TopBar } from '@/components/TopBar';
import { useAccount } from '@/lib/use-account';
import { ToastStack } from '@/components/Toast';
import { useToasts } from '@/lib/use-toasts';
import { CheckCircle2, Clock, Lock, ArrowRight, ArrowLeft, Loader2, Plug, Building2, Sparkles, Package, Briefcase, Boxes, ChevronRight } from 'lucide-react';

type Profile = {
  account_id: string;
  business_desc?: string;
  products?: string;
  audience?: string;
  tone?: string;
  geo?: string;
  onboarding_step?: number;
};

const TONES = ['Profesional', 'Cercano', 'Aspiracional', 'Urgente', 'Educativo'];

const OFFERS = [
  { id: 'productos', icon: Package, title: 'Productos', desc: 'Cosas que la gente compra: autos, repuestos, accesorios…' },
  { id: 'servicios', icon: Briefcase, title: 'Servicios', desc: 'Cosas que la gente contrata: post-venta, financiación, seguros…' },
  { id: 'ambos', icon: Boxes, title: 'Ambos', desc: 'Vendés productos y también ofrecés servicios.' },
] as const;

export default function OnboardingPage() {
  const router = useRouter();
  const { account, setAccount } = useAccount();
  const { toasts, push, dismiss } = useToasts();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [wizStep, setWizStep] = useState(0); // 0 offer, 1 detalle, 2 público, 3 tono
  const [offer, setOffer] = useState<string>('');
  const [form, setForm] = useState({ business_desc: '', products: '', audience: '', tone: 'Profesional', geo: 'Paraguay · Central + Asunción' });

  const load = useCallback(async () => {
    if (!account) return;
    setLoading(true);
    try {
      const r = await fetch(`/api/business-profile/${account}`);
      const j = await r.json();
      setProfile(j.profile);
      if (j.profile) {
        setForm({
          business_desc: j.profile.business_desc || '',
          products: j.profile.products || '',
          audience: j.profile.audience || '',
          tone: j.profile.tone || 'Profesional',
          geo: j.profile.geo || 'Paraguay · Central + Asunción',
        });
      }
    } finally {
      setLoading(false);
    }
  }, [account]);

  useEffect(() => { load(); }, [load]);

  const businessDone = !!(profile?.business_desc && profile?.audience);

  async function saveBusiness() {
    if (!form.business_desc.trim() || !form.audience.trim()) {
      push('Completá descripción y público', 'error');
      return;
    }
    setSaving(true);
    try {
      const r = await fetch(`/api/business-profile/${account}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, onboarding_step: 3 }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'Error');
      push('Negocio configurado', 'success');
      setEditing(false);
      load();
    } catch (e) {
      push(e instanceof Error ? e.message : 'Error', 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex-1 flex flex-col">
        <TopBar selected={account} onSelect={setAccount} />
        <main className="flex-1 px-8 py-10 max-w-[920px] mx-auto w-full space-y-8">
          <header className="text-center fade-in">
            <p className="eyebrow mb-2">Primeros pasos</p>
            <h1 className="display text-5xl">Configura tu cuenta.</h1>
            <p className="text-sm text-[var(--fg-muted)] mt-3">Completá estos pasos para empezar a crear anuncios optimizados.</p>
          </header>

          {loading ? (
            <div className="space-y-4">{[0, 1, 2].map((i) => <div key={i} className="card h-28 animate-pulse" />)}</div>
          ) : (
            <div className="space-y-4 stagger">
              {/* Step 1 — Integration */}
              <div className="card p-6 flex items-center gap-4">
                <CheckCircle2 size={28} className="text-[var(--success)] shrink-0" />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <Plug size={14} className="text-[var(--accent)]" />
                    <h2 className="text-lg font-semibold text-[var(--fg)]">Integración lista</h2>
                  </div>
                  <p className="text-[13px] text-[var(--fg-muted)] mt-1">Meta conectado vía System User token. Cuentas y permisos sincronizados.</p>
                </div>
                <button onClick={() => router.push('/integrations')} className="btn-glass px-4 py-2">Ver</button>
              </div>

              {/* Step 2 — Business */}
              <div className={`card p-6 ${businessDone ? '' : 'ring-1 ring-[var(--accent)]/40'}`}>
                <div className="flex items-center gap-4">
                  {businessDone ? (
                    <CheckCircle2 size={28} className="text-[var(--success)] shrink-0" />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-[var(--accent)] text-white flex items-center justify-center text-sm font-bold shrink-0">2</div>
                  )}
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <Building2 size={14} className="text-[var(--accent)]" />
                      <h2 className="text-lg font-semibold text-[var(--fg)]">Configura tu negocio</h2>
                      <span className="text-[10px] text-[var(--fg-muted)] flex items-center gap-1"><Clock size={10} /> ~3min</span>
                    </div>
                    <p className="text-[13px] text-[var(--fg-muted)] mt-1">Contanos qué vende esta cuenta y a quién. La IA usa esto al generar pautas.</p>
                  </div>
                  <button onClick={() => { setWizStep(0); setEditing((v) => !v); }} className={businessDone ? 'btn-glass px-4 py-2' : 'btn-gradient px-4 py-2'}>
                    {businessDone ? 'Editar' : 'Continuar'}
                  </button>
                </div>

                {editing && (
                  <div className="mt-5 pt-5 border-t border-[var(--hairline)] fade-in">
                    {/* Wizard progress dots */}
                    <div className="flex items-center gap-1.5 mb-6">
                      {[0, 1, 2, 3].map((i) => (
                        <div key={i} className={`h-1 flex-1 rounded-full transition-colors ${i <= wizStep ? 'bg-[var(--accent)]' : 'bg-[var(--border)]'}`} />
                      ))}
                    </div>

                    {/* Step 0 — ¿Qué ofreces? */}
                    {wizStep === 0 && (
                      <div className="space-y-3 fade-in">
                        <div className="text-center mb-5">
                          <h3 className="display text-3xl">¿Qué ofreces?</h3>
                          <p className="text-[13px] text-[var(--fg-muted)] mt-1">Elegí lo que vende esta cuenta para armar mejor las campañas.</p>
                        </div>
                        {OFFERS.map((o) => {
                          const Icon = o.icon;
                          const sel = offer === o.id;
                          return (
                            <button key={o.id} onClick={() => { setOffer(o.id); setWizStep(1); }}
                              className={`w-full text-left flex items-center gap-4 p-4 rounded-xl border transition-all lift ${sel ? 'border-[var(--accent)] bg-[var(--accent-soft)]' : 'border-[var(--border)] hover:border-[var(--border-strong)]'}`}>
                              <div className="w-11 h-11 rounded-lg glass flex items-center justify-center shrink-0">
                                <Icon size={20} className="text-[var(--accent)]" />
                              </div>
                              <div className="flex-1">
                                <div className="text-[15px] font-semibold text-[var(--fg)]">{o.title}</div>
                                <div className="text-[12px] text-[var(--fg-muted)]">{o.desc}</div>
                              </div>
                              <ChevronRight size={16} className="text-[var(--fg-muted)]" />
                            </button>
                          );
                        })}
                      </div>
                    )}

                    {/* Step 1 — Detalle */}
                    {wizStep === 1 && (
                      <div className="space-y-4 fade-in">
                        <div className="text-center mb-4">
                          <h3 className="display text-3xl">Contanos más.</h3>
                          <p className="text-[13px] text-[var(--fg-muted)] mt-1">Describí el negocio y los productos/servicios clave.</p>
                        </div>
                        <Field label="¿Qué vende esta cuenta?">
                          <textarea value={form.business_desc} onChange={(e) => setForm({ ...form, business_desc: e.target.value })} rows={2}
                            placeholder="Ej: Concesionaria oficial Mitsubishi — SUVs, camionetas L200, financiación en USD"
                            className="input resize-none" />
                        </Field>
                        <div className="grid grid-cols-2 gap-4">
                          <Field label="Productos / modelos clave">
                            <input value={form.products} onChange={(e) => setForm({ ...form, products: e.target.value })}
                              placeholder="L200, Outlander, Eclipse Cross" className="input" />
                          </Field>
                          <Field label="Geo objetivo">
                            <input value={form.geo} onChange={(e) => setForm({ ...form, geo: e.target.value })} className="input" />
                          </Field>
                        </div>
                        <WizNav onBack={() => setWizStep(0)} onNext={() => setWizStep(2)} nextDisabled={!form.business_desc.trim()} />
                      </div>
                    )}

                    {/* Step 2 — Público */}
                    {wizStep === 2 && (
                      <div className="space-y-4 fade-in">
                        <div className="text-center mb-4">
                          <h3 className="display text-3xl">¿A quién le vendés?</h3>
                          <p className="text-[13px] text-[var(--fg-muted)] mt-1">Definí el público objetivo. Intelligence lo refina con datos reales.</p>
                        </div>
                        <Field label="Público objetivo">
                          <input value={form.audience} onChange={(e) => setForm({ ...form, audience: e.target.value })}
                            placeholder="Hombres 30-55, agro/comercio, interés 4x4 + financiación" className="input" />
                        </Field>
                        <WizNav onBack={() => setWizStep(1)} onNext={() => setWizStep(3)} nextDisabled={!form.audience.trim()} />
                      </div>
                    )}

                    {/* Step 3 — Tono + guardar */}
                    {wizStep === 3 && (
                      <div className="space-y-4 fade-in">
                        <div className="text-center mb-4">
                          <h3 className="display text-3xl">Tono de marca.</h3>
                          <p className="text-[13px] text-[var(--fg-muted)] mt-1">¿Cómo le hablás a tu público?</p>
                        </div>
                        <Field label="Tono de comunicación">
                          <div className="flex flex-wrap gap-1.5">
                            {TONES.map((t) => (
                              <button key={t} onClick={() => setForm({ ...form, tone: t })}
                                className={`px-3.5 py-2 rounded-full text-[13px] border transition-colors ${form.tone === t ? 'border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]' : 'border-[var(--border)] text-[var(--fg-soft)]'}`}>
                                {t}
                              </button>
                            ))}
                          </div>
                        </Field>
                        <div className="flex justify-between gap-2 pt-2">
                          <button onClick={() => setWizStep(2)} className="btn-ghost px-4 py-2 flex items-center gap-1.5"><ArrowLeft size={14} /> Atrás</button>
                          <button onClick={saveBusiness} disabled={saving} className="btn-gradient px-5 py-2 flex items-center gap-2">
                            {saving && <Loader2 size={14} className="animate-spin" />} Guardar negocio
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Step 3 — Strategy */}
              <div className={`card p-6 flex items-center gap-4 ${!businessDone ? 'opacity-60' : ''}`}>
                {businessDone ? (
                  <div className="w-8 h-8 rounded-full bg-[var(--accent)] text-white flex items-center justify-center text-sm font-bold shrink-0">3</div>
                ) : (
                  <Lock size={24} className="text-[var(--fg-faint)] shrink-0" />
                )}
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <Sparkles size={14} className="text-[var(--accent)]" />
                    <h2 className="text-lg font-semibold text-[var(--fg)]">Crea tu primera estrategia</h2>
                  </div>
                  <p className="text-[13px] text-[var(--fg-muted)] mt-1">Generá una pauta con IA usando el perfil del negocio + público recomendado.</p>
                </div>
                <button onClick={() => router.push('/creative/new')} disabled={!businessDone}
                  className="btn-gradient px-4 py-2 flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed">
                  Empezar <ArrowRight size={14} />
                </button>
              </div>
            </div>
          )}

          {/* Progress hint */}
          {!loading && (
            <p className="text-center text-[12px] text-[var(--fg-muted)]">
              {businessDone ? 'Todo listo. Creá tu primera estrategia con IA.' : `Paso ${profile?.onboarding_step || 2} de 3`}
            </p>
          )}
        </main>
      </div>
      <ToastStack toasts={toasts} onDismiss={dismiss} />
      <style jsx global>{`
        .input {
          width: 100%;
          background: var(--bg-elevated-2);
          border: 1px solid var(--border);
          border-radius: var(--radius);
          padding: 9px 12px;
          font-size: 13px;
          color: var(--fg);
        }
        .input:focus { outline: none; border-color: var(--accent); }
        .input::placeholder { color: var(--fg-faint); }
      `}</style>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="eyebrow mb-1.5">{label}</div>
      {children}
    </label>
  );
}

function WizNav({ onBack, onNext, nextDisabled }: { onBack: () => void; onNext: () => void; nextDisabled?: boolean }) {
  return (
    <div className="flex justify-between gap-2 pt-2">
      <button onClick={onBack} className="btn-ghost px-4 py-2 flex items-center gap-1.5"><ArrowLeft size={14} /> Atrás</button>
      <button onClick={onNext} disabled={nextDisabled} className="btn-gradient px-5 py-2 flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed">
        Siguiente <ArrowRight size={14} />
      </button>
    </div>
  );
}
