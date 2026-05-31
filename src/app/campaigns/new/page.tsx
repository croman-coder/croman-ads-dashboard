'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Sidebar } from '@/components/Sidebar';
import { TopBar } from '@/components/TopBar';
import { ToastStack } from '@/components/Toast';
import { useToasts } from '@/lib/use-toasts';
import { useAccount } from '@/lib/use-account';
import {
  Upload, Check, ChevronRight, ChevronLeft, Rocket, Target, Users, Sparkles,
  Radio, ImageIcon, ClipboardCheck, Loader2, Search as SearchIcon, X, TrendingUp,
} from 'lucide-react';

const STEPS = ['Objetivo', 'Audiencia', 'Pixel', 'Creativo', 'Revisar'];

const OBJECTIVES = [
  { value: 'OUTCOME_LEADS', label: 'Captación de leads', goal: 'LEAD_GENERATION', icon: Target },
  { value: 'OUTCOME_ENGAGEMENT', label: 'Mensajes / Chat', goal: 'CONVERSATIONS', icon: Users },
  { value: 'OUTCOME_TRAFFIC', label: 'Tráfico', goal: 'LINK_CLICKS', icon: TrendingUp },
  { value: 'OUTCOME_SALES', label: 'Conversiones', goal: 'OFFSITE_CONVERSIONS', icon: Sparkles },
];

const CTA_OPTIONS = ['GET_QUOTE', 'LEARN_MORE', 'SIGN_UP', 'CONTACT_US', 'SHOP_NOW', 'BOOK_TRAVEL', 'APPLY_NOW', 'WHATSAPP_MESSAGE'];
const BUDGET_CAP = 1000;

type Audience = { id: string; name: string; subtype: string };
type Interest = { id: string; name: string; audience_size?: number };
type AudMode = 'recommended' | 'custom' | 'lookalike' | 'manual';

