'use client';

import { useEffect, useRef, useState } from 'react';
import { Sidebar } from '@/components/Sidebar';
import { TopBar } from '@/components/TopBar';
import { ToastStack } from '@/components/Toast';
import { useToasts } from '@/lib/use-toasts';
import { useAccount } from '@/lib/use-account';
import { Upload, Check, ChevronRight, ChevronLeft, Rocket } from 'lucide-react';

const STEPS = ['Campaña', 'Ad Set', 'Creativo', 'Revisar'];

const OBJECTIVES = [
  { value: 'OUTCOME_LEADS', label: 'Lead Generation' },
  { value: 'OUTCOME_TRAFFIC', label: 'Traffic' },
  { value: 'OUTCOME_ENGAGEMENT', label: 'Engagement' },
  { value: 'OUTCOME_AWARENESS', label: 'Awareness' },
];

const CTA_OPTIONS = ['GET_QUOTE', 'LEARN_MORE', 'SIGN_UP', 'CONTACT_US', 'SHOP_NOW', 'BOOK_TRAVEL', 'APPLY_NOW'];

export default function NewCampaignWizard() {
  const { account, setAccount } = useAccount();
  const { toasts, push, dismiss } = useToasts();
  const [step, setStep] = useState(0);

  // Form state
  const [campaignName, setCampaignName] = useState('');
  const [objective, setObjective] = useState('OUTCOME_LEADS');

  const [adsetName, setAdsetName] = useState('');
  const [budgetAmount, setBudgetAmount] = useState('5');
  const [budgetType, setBudgetType] = useState<'daily' | 'lifetime'>('daily');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [ageMin, setAgeMin] = useState(25);
  const [ageMax, setAgeMax] = useState(54);
  const [genders, setGenders] = useState<number[]>([]);

  const [pages, setPages] = useState<Array<{ id: string; name: string }>>([]);
  const [pageId, setPageId] = useState('');
  const [forms, setForms] = useState<Array<{ id: string; name: string }>>([]);
  const [leadFormId, setLeadFormId] = useState('');

  const [adName, setAdName] = useState('');
  const [headline, setHeadline] = useState('');
  const [description, setDescription] = useState('');
  const [message, setMessage] = useState('');
  const [cta, setCta] = useState('GET_QUOTE');
  const [imageHash, setImageHash] = useState('');
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<null | { campaign_id: string; adset_id: string; ad_id: string }>(null);

  useEffect(() => {
    if (!account) return;
    fetch(`/api/pages?account_id=${account}`)
      .then((r) => r.json())
      .then((j) => {
        if (!j.error) {
          setPages(j.data || []);
          if (j.data?.[0]) setPageId(j.data[0].id);
        }
      });
  }, [account]);

  useEffect(() => {
    if (!pageId) { setForms([]); return; }
    fetch(`/api/leadgen-forms?page_id=${pageId}`)
      .then((r) => r.json())
      .then((j) => {
        if (!j.error) setForms(j.data || []);
      });
  }, [pageId]);

  async function handleFile(file: File) {
    if (!account) { push('Selecciona cuenta primero', 'error'); return; }
    setUploading(true);
    try {
      const b64 = await new Promise<string>((res, rej) => {
        const reader = new FileReader();
        reader.onload = () => res(reader.result as string);
        reader.onerror = rej;
        reader.readAsDataURL(file);
      });
      setImagePreview(b64);
      const r = await fetch('/api/media/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ account_id: account, base64: b64 }),
      });
      const j = await r.json();
      if (j.error) throw new Error(j.error);
      setImageHash(j.hash);
      push('Imagen subida OK', 'success');
    } catch (e) {
      push(e instanceof Error ? e.message : 'Error upload', 'error');
    } finally {
      setUploading(false);
    }
  }

  async function submit() {
    setSubmitting(true);
    try {
      const targeting: Record<string, unknown> = {
        age_min: ageMin,
        age_max: ageMax,
        geo_locations: { countries: ['PY'] },
        publisher_platforms: ['facebook', 'instagram'],
        facebook_positions: ['feed', 'facebook_reels', 'story'],
        instagram_positions: ['stream', 'reels', 'story'],
        device_platforms: ['mobile'],
        targeting_automation: { advantage_audience: 0 },
      };
      if (genders.length > 0) targeting.genders = genders;

      const body: Record<string, unknown> = {
        account_id: account,
        campaign_name: campaignName,
        objective,
        adset_name: adsetName,
        budget_amount: Number(budgetAmount),
        budget_type: budgetType,
        page_id: pageId,
        targeting,
        ad_name: adName,
        headline,
        description,
        message,
        image_hash: imageHash,
        call_to_action: cta,
      };
      if (objective === 'OUTCOME_LEADS' && leadFormId) body.lead_gen_form_id = leadFormId;
      if (budgetType === 'lifetime') {
        body.start_time = startTime;
        body.end_time = endTime;
      }

      const r = await fetch('/api/campaign/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const j = await r.json();
      if (!r.ok && r.status !== 202) throw new Error(j.error || 'Error');
      if (j.status === 'pending') {
        push('Campaña encolada para aprobación', 'success');
        setResult({ campaign_id: 'pending', adset_id: 'pending', ad_id: j.proposal_id });
      } else {
        setResult({ campaign_id: j.campaign_id, adset_id: j.adset_id, ad_id: j.ad_id });
        push('Campaña creada (PAUSED)', 'success');
      }
    } catch (e) {
      push(e instanceof Error ? e.message : 'Error', 'error');
    } finally {
      setSubmitting(false);
    }
  }

  const canNext = [
    () => campaignName && objective,
    () => adsetName && Number(budgetAmount) > 0 && pageId && (budgetType !== 'lifetime' || (startTime && endTime)),
    () => adName && headline && message && imageHash && (objective !== 'OUTCOME_LEADS' || leadFormId),
    () => true,
  ];

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex-1 flex flex-col">
        <TopBar selected={account} onSelect={setAccount} />
        <main className="flex-1 p-6 space-y-4 max-w-4xl">
          <div>
            <h1 className="text-2xl font-bold text-[var(--fg)]">Nueva campaña</h1>
            <p className="text-sm text-[var(--fg-muted)]">Wizard 4 pasos · Campaign → AdSet → Creativo → Revisar</p>
          </div>

          {/* Stepper */}
          <div className="bg-[var(--bg-elevated)] border border-[var(--border)] rounded p-4">
            <div className="flex items-center justify-between">
              {STEPS.map((s, i) => (
                <div key={s} className="flex items-center flex-1">
                  <div
                    className={`w-8 h-8 rounded-full grid place-items-center text-xs font-bold ${
                      i < step ? 'bg-emerald-500 text-white' : i === step ? 'bg-[var(--accent)] text-white' : 'bg-[var(--surface-2)] text-[var(--fg-muted)]'
                    }`}
                  >
                    {i < step ? <Check size={14} /> : i + 1}
                  </div>
                  <div className={`ml-2 text-sm ${i === step ? 'font-semibold text-[var(--fg)]' : 'text-[var(--fg-muted)]'}`}>{s}</div>
                  {i < STEPS.length - 1 && <div className={`flex-1 mx-3 h-0.5 ${i < step ? 'bg-emerald-500' : 'bg-[var(--surface-2)]'}`} />}
                </div>
              ))}
            </div>
          </div>

          {/* Step content */}
          {result ? (
            <div className="bg-emerald-50 border border-emerald-200 rounded p-6">
              <h2 className="text-lg font-bold text-emerald-900 mb-2">✓ Campaña creada</h2>
              <div className="space-y-1 text-sm font-mono text-emerald-800">
                <div>campaign_id: {result.campaign_id}</div>
                <div>adset_id: {result.adset_id}</div>
                <div>ad_id: {result.ad_id}</div>
              </div>
              <p className="text-sm text-emerald-700 mt-3">Estado inicial: <strong>PAUSED</strong>. Revisar en Ads Manager antes de activar.</p>
              <a href="/campaigns" className="inline-block mt-4 text-sm text-[var(--accent)] hover:underline">→ Ver campañas</a>
            </div>
          ) : (
            <div className="bg-[var(--bg-elevated)] border border-[var(--border)] rounded p-6 space-y-4">
              {step === 0 && (
                <>
                  <Field label="Nombre de campaña">
                    <input type="text" value={campaignName} onChange={(e) => setCampaignName(e.target.value)} className="input" placeholder="Ej: GWM PROMO MAYO 2026" />
                  </Field>
                  <Field label="Objetivo">
                    <select value={objective} onChange={(e) => setObjective(e.target.value)} className="input">
                      {OBJECTIVES.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  </Field>
                </>
              )}

              {step === 1 && (
                <>
                  <Field label="Nombre Ad Set">
                    <input type="text" value={adsetName} onChange={(e) => setAdsetName(e.target.value)} className="input" placeholder="Ej: HAVAL H6 ASU" />
                  </Field>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Presupuesto (USD)">
                      <input type="number" step="0.5" value={budgetAmount} onChange={(e) => setBudgetAmount(e.target.value)} className="input" />
                    </Field>
                    <Field label="Tipo">
                      <select value={budgetType} onChange={(e) => setBudgetType(e.target.value as 'daily' | 'lifetime')} className="input">
                        <option value="daily">Daily</option>
                        <option value="lifetime">Lifetime</option>
                      </select>
                    </Field>
                  </div>
                  {budgetType === 'lifetime' && (
                    <div className="grid grid-cols-2 gap-3">
                      <Field label="Inicio">
                        <input type="datetime-local" value={startTime} onChange={(e) => setStartTime(e.target.value)} className="input" />
                      </Field>
                      <Field label="Fin">
                        <input type="datetime-local" value={endTime} onChange={(e) => setEndTime(e.target.value)} className="input" />
                      </Field>
                    </div>
                  )}
                  <Field label="Página de Facebook">
                    <select value={pageId} onChange={(e) => setPageId(e.target.value)} className="input">
                      {pages.length === 0 && <option>Cargando…</option>}
                      {pages.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                  </Field>
                  <div className="grid grid-cols-3 gap-3">
                    <Field label="Edad min">
                      <input type="number" min={13} max={65} value={ageMin} onChange={(e) => setAgeMin(Number(e.target.value))} className="input" />
                    </Field>
                    <Field label="Edad max">
                      <input type="number" min={13} max={65} value={ageMax} onChange={(e) => setAgeMax(Number(e.target.value))} className="input" />
                    </Field>
                    <Field label="Género">
                      <select value={genders.join(',')} onChange={(e) => setGenders(e.target.value ? e.target.value.split(',').map(Number) : [])} className="input">
                        <option value="">Ambos</option>
                        <option value="1">Masculino</option>
                        <option value="2">Femenino</option>
                      </select>
                    </Field>
                  </div>
                </>
              )}

              {step === 2 && (
                <>
                  <Field label="Nombre del anuncio">
                    <input type="text" value={adName} onChange={(e) => setAdName(e.target.value)} className="input" />
                  </Field>
                  <Field label="Headline">
                    <input type="text" value={headline} onChange={(e) => setHeadline(e.target.value)} className="input" placeholder="Ej: HAVAL H6 desde USD 28.990" maxLength={40} />
                  </Field>
                  <Field label="Descripción (opcional)">
                    <input type="text" value={description} onChange={(e) => setDescription(e.target.value)} className="input" maxLength={90} />
                  </Field>
                  <Field label="Mensaje principal">
                    <textarea value={message} onChange={(e) => setMessage(e.target.value)} className="input min-h-[100px]" />
                  </Field>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="CTA">
                      <select value={cta} onChange={(e) => setCta(e.target.value)} className="input">
                        {CTA_OPTIONS.map((c) => <option key={c} value={c}>{c.replace(/_/g, ' ')}</option>)}
                      </select>
                    </Field>
                    {objective === 'OUTCOME_LEADS' && (
                      <Field label="Lead Form">
                        <select value={leadFormId} onChange={(e) => setLeadFormId(e.target.value)} className="input">
                          <option value="">Seleccionar…</option>
                          {forms.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
                        </select>
                      </Field>
                    )}
                  </div>
                  <Field label="Imagen del anuncio">
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => fileRef.current?.click()}
                        disabled={uploading}
                        className="flex items-center gap-2 px-3 py-2 border border-[var(--border)] rounded text-sm hover:bg-[var(--surface)]"
                      >
                        <Upload size={14} />
                        {uploading ? 'Subiendo…' : 'Subir imagen'}
                      </button>
                      <input
                        ref={fileRef}
                        type="file"
                        accept="image/jpeg,image/png"
                        className="hidden"
                        onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
                      />
                      {imageHash && <span className="text-xs text-emerald-600 font-mono">hash {imageHash.slice(0, 12)}…</span>}
                    </div>
                    {imagePreview && (
                      <div className="mt-3 inline-block">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={imagePreview} alt="preview" className="max-h-40 rounded border border-[var(--border)]" />
                      </div>
                    )}
                  </Field>
                </>
              )}

              {step === 3 && (
                <div className="space-y-3 text-sm">
                  <h3 className="font-semibold text-[var(--fg)]">Revisar antes de crear</h3>
                  <Row k="Campaña" v={campaignName} />
                  <Row k="Objetivo" v={objective} />
                  <Row k="Ad set" v={adsetName} />
                  <Row k="Budget" v={`${budgetAmount} USD ${budgetType}`} />
                  {budgetType === 'lifetime' && <Row k="Período" v={`${startTime} → ${endTime}`} />}
                  <Row k="Page" v={pages.find((p) => p.id === pageId)?.name || pageId} />
                  <Row k="Edad" v={`${ageMin}-${ageMax}`} />
                  <Row k="Géneros" v={genders.length === 0 ? 'Todos' : genders.join(',')} />
                  <Row k="Anuncio" v={adName} />
                  <Row k="Headline" v={headline} />
                  <Row k="CTA" v={cta} />
                  {leadFormId && <Row k="Lead form" v={forms.find((f) => f.id === leadFormId)?.name || leadFormId} />}
                  <Row k="Image hash" v={imageHash} />
                  <div className="bg-amber-50 border border-amber-200 rounded p-3 text-amber-900 text-xs mt-3">
                    ⚠ Creación con estado <strong>PAUSED</strong>. Activar manualmente luego de revisión.
                  </div>
                </div>
              )}
            </div>
          )}

          {!result && (
            <div className="flex justify-between">
              <button
                onClick={() => setStep((s) => Math.max(0, s - 1))}
                disabled={step === 0}
                className="flex items-center gap-1 px-3 py-2 rounded text-sm border border-[var(--border)] hover:bg-[var(--surface)] disabled:opacity-40"
              >
                <ChevronLeft size={14} /> Anterior
              </button>
              {step < STEPS.length - 1 ? (
                <button
                  onClick={() => setStep((s) => s + 1)}
                  disabled={!canNext[step]()}
                  className="flex items-center gap-1 px-4 py-2 rounded text-sm font-medium text-white bg-[var(--accent)] hover:opacity-90 disabled:opacity-40"
                >
                  Siguiente <ChevronRight size={14} />
                </button>
              ) : (
                <button
                  onClick={submit}
                  disabled={submitting}
                  className="flex items-center gap-2 px-4 py-2 rounded text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40"
                >
                  <Rocket size={14} />
                  {submitting ? 'Creando…' : 'Crear campaña (PAUSED)'}
                </button>
              )}
            </div>
          )}
        </main>
      </div>
      <ToastStack toasts={toasts} onDismiss={dismiss} />

      <style jsx global>{`
        .input { width: 100%; padding: 0.5rem 0.75rem; border: 1px solid var(--border); border-radius: 0.25rem; font-size: 0.875rem; background: white; }
        .input:focus { outline: 2px solid var(--accent); outline-offset: -2px; }
      `}</style>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-xs font-semibold uppercase tracking-wider text-[var(--fg-muted)] block mb-1">{label}</label>
      {children}
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="grid grid-cols-3 gap-2 py-1 border-b border-[var(--hairline)]">
      <div className="text-xs text-[var(--fg-muted)] uppercase tracking-wider">{k}</div>
      <div className="col-span-2 text-[var(--fg)] font-mono text-xs break-all">{v}</div>
    </div>
  );
}
