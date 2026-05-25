'use client';

import { useCallback, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Sidebar } from '@/components/Sidebar';
import { TopBar } from '@/components/TopBar';
import { ToastStack } from '@/components/Toast';
import { useToasts } from '@/lib/use-toasts';
import { useAccount } from '@/lib/use-account';
import { Sparkles, Upload, X, FileImage, FileVideo, Loader2, Wand2 } from 'lucide-react';

type Asset = { url: string; name: string; size: number; type: string };

const OBJECTIVES = [
  { id: 'LEAD_GENERATION', label: 'Captación de leads', hint: 'Formulario nativo Meta' },
  { id: 'MESSAGES', label: 'Mensajes / Chat', hint: 'Conversación WhatsApp/Messenger' },
  { id: 'TRAFFIC', label: 'Tráfico al sitio', hint: 'Click hacia landing' },
  { id: 'CONVERSIONS', label: 'Conversiones', hint: 'Compra / registro on-site' },
];

const TONES = ['Profesional', 'Cercano', 'Urgente', 'Aspiracional', 'Educativo', 'Promocional'];

export default function NewCreativePage() {
  const router = useRouter();
  const { account, setAccount } = useAccount();
  const { toasts, push, dismiss } = useToasts();

  const [brief, setBrief] = useState('');
  const [objective, setObjective] = useState('LEAD_GENERATION');
  const [tone, setTone] = useState('Profesional');
  const [audience, setAudience] = useState('');
  const [budget, setBudget] = useState('');
  const [assets, setAssets] = useState<Asset[]>([]);
  const [uploading, setUploading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFiles = useCallback(
    async (files: FileList | File[]) => {
      const arr = Array.from(files);
      if (!arr.length) return;
      setUploading(true);
      try {
        const fd = new FormData();
        arr.forEach((f) => fd.append('files', f));
        const r = await fetch('/api/uploads', { method: 'POST', body: fd });
        const j = await r.json();
        if (!r.ok) throw new Error(j.error || 'Error subiendo archivos');
        if (j.errors?.length) j.errors.forEach((e: string) => push(e, 'error'));
        if (j.uploaded?.length) {
          setAssets((prev) => [...prev, ...j.uploaded]);
          push(`${j.uploaded.length} archivo(s) subido(s)`, 'success');
        }
      } catch (e) {
        push(e instanceof Error ? e.message : 'Error', 'error');
      } finally {
        setUploading(false);
      }
    },
    [push]
  );

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files?.length) handleFiles(e.dataTransfer.files);
  };

  const removeAsset = (url: string) => setAssets((prev) => prev.filter((a) => a.url !== url));

  const generate = async () => {
    if (!brief.trim()) {
      push('Describí qué tipo de pauta querés', 'error');
      return;
    }
    if (assets.length === 0) {
      push('Subí al menos un material', 'error');
      return;
    }
    setGenerating(true);
    // Persist draft to localStorage and route to review page where the
    // copy approval flow generates 5 variations (stub for now; future:
    // Gemini/Nanobanana). Nothing hits Meta until user launches from review.
    try {
      const draft = { brief, objective, tone, audience, budget, assets, account };
      localStorage.setItem('croman_ads_creative_draft', JSON.stringify(draft));
      router.push('/creative/review');
    } catch {
      setGenerating(false);
      push('No se pudo guardar el borrador', 'error');
    }
  };

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex-1 flex flex-col">
        <TopBar selected={account} onSelect={setAccount} />
        <main className="flex-1 px-8 py-8 max-w-[1400px] mx-auto w-full space-y-8">
          <header className="fade-in">
            <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.16em] text-[var(--fg-muted)] mb-2">
              <Sparkles size={12} className="text-[var(--accent)]" />
              Crear con IA
            </div>
            <h1 className="display text-5xl text-[var(--fg)]">Nuevo creativo</h1>
            <p className="text-sm text-[var(--fg-muted)] mt-3 max-w-2xl">
              Describí en lenguaje natural qué pauta querés. Adjuntá fotos o videos como referencia. La IA arma headline,
              copy y selección de materiales. Todo entra al flujo de aprobación antes de publicar en Meta.
            </p>
          </header>

          <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6 stagger">
            {/* LEFT — brief + uploads */}
            <div className="space-y-6">
              {/* Brief */}
              <section className="card p-6">
                <label className="block">
                  <div className="text-[10px] uppercase tracking-[0.16em] text-[var(--fg-muted)] mb-2 flex items-center gap-2">
                    <Wand2 size={11} className="text-[var(--accent)]" />
                    Brief en lenguaje natural
                  </div>
                  <textarea
                    value={brief}
                    onChange={(e) => setBrief(e.target.value)}
                    rows={6}
                    placeholder="Ej: Promoción Mitsubishi Outlander 2026 para familias en Asunción. Resaltar financiación 0% y SUV 7 plazas. Tono cercano, urgencia moderada. Llamado: agendar prueba de manejo."
                    className="w-full bg-[var(--bg-deep)] border border-[var(--hairline)] rounded-md px-4 py-3 text-[15px] text-[var(--fg)] placeholder:text-[var(--fg-faint)] focus:outline-none focus:border-[var(--accent)] resize-none font-[family-name:var(--font-serif)] leading-relaxed"
                  />
                  <div className="mt-2 text-[11px] text-[var(--fg-faint)] flex justify-between">
                    <span>{brief.length} caracteres</span>
                    <span>Mínimo 40 recomendado</span>
                  </div>
                </label>
              </section>

              {/* Uploads */}
              <section className="card p-6">
                <div className="flex items-baseline justify-between mb-4">
                  <h2 className="display text-2xl text-[var(--fg)]">Materiales</h2>
                  <span className="text-[10px] uppercase tracking-[0.16em] text-[var(--fg-muted)]">
                    {assets.length} archivos
                  </span>
                </div>

                <div
                  onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={onDrop}
                  onClick={() => inputRef.current?.click()}
                  className={`border-2 border-dashed rounded-md px-6 py-12 cursor-pointer text-center transition-colors ${
                    dragOver
                      ? 'border-[var(--accent)] bg-[var(--accent-soft)]'
                      : 'border-[var(--border)] hover:border-[var(--border-strong)] hover:bg-[var(--surface)]'
                  }`}
                >
                  <input
                    ref={inputRef}
                    type="file"
                    multiple
                    accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/quicktime,video/webm"
                    onChange={(e) => e.target.files && handleFiles(e.target.files)}
                    className="hidden"
                  />
                  {uploading ? (
                    <div className="flex flex-col items-center gap-2 text-[var(--fg-soft)]">
                      <Loader2 size={28} className="animate-spin text-[var(--accent)]" />
                      <span className="text-sm">Subiendo a Vercel Blob…</span>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-2 text-[var(--fg-soft)]">
                      <Upload size={28} className="text-[var(--accent)]" />
                      <span className="text-sm font-medium">Arrastrá archivos o click para elegir</span>
                      <span className="text-[11px] text-[var(--fg-muted)]">
                        JPG · PNG · WEBP · MP4 · MOV · WEBM — máx 50 MB c/u
                      </span>
                    </div>
                  )}
                </div>

                {assets.length > 0 && (
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 mt-5">
                    {assets.map((a) => {
                      const isVideo = a.type.startsWith('video/');
                      return (
                        <div key={a.url} className="group relative rounded-md overflow-hidden border border-[var(--hairline)] bg-[var(--bg-deep)] aspect-square">
                          {isVideo ? (
                            <div className="w-full h-full flex flex-col items-center justify-center gap-2 text-[var(--fg-muted)]">
                              <FileVideo size={28} />
                              <span className="text-[10px] font-[family-name:var(--font-mono)] px-2 text-center truncate w-full">{a.name}</span>
                            </div>
                          ) : (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={a.url} alt={a.name} className="w-full h-full object-cover" />
                          )}
                          <button
                            onClick={() => removeAsset(a.url)}
                            className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-black/70 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                            aria-label="Quitar"
                          >
                            <X size={12} />
                          </button>
                          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent px-2 py-1.5 text-[10px] text-white truncate flex items-center gap-1">
                            {isVideo ? <FileVideo size={10} /> : <FileImage size={10} />}
                            {(a.size / 1024 / 1024).toFixed(1)} MB
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>
            </div>

            {/* RIGHT — config + generate */}
            <aside className="space-y-6">
              <section className="card p-6 space-y-5">
                <h2 className="display text-2xl text-[var(--fg)]">Configuración</h2>

                {/* Objective */}
                <div>
                  <div className="text-[10px] uppercase tracking-[0.16em] text-[var(--fg-muted)] mb-2">Objetivo</div>
                  <div className="space-y-1.5">
                    {OBJECTIVES.map((o) => (
                      <label
                        key={o.id}
                        className={`flex items-start gap-3 px-3 py-2.5 rounded-md cursor-pointer border transition-colors ${
                          objective === o.id
                            ? 'border-[var(--accent)] bg-[var(--accent-soft)]'
                            : 'border-[var(--hairline)] hover:border-[var(--border-strong)]'
                        }`}
                      >
                        <input
                          type="radio"
                          name="objective"
                          checked={objective === o.id}
                          onChange={() => setObjective(o.id)}
                          className="mt-1 accent-[var(--accent)]"
                        />
                        <div className="flex-1">
                          <div className="text-sm text-[var(--fg)] font-medium">{o.label}</div>
                          <div className="text-[11px] text-[var(--fg-muted)]">{o.hint}</div>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Tone */}
                <div>
                  <div className="text-[10px] uppercase tracking-[0.16em] text-[var(--fg-muted)] mb-2">Tono</div>
                  <div className="flex flex-wrap gap-1.5">
                    {TONES.map((t) => (
                      <button
                        key={t}
                        onClick={() => setTone(t)}
                        className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                          tone === t
                            ? 'border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--fg)]'
                            : 'border-[var(--hairline)] text-[var(--fg-soft)] hover:border-[var(--border-strong)]'
                        }`}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Audience */}
                <label className="block">
                  <div className="text-[10px] uppercase tracking-[0.16em] text-[var(--fg-muted)] mb-2">Audiencia (opcional)</div>
                  <input
                    type="text"
                    value={audience}
                    onChange={(e) => setAudience(e.target.value)}
                    placeholder="Hombres 25–55, Asunción +50km"
                    className="w-full bg-[var(--bg-deep)] border border-[var(--hairline)] rounded-md px-3 py-2 text-sm text-[var(--fg)] placeholder:text-[var(--fg-faint)] focus:outline-none focus:border-[var(--accent)]"
                  />
                </label>

                {/* Budget */}
                <label className="block">
                  <div className="text-[10px] uppercase tracking-[0.16em] text-[var(--fg-muted)] mb-2">Presupuesto diario USD</div>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--fg-muted)] text-sm">$</span>
                    <input
                      type="number"
                      value={budget}
                      onChange={(e) => setBudget(e.target.value)}
                      placeholder="50"
                      min={1}
                      max={1000}
                      className="w-full bg-[var(--bg-deep)] border border-[var(--hairline)] rounded-md pl-7 pr-3 py-2 text-sm text-[var(--fg)] font-[family-name:var(--font-mono)] focus:outline-none focus:border-[var(--accent)]"
                    />
                  </div>
                  <div className="text-[10px] text-[var(--fg-faint)] mt-1.5">Tope máximo: USD 1000 · requiere aprobación</div>
                </label>
              </section>

              <button
                onClick={generate}
                disabled={generating || !brief.trim() || assets.length === 0}
                className="btn-primary w-full px-5 py-3.5 rounded-md flex items-center justify-center gap-2 text-sm disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {generating ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Generando borrador…
                  </>
                ) : (
                  <>
                    <Sparkles size={16} />
                    Generar pauta con IA
                  </>
                )}
              </button>

              <p className="text-[11px] text-[var(--fg-faint)] leading-relaxed px-1">
                El borrador se guarda como propuesta y debe ser aprobado en <span className="text-[var(--accent)]">/approvals</span> antes
                de publicarse en Meta. Nada llega a producción sin tu confirmación.
              </p>
            </aside>
          </div>
        </main>
      </div>
      <ToastStack toasts={toasts} onDismiss={dismiss} />
    </div>
  );
}