export default function WizardV2() {
  const router = useRouter();
  const { account, setAccount } = useAccount();
  const { toasts, push, dismiss } = useToasts();
  const [step, setStep] = useState(0);

  // Step 1 — objective + budget
  const [campaignName, setCampaignName] = useState('');
  const [objective, setObjective] = useState('OUTCOME_LEADS');
  const [budgetAmount, setBudgetAmount] = useState('5');
  const [budgetType, setBudgetType] = useState<'daily' | 'lifetime'>('daily');

  // Step 2 — audience
  const [audMode, setAudMode] = useState<AudMode>('manual');
  const [ageMin, setAgeMin] = useState(25);
  const [ageMax, setAgeMax] = useState(55);
  const [genders, setGenders] = useState<number[]>([]);
  const [customAuds, setCustomAuds] = useState<Audience[]>([]);
  const [selectedAuds, setSelectedAuds] = useState<string[]>([]);
  const [recommended, setRecommended] = useState<string>('');
  const [intQuery, setIntQuery] = useState('');
  const [intResults, setIntResults] = useState<Interest[]>([]);
  const [intSelected, setIntSelected] = useState<Interest[]>([]);
  const [searching, setSearching] = useState(false);
  const [reach, setReach] = useState<{ lo?: number; hi?: number } | null>(null);
  const [reachLoading, setReachLoading] = useState(false);

  // Step 3 — pixel
  const [pixels, setPixels] = useState<Array<{ id: string; name: string }>>([]);
  const [pixelId, setPixelId] = useState('');

  // Step 4 — creative
  const [pages, setPages] = useState<Array<{ id: string; name: string }>>([]);
  const [pageId, setPageId] = useState('');
  const [adName, setAdName] = useState('');
  const [headline, setHeadline] = useState('');
  const [message, setMessage] = useState('');
  const [cta, setCta] = useState('GET_QUOTE');
  const [imageHash, setImageHash] = useState('');
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const [submitting, setSubmitting] = useState(false);

  // Load pages, pixels, custom audiences, recommended audience
  useEffect(() => {
    if (!account) return;
    fetch(`/api/pages?account_id=${account}`).then((r) => r.json()).then((j) => {
      setPages(j.data || []); if (j.data?.[0]) setPageId(j.data[0].id);
    });
    fetch(`/api/pixel/${account}`).then((r) => r.json()).then((j) => {
      const px = (j.pixels || []).map((p: { id: string; name: string }) => ({ id: p.id, name: p.name }));
      setPixels(px); if (px[0]) setPixelId(px[0].id);
    }).catch(() => {});
    fetch(`/api/audiences?account_id=${account}`).then((r) => r.json()).then((j) => {
      setCustomAuds(j.audiences || []);
    }).catch(() => {});
    fetch(`/api/audience/insights/${account}?breakdown=age,gender`).then((r) => r.json()).then((j) => {
      if (j.recommended?.[0]) setRecommended(j.recommended[0].segment);
    }).catch(() => {});
  }, [account]);

  // Build targeting spec from current state
  const buildTargeting = useCallback((): Record<string, unknown> => {
    const t: Record<string, unknown> = {
      geo_locations: { countries: ['PY'] },
      age_min: ageMin,
      age_max: ageMax,
      targeting_automation: { advantage_audience: 0 },
    };
    if (genders.length) t.genders = genders;
    if (audMode === 'custom' && selectedAuds.length) {
      t.custom_audiences = selectedAuds.map((id) => ({ id }));
    }
    if (audMode === 'lookalike' && selectedAuds.length) {
      t.custom_audiences = selectedAuds.map((id) => ({ id }));
    }
    if (audMode === 'manual' && intSelected.length) {
      t.flexible_spec = [{ interests: intSelected.map((i) => ({ id: i.id, name: i.name })) }];
    }
    return t;
  }, [ageMin, ageMax, genders, audMode, selectedAuds, intSelected]);

  // Interest search (debounced)
  useEffect(() => {
    if (audMode !== 'manual' || intQuery.trim().length < 2) { setIntResults([]); return; }
    const t = setTimeout(async () => {
      setSearching(true);
      try {
        const r = await fetch(`/api/targeting-search?q=${encodeURIComponent(intQuery)}`);
        const j = await r.json();
        setIntResults(j.interests || []);
      } finally { setSearching(false); }
    }, 350);
    return () => clearTimeout(t);
  }, [intQuery, audMode]);

  // Reach estimate when on audience step
  const fetchReach = useCallback(async () => {
    if (!account) return;
    setReachLoading(true);
    try {
      const r = await fetch('/api/reach-estimate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ account_id: account, targeting: buildTargeting(), optimization_goal: 'REACH' }),
      });
      const j = await r.json();
      if (j.estimate) setReach({ lo: j.estimate.users_lower_bound, hi: j.estimate.users_upper_bound });
    } catch { /* ignore */ }
    finally { setReachLoading(false); }
  }, [account, buildTargeting]);

  useEffect(() => { if (step === 1) fetchReach(); }, [step, fetchReach]);

  async function uploadImage(file: File) {
    setUploading(true);
    try {
      const fd = new FormData(); fd.append('files', file);
      // reuse /api/media/upload (returns image_hash) — fallback to /api/uploads
      const r = await fetch('/api/media/upload', { method: 'POST', body: fd });
      const j = await r.json();
      if (j.error) throw new Error(j.error);
      const hash = j.image_hash || j.hash || (j.uploaded?.[0]?.hash);
      if (!hash) throw new Error('Sin image_hash en respuesta');
      setImageHash(hash);
      setImagePreview(URL.createObjectURL(file));
      push('Imagen subida', 'success');
    } catch (e) { push(e instanceof Error ? e.message : 'Error subida', 'error'); }
    finally { setUploading(false); }
  }

  function toggleAud(id: string) {
    setSelectedAuds((p) => p.includes(id) ? p.filter((x) => x !== id) : [...p, id]);
  }

  function canNext(): boolean {
    if (step === 0) return !!campaignName.trim() && Number(budgetAmount) > 0 && Number(budgetAmount) <= BUDGET_CAP;
    if (step === 3) return !!pageId && !!headline.trim() && !!message.trim() && !!imageHash;
    return true;
  }

  async function submit() {
    setSubmitting(true);
    try {
      const body = {
        account_id: account,
        campaign_name: campaignName,
        objective,
        adset_name: `${campaignName} · AdSet`,
        budget_amount: Number(budgetAmount),
        budget_type: budgetType,
        page_id: pageId,
        pixel_id: pixelId || undefined,
        targeting: buildTargeting(),
        ad_name: adName || `${campaignName} · Ad`,
        headline,
        message,
        description: '',
        cta,
        image_hash: imageHash,
      };
      const r = await fetch('/api/campaign/create', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      });
      const j = await r.json();
      if (!r.ok && r.status !== 202) throw new Error(j.error || 'Error');
      if (j.status === 'pending' || j.proposal_id) {
        push('Campaña encolada para aprobación', 'success');
        setTimeout(() => router.push('/approvals'), 900);
      } else {
        push('Campaña creada', 'success');
        setTimeout(() => router.push('/campaigns'), 900);
      }
    } catch (e) { push(e instanceof Error ? e.message : 'Error', 'error'); }
    finally { setSubmitting(false); }
  }

  const objLabel = OBJECTIVES.find((o) => o.value === objective)?.label || objective;

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex-1 flex flex-col">
        <TopBar selected={account} onSelect={setAccount} />
        <main className="flex-1 px-8 py-8 max-w-[1000px] mx-auto w-full space-y-6">
          <header className="fade-in">
            <p className="eyebrow mb-1 flex items-center gap-1.5"><Rocket size={12} className="text-[var(--accent)]" /> Nueva campaña</p>
            <h1 className="display text-5xl">Wizard de pauta.</h1>
          </header>

          {/* Stepper */}
          <div className="flex items-center gap-2">
            {STEPS.map((s, i) => (
              <div key={s} className="flex items-center gap-2 flex-1">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0 transition-colors ${
                  i < step ? 'bg-[var(--success)] text-white' : i === step ? 'bg-[var(--accent)] text-white' : 'bg-[var(--bg-elevated-2)] text-[var(--fg-muted)]'
                }`}>
                  {i < step ? <Check size={13} /> : i + 1}
                </div>
                <span className={`text-[12px] font-medium ${i === step ? 'text-[var(--fg)]' : 'text-[var(--fg-muted)]'} hidden sm:inline`}>{s}</span>
                {i < STEPS.length - 1 && <div className={`h-px flex-1 ${i < step ? 'bg-[var(--success)]' : 'bg-[var(--border)]'}`} />}
              </div>
            ))}
          </div>

          <div className="card p-6 min-h-[380px]">
            {/* STEP 0 — Objetivo + presupuesto */}
            {step === 0 && (
              <div className="space-y-5 fade-in">
                <div>
                  <div className="eyebrow mb-1.5">Nombre campaña</div>
                  <input value={campaignName} onChange={(e) => setCampaignName(e.target.value)} placeholder="Ej: Leads Mitsubishi L200 Mayo" className="winput" />
                </div>
                <div>
                  <div className="eyebrow mb-2">Objetivo</div>
                  <div className="grid grid-cols-2 gap-2">
                    {OBJECTIVES.map((o) => {
                      const Icon = o.icon; const sel = objective === o.value;
                      return (
                        <button key={o.value} onClick={() => setObjective(o.value)}
                          className={`flex items-center gap-3 p-3 rounded-lg border text-left transition-all ${sel ? 'border-[var(--accent)] bg-[var(--accent-soft)]' : 'border-[var(--border)] hover:border-[var(--border-strong)]'}`}>
                          <Icon size={18} className={sel ? 'text-[var(--accent)]' : 'text-[var(--fg-muted)]'} />
                          <span className="text-[13px] font-medium text-[var(--fg)]">{o.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="eyebrow mb-1.5">Presupuesto USD (tope {BUDGET_CAP})</div>
                    <input type="number" min={1} max={BUDGET_CAP} value={budgetAmount} onChange={(e) => setBudgetAmount(e.target.value)}
                      className={`winput ${Number(budgetAmount) > BUDGET_CAP ? 'border-[var(--danger)]' : ''}`} />
                  </div>
                  <div>
                    <div className="eyebrow mb-1.5">Tipo</div>
                    <select value={budgetType} onChange={(e) => setBudgetType(e.target.value as 'daily' | 'lifetime')} className="winput">
                      <option value="daily">Diario</option>
                      <option value="lifetime">Total</option>
                    </select>
                  </div>
                </div>
              </div>
            )}

            {/* STEP 1 — Audiencia */}
            {step === 1 && (
              <div className="space-y-4 fade-in">
                <div className="flex items-center gap-1.5 flex-wrap">
                  {([['recommended', 'Recomendada'], ['custom', 'Custom/Retarget'], ['lookalike', 'Lookalike'], ['manual', 'Manual']] as Array<[AudMode, string]>).map(([m, label]) => (
                    <button key={m} onClick={() => { setAudMode(m); setSelectedAuds([]); }}
                      className={`px-3.5 py-1.5 rounded-full text-[12px] font-medium border transition-colors ${audMode === m ? 'border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]' : 'border-[var(--border)] text-[var(--fg-soft)]'}`}>
                      {label}
                    </button>
                  ))}
                </div>

                {audMode === 'recommended' && (
                  <div className="card-flat p-4">
                    {recommended ? (
                      <>
                        <div className="flex items-center gap-2 mb-1"><Sparkles size={14} className="text-[var(--accent)]" /><span className="eyebrow">Público recomendado (Intelligence)</span></div>
                        <div className="text-[15px] text-[var(--fg)] font-medium">{recommended}</div>
                        <p className="text-[12px] text-[var(--fg-muted)] mt-1">Basado en quién convierte mejor en esta cuenta. Edad/género se aplican abajo.</p>
                      </>
                    ) : <p className="text-[13px] text-[var(--fg-muted)]">Sin recomendación aún. Usá Manual o Custom.</p>}
                  </div>
                )}

                {(audMode === 'custom' || audMode === 'lookalike') && (
                  <div className="space-y-1.5 max-h-52 overflow-y-auto border border-[var(--hairline)] rounded-lg p-2">
                    {customAuds.filter((a) => audMode === 'lookalike' ? a.subtype === 'LOOKALIKE' : a.subtype !== 'LOOKALIKE').map((a) => (
                      <label key={a.id} className="flex items-center gap-2.5 px-2 py-1.5 rounded hover:bg-[var(--surface)] cursor-pointer">
                        <input type="checkbox" checked={selectedAuds.includes(a.id)} onChange={() => toggleAud(a.id)} className="accent-[var(--accent)]" />
                        <span className="text-[13px] text-[var(--fg)] flex-1">{a.name}</span>
                        <span className="text-[10px] text-[var(--fg-faint)]">{a.subtype}</span>
                      </label>
                    ))}
                    {customAuds.filter((a) => audMode === 'lookalike' ? a.subtype === 'LOOKALIKE' : a.subtype !== 'LOOKALIKE').length === 0 && (
                      <p className="p-3 text-[12px] text-[var(--fg-muted)] text-center">Sin audiencias. Creá en /audiences.</p>
                    )}
                  </div>
                )}

                {audMode === 'manual' && (
                  <div>
                    <div className="relative">
                      <SearchIcon size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--fg-muted)]" />
                      <input value={intQuery} onChange={(e) => setIntQuery(e.target.value)} placeholder="Buscar intereses (ej: odontología, 4x4, financiación)" className="winput pl-7" />
                    </div>
                    {searching && <div className="text-[11px] text-[var(--fg-muted)] mt-1">Buscando…</div>}
                    {intResults.length > 0 && (
                      <div className="mt-2 max-h-40 overflow-y-auto border border-[var(--hairline)] rounded-lg p-1.5 space-y-0.5">
                        {intResults.map((i) => (
                          <button key={i.id} onClick={() => { if (!intSelected.find((x) => x.id === i.id)) setIntSelected((p) => [...p, i]); setIntQuery(''); setIntResults([]); }}
                            className="w-full text-left px-2 py-1.5 rounded hover:bg-[var(--surface)] text-[13px] text-[var(--fg-soft)] flex items-center justify-between">
                            <span>{i.name}</span>
                            {i.audience_size != null && <span className="text-[10px] text-[var(--fg-faint)]">{(i.audience_size / 1e6).toFixed(1)}M</span>}
                          </button>
                        ))}
                      </div>
                    )}
                    {intSelected.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-3">
                        {intSelected.map((i) => (
                          <span key={i.id} className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[11px] bg-[var(--accent-soft)] text-[var(--accent)] border border-[var(--accent)]/40">
                            {i.name}
                            <button onClick={() => setIntSelected((p) => p.filter((x) => x.id !== i.id))}><X size={11} /></button>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Age/gender + reach */}
                <div className="grid grid-cols-2 gap-4 pt-3 border-t border-[var(--hairline)]">
                  <div>
                    <div className="eyebrow mb-1.5">Edad {ageMin}–{ageMax}</div>
                    <div className="flex gap-2 items-center">
                      <input type="number" min={18} max={65} value={ageMin} onChange={(e) => setAgeMin(Number(e.target.value))} className="winput" />
                      <span className="text-[var(--fg-muted)]">–</span>
                      <input type="number" min={18} max={65} value={ageMax} onChange={(e) => setAgeMax(Number(e.target.value))} className="winput" />
                    </div>
                  </div>
                  <div>
                    <div className="eyebrow mb-1.5">Género</div>
                    <div className="flex gap-1.5">
                      {[['Todos', []], ['Hombres', [1]], ['Mujeres', [2]]].map(([l, g]) => (
                        <button key={l as string} onClick={() => setGenders(g as number[])}
                          className={`flex-1 py-2 rounded-lg text-[12px] border ${JSON.stringify(genders) === JSON.stringify(g) ? 'border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]' : 'border-[var(--border)] text-[var(--fg-soft)]'}`}>
                          {l as string}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Live reach */}
                <div className="card-flat p-4 flex items-center justify-between">
                  <div className="flex items-center gap-2"><Users size={14} className="text-[var(--accent)]" /><span className="text-[12px] text-[var(--fg-soft)]">Alcance estimado</span></div>
                  {reachLoading ? <Loader2 size={14} className="animate-spin text-[var(--fg-muted)]" /> : (
                    <span className="numeric text-[15px] text-[var(--fg)]">{reach?.lo != null ? `${reach.lo.toLocaleString('es-PY')} – ${(reach.hi ?? reach.lo).toLocaleString('es-PY')}` : '—'}</span>
                  )}
                </div>
              </div>
            )}

            {/* STEP 2 — Pixel */}
            {step === 2 && (
              <div className="space-y-4 fade-in">
                <div className="flex items-center gap-2"><Radio size={16} className="text-[var(--accent)]" /><h3 className="text-lg font-semibold text-[var(--fg)]">Pixel / Conversión</h3></div>
                <p className="text-[13px] text-[var(--fg-muted)]">Optimizá entrega hacia conversiones. Pixel mide eventos; CAPI cierra ventas del CRM.</p>
                {pixels.length === 0 ? (
                  <div className="card-flat p-4 text-[13px] text-[var(--fg-muted)]">Sin pixel en esta cuenta. La campaña corre igual, pero sin tracking de conversiones. Ver /pixel.</div>
                ) : (
                  <div>
                    <div className="eyebrow mb-1.5">Pixel</div>
                    <select value={pixelId} onChange={(e) => setPixelId(e.target.value)} className="winput">
                      {pixels.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.id})</option>)}
                    </select>
                    <p className="text-[11px] text-[var(--success)] mt-2 flex items-center gap-1.5"><Check size={11} /> Eventos del pixel optimizan la entrega de la pauta.</p>
                  </div>
                )}
              </div>
            )}

            {/* STEP 3 — Creativo */}
            {step === 3 && (
              <div className="space-y-4 fade-in">
                <div>
                  <div className="eyebrow mb-1.5">Página</div>
                  <select value={pageId} onChange={(e) => setPageId(e.target.value)} className="winput">
                    {pages.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
                <div onClick={() => fileRef.current?.click()}
                  className="border-2 border-dashed border-[var(--border)] rounded-lg p-6 text-center cursor-pointer hover:border-[var(--accent)] transition-colors">
                  <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && uploadImage(e.target.files[0])} />
                  {uploading ? <Loader2 size={24} className="animate-spin mx-auto text-[var(--accent)]" /> :
                   imagePreview ? (
                     // eslint-disable-next-line @next/next/no-img-element
                     <img src={imagePreview} alt="" className="max-h-32 mx-auto rounded" />
                   ) : (
                     <div className="text-[var(--fg-muted)]"><Upload size={24} className="mx-auto mb-1.5 text-[var(--accent)]" /><span className="text-[13px]">Subí imagen del anuncio</span></div>
                   )}
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="eyebrow mb-1.5">Titular</div>
                    <input value={headline} onChange={(e) => setHeadline(e.target.value)} placeholder="Cuota desde Gs. 2.890.000" className="winput" />
                  </div>
                  <div>
                    <div className="eyebrow mb-1.5">CTA</div>
                    <select value={cta} onChange={(e) => setCta(e.target.value)} className="winput">
                      {CTA_OPTIONS.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                </div>
                <div>
                  <div className="eyebrow mb-1.5">Texto principal</div>
                  <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={3} placeholder="Financiación 0% · 7 plazas · agendá prueba de manejo" className="winput resize-none" />
                </div>
              </div>
            )}

            {/* STEP 4 — Revisar */}
            {step === 4 && (
              <div className="space-y-3 fade-in">
                <div className="flex items-center gap-2 mb-2"><ClipboardCheck size={16} className="text-[var(--accent)]" /><h3 className="text-lg font-semibold text-[var(--fg)]">Revisar antes de enviar</h3></div>
                {[
                  ['Campaña', campaignName],
                  ['Objetivo', objLabel],
                  ['Presupuesto', `${budgetAmount} USD ${budgetType === 'daily' ? '/ día' : 'total'}`],
                  ['Audiencia', audMode === 'recommended' ? `Recomendada: ${recommended || '—'}` : audMode === 'manual' ? `Manual · ${intSelected.length} intereses` : `${audMode} · ${selectedAuds.length} seleccionadas`],
                  ['Edad / Género', `${ageMin}–${ageMax} · ${genders.length === 0 ? 'Todos' : genders[0] === 1 ? 'Hombres' : 'Mujeres'}`],
                  ['Pixel', pixelId || 'sin pixel'],
                  ['Página', pages.find((p) => p.id === pageId)?.name || pageId],
                  ['Creativo', `${headline} · ${imageHash ? 'imagen ✓' : 'sin imagen'}`],
                ].map(([k, v]) => (
                  <div key={k as string} className="flex justify-between gap-3 py-2 border-b border-[var(--hairline)] text-[13px]">
                    <span className="text-[var(--fg-muted)]">{k}</span>
                    <span className="text-[var(--fg)] font-medium text-right">{v}</span>
                  </div>
                ))}
                <p className="text-[12px] text-[var(--fg-muted)] pt-2">Se encola en <span className="text-[var(--accent)]">/approvals</span>. Nada llega a Meta sin tu OK.</p>
              </div>
            )}
          </div>

          {/* Nav */}
          <div className="flex justify-between">
            <button onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0} className="btn-ghost px-4 py-2 flex items-center gap-1.5 disabled:opacity-40">
              <ChevronLeft size={14} /> Atrás
            </button>
            {step < STEPS.length - 1 ? (
              <button onClick={() => setStep((s) => s + 1)} disabled={!canNext()} className="btn-gradient px-5 py-2 flex items-center gap-1.5 disabled:opacity-40">
                Siguiente <ChevronRight size={14} />
              </button>
            ) : (
              <button onClick={submit} disabled={submitting} className="btn-gradient px-5 py-2 flex items-center gap-2">
                {submitting ? <Loader2 size={14} className="animate-spin" /> : <Rocket size={14} />} Lanzar (→ aprobación)
              </button>
            )}
          </div>
        </main>
      </div>
      <ToastStack toasts={toasts} onDismiss={dismiss} />
      <style jsx global>{`.winput{width:100%;background:var(--bg-elevated-2);border:1px solid var(--border);border-radius:var(--radius);padding:9px 12px;font-size:13px;color:var(--fg)}.winput:focus{outline:none;border-color:var(--accent)}.winput::placeholder{color:var(--fg-faint)}`}</style>
    </div>
  );
}
