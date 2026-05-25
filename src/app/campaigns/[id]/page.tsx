'use client';

import { useEffect, useState, use } from 'react';
import Link from 'next/link';
import { Sidebar } from '@/components/Sidebar';
import { TopBar } from '@/components/TopBar';
import { useAccount } from '@/lib/use-account';
import { ToastStack } from '@/components/Toast';
import { useToasts } from '@/lib/use-toasts';
import { fmt, fmtUSD, fmtInt } from '@/lib/utils';
import {
  ChevronLeft,
  Pause,
  Play,
  Megaphone,
  Layers,
  ImageIcon,
  Sparkles,
  Calendar,
  Target,
  DollarSign,
  TrendingUp,
  Eye,
  Video,
  ImageOff,
  Copy as CopyIcon,
} from 'lucide-react';

type Campaign = {
  id: string;
  name: string;
  status: string;
  effective_status: string;
  objective?: string;
  daily_budget?: string;
  lifetime_budget?: string;
  bid_strategy?: string;
  buying_type?: string;
  start_time?: string;
  stop_time?: string;
  created_time?: string;
  updated_time?: string;
  account_id?: string;
  budget_remaining?: string;
};

type AdSet = {
  id: string;
  name: string;
  status: string;
  effective_status: string;
  daily_budget?: string;
  lifetime_budget?: string;
  optimization_goal?: string;
  billing_event?: string;
};

type Ad = {
  id: string;
  name: string;
  adset_id: string;
  status: string;
  effective_status: string;
  creative?: {
    thumbnail_url?: string;
    image_url?: string;
    video_id?: string;
  };
};

type Insights = {
  spend?: string;
  impressions?: string;
  clicks?: string;
  reach?: string;
  ctr?: string;
  cpm?: string;
  frequency?: string;
  leads?: number;
  msgs?: number;
};

const TABS = ['multimedia', 'analitica', 'config'] as const;
type Tab = (typeof TABS)[number];

function previewUrl(ad: Ad): string | null {
  const c = ad.creative;
  if (!c) return null;
  return c.thumbnail_url || c.image_url || null;
}
function isVideo(ad: Ad): boolean { return !!ad.creative?.video_id; }

function statusDot(s?: string): 'success' | 'warning' | 'danger' | 'muted' {
  if (s === 'ACTIVE') return 'success';
  if (s === 'PAUSED') return 'muted';
  if (s && (s.includes('REJECTED') || s.includes('DISAPPROVED') || s.includes('ERROR'))) return 'danger';
  return 'warning';
}

function fmtDate(s?: string): string {
  if (!s) return '—';
  return new Date(s).toLocaleDateString('es-PY', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function fmtBudget(daily?: string, lifetime?: string): string {
  if (daily) return `${fmtUSD(Number(daily) / 100)} / día`;
  if (lifetime) return `${fmtUSD(Number(lifetime) / 100)} total`;
  return '—';
}

export default function CampaignDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { account, setAccount } = useAccount();
  const { toasts, push, dismiss } = useToasts();

  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [adsets, setAdsets] = useState<AdSet[]>([]);
  const [ads, setAds] = useState<Ad[]>([]);
  const [insights, setInsights] = useState<Insights | null>(null);
  const [partialErrors, setPartialErrors] = useState<Record<string, string> | null>(null);
  const [errorHint, setErrorHint] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('multimedia');
  const [acting, setActing] = useState(false);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    fetch(`/api/campaign/${id}`)
      .then(async (r) => ({ status: r.status, j: await r.json() }))
      .then(({ status, j }) => {
        if (status !== 200) {
          setError(j.error || 'Error');
          setErrorHint(j.hint || null);
          return;
        }
        setCampaign(j.campaign);
        setAdsets(j.adsets || []);
        setAds(j.ads || []);
        setInsights(j.insights);
        setPartialErrors(j.partial_errors || null);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [id]);

  async function toggleStatus() {
    if (!campaign) return;
    const next = campaign.status === 'ACTIVE' ? 'PAUSED' : 'ACTIVE';
    setActing(true);
    try {
      const r = await fetch('/api/mutation/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ object_id: campaign.id, status: next, account_id: account }),
      });
      const j = await r.json();
      if (j.error) throw new Error(j.error);
      if (j.status === 'pending') push('Activación encolada para aprobación', 'success');
      else {
        push(`Campaña ${next === 'ACTIVE' ? 'activada' : 'pausada'}`, 'success');
        setCampaign({ ...campaign, status: next, effective_status: next });
      }
    } catch (e) {
      push(e instanceof Error ? e.message : 'Error', 'error');
    } finally {
      setActing(false);
    }
  }

  function copyId(text: string) {
    navigator.clipboard.writeText(text);
    push('ID copiado', 'success');
  }

  if (loading) {
    return (
      <div className="flex min-h-screen">
        <Sidebar />
        <div className="flex-1 flex flex-col">
          <TopBar selected={account} onSelect={setAccount} />
          <main className="flex-1 px-8 py-8 max-w-[1500px] mx-auto w-full">
            <div className="card p-12 text-center text-[var(--fg-muted)]">Cargando campaña…</div>
          </main>
        </div>
      </div>
    );
  }

  if (error || !campaign) {
    return (
      <div className="flex min-h-screen">
        <Sidebar />
        <div className="flex-1 flex flex-col">
          <TopBar selected={account} onSelect={setAccount} />
          <main className="flex-1 px-8 py-8 max-w-[1100px] mx-auto w-full space-y-4">
            <nav className="flex items-center gap-2 text-[12px] text-[var(--fg-muted)]">
              <Link href="/campaigns" className="flex items-center gap-1 hover:text-[var(--fg)] transition-colors">
                <ChevronLeft size={14} /> Campañas
              </Link>
            </nav>
            <div className="card p-8">
              <h2 className="display text-3xl text-[var(--danger)] mb-2">No se pudo cargar la campaña</h2>
              <p className="text-sm text-[var(--fg-soft)] leading-relaxed">{error || 'No encontrada'}</p>
              {errorHint && (
                <p className="text-[12.5px] text-[var(--fg-muted)] mt-4 pt-4 border-t border-[var(--hairline)]">
                  💡 {errorHint}
                </p>
              )}
              <div className="mt-5 flex items-center gap-2">
                <Link href="/settings" className="btn-ghost px-4 py-2 text-sm">Ir a /settings → Meta API</Link>
                <Link href="/campaigns" className="btn-primary px-4 py-2 text-sm">Volver</Link>
              </div>
            </div>
          </main>
        </div>
      </div>
    );
  }

  const dot = statusDot(campaign.effective_status);

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex-1 flex flex-col">
        <TopBar selected={account} onSelect={setAccount} />
        <main className="flex-1 px-8 py-8 max-w-[1500px] mx-auto w-full space-y-6">
          {/* Breadcrumb */}
          <nav className="flex items-center gap-2 text-[12px] text-[var(--fg-muted)] fade-in">
            <Link href="/campaigns" className="flex items-center gap-1 hover:text-[var(--fg)] transition-colors">
              <ChevronLeft size={14} />
              Campañas
            </Link>
            <span className="text-[var(--fg-faint)]">/</span>
            <span className="text-[var(--fg)] truncate">{campaign.name}</span>
          </nav>

          {partialErrors && (
            <div className="card border-[var(--warning)]/30 bg-[var(--warning)]/10 p-4 fade-in">
              <p className="text-[13px] text-[var(--fg)] font-medium">Datos parciales</p>
              <ul className="text-[11.5px] text-[var(--fg-muted)] mt-1.5 space-y-0.5">
                {Object.entries(partialErrors).map(([k, v]) => (
                  <li key={k}>
                    <span className="font-[family-name:var(--font-mono)] text-[var(--warning)]">{k}</span>: {v.slice(0, 180)}
                  </li>
                ))}
              </ul>
              <p className="text-[11px] text-[var(--fg-faint)] mt-2">
                La campaña carga, pero algunos sub-recursos fallaron. Ver <Link href="/settings" className="text-[var(--accent)] underline">/settings → Meta API</Link> para detalle.
              </p>
            </div>
          )}

          {/* Header */}
          <header className="flex items-start justify-between gap-6 flex-wrap fade-in">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-2">
                <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 text-[10px] uppercase tracking-[0.1em] font-bold border rounded ${
                  dot === 'success' ? 'border-[oklch(0.58_0.20_152_/_0.45)] bg-[oklch(0.58_0.20_152_/_0.10)] text-[var(--success)]' :
                  dot === 'danger' ? 'border-[oklch(0.58_0.24_22_/_0.45)] bg-[oklch(0.58_0.24_22_/_0.10)] text-[var(--danger)]' :
                  dot === 'warning' ? 'border-[oklch(0.70_0.18_70_/_0.45)] bg-[oklch(0.70_0.18_70_/_0.10)] text-[var(--warning)]' :
                  'border-[var(--border)] bg-[var(--surface)] text-[var(--fg-muted)]'
                }`}>
                  <span className={`dot dot-${dot}`} />
                  {campaign.effective_status}
                </span>
                <span className="text-[11px] text-[var(--fg-muted)]">Objetivo: <span className="text-[var(--fg-soft)] font-medium">{campaign.objective || '—'}</span></span>
              </div>
              <h1 className="display text-5xl">{campaign.name}</h1>
            </div>
            <button
              onClick={toggleStatus}
              disabled={acting}
              className={campaign.status === 'ACTIVE' ? 'btn-ghost px-4 py-2 flex items-center gap-2' : 'btn-primary px-4 py-2 flex items-center gap-2'}
            >
              {campaign.status === 'ACTIVE' ? <Pause size={14} /> : <Play size={14} />}
              {campaign.status === 'ACTIVE' ? 'Pausar campaña' : 'Activar campaña'}
            </button>
          </header>

          {/* Stepper */}
          <div className="card p-1.5 flex items-center gap-1 stagger">
            <div className="flex-1 flex items-center gap-3 px-4 py-2.5 rounded bg-[var(--accent-soft)]">
              <div className="w-7 h-7 rounded-full bg-[var(--accent)] text-white flex items-center justify-center text-[11px] font-bold">1</div>
              <div>
                <div className="text-[10px] eyebrow">Estrategia</div>
                <div className="text-[13px] text-[var(--fg)] font-medium">{campaign.objective?.split('_')[0]?.toLowerCase() || 'Definida'}</div>
              </div>
            </div>
            <div className="flex-1 flex items-center gap-3 px-4 py-2.5">
              <div className="w-7 h-7 rounded-full bg-[var(--bg-elevated-2)] text-[var(--fg-soft)] flex items-center justify-center text-[11px] font-bold">{adsets.length}</div>
              <div>
                <div className="text-[10px] eyebrow">Conjuntos</div>
                <div className="text-[13px] text-[var(--fg)] font-medium">{adsets.length} ad sets</div>
              </div>
            </div>
            <div className="flex-1 flex items-center gap-3 px-4 py-2.5">
              <div className="w-7 h-7 rounded-full bg-[var(--bg-elevated-2)] text-[var(--fg-soft)] flex items-center justify-center text-[11px] font-bold">{ads.length}</div>
              <div>
                <div className="text-[10px] eyebrow">Anuncios</div>
                <div className="text-[13px] text-[var(--fg)] font-medium">{ads.length} piezas</div>
              </div>
            </div>
          </div>

          {/* Meta grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-px bg-[var(--hairline)] rounded overflow-hidden border border-[var(--hairline)] stagger">
            <MetaCell icon={Target} label="OBJETIVO" value={campaign.objective || '—'} />
            <MetaCell icon={DollarSign} label="PRESUPUESTO" value={fmtBudget(campaign.daily_budget, campaign.lifetime_budget)} />
            <MetaCell icon={Calendar} label="INICIO" value={fmtDate(campaign.start_time)} />
            <MetaCell icon={Calendar} label="FIN" value={fmtDate(campaign.stop_time) || '—'} />
            <MetaCell icon={TrendingUp} label="BID" value={campaign.bid_strategy || '—'} />
            <MetaCell icon={Megaphone} label="COMPRA" value={campaign.buying_type || '—'} />
          </div>

          {/* Tabs */}
          <div className="border-b border-[var(--hairline)] flex items-center gap-1">
            {TABS.map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`px-4 py-2.5 text-[12px] uppercase tracking-[0.12em] font-semibold border-b-2 transition-colors ${
                  tab === t
                    ? 'border-[var(--accent)] text-[var(--fg)]'
                    : 'border-transparent text-[var(--fg-muted)] hover:text-[var(--fg-soft)]'
                }`}
              >
                {t === 'multimedia' ? 'Multimedia' : t === 'analitica' ? 'Analítica' : 'Configuración'}
              </button>
            ))}
            <span className="ml-3 px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.16em] bg-[var(--accent-soft)] text-[var(--accent)] rounded">
              <Sparkles size={9} className="inline mr-1" />Insights pronto
            </span>
          </div>

          {/* Tab content */}
          {tab === 'multimedia' && (
            <section className="space-y-4">
              {ads.length === 0 ? (
                <div className="card py-16 text-center">
                  <ImageOff size={28} className="mx-auto text-[var(--fg-faint)] mb-3" />
                  <p className="text-sm text-[var(--fg-muted)]">Sin anuncios en esta campaña</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4 stagger">
                  {ads.map((a) => {
                    const url = previewUrl(a);
                    const adDot = statusDot(a.effective_status);
                    return (
                      <article key={a.id} className="card lift overflow-hidden">
                        <div className="relative aspect-square bg-[var(--bg-elevated-2)] overflow-hidden">
                          {url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={url} alt={a.name} className="w-full h-full object-cover transition-transform duration-500 hover:scale-[1.04]" loading="lazy" />
                          ) : (
                            <div className="w-full h-full flex flex-col items-center justify-center gap-1.5 text-[var(--fg-faint)]">
                              <ImageOff size={24} />
                            </div>
                          )}
                          {isVideo(a) && (
                            <span className="absolute top-2 left-2 flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-black/70 text-white text-[10px] backdrop-blur-sm">
                              <Video size={10} /> Video
                            </span>
                          )}
                          <div className="absolute bottom-2 left-2 flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-black/70 backdrop-blur-sm">
                            <span className={`dot dot-${adDot}`} />
                            <span className="text-[10px] uppercase tracking-wider text-white font-medium">{a.effective_status}</span>
                          </div>
                        </div>
                        <div className="p-3">
                          <h3 className="text-[13px] font-medium text-[var(--fg)] truncate" title={a.name}>{a.name}</h3>
                          <div className="text-[10px] font-[family-name:var(--font-mono)] text-[var(--fg-faint)] mt-0.5 truncate">{a.id}</div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </section>
          )}

          {tab === 'analitica' && (
            <section className="space-y-4">
              {!insights ? (
                <div className="card py-16 text-center text-[var(--fg-muted)]">Sin datos en el período</div>
              ) : (
                <>
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 stagger">
                    <AnalyticTile label="IMPORTE INVERTIDO" value={fmtUSD(Number(insights.spend || 0))} wash="bg-indigo-wash" color="text-[var(--accent)]" />
                    <AnalyticTile label="ALCANCE" value={fmtInt(insights.reach || '0')} wash="bg-cyan-wash" color="text-[oklch(0.52_0.18_200)]" />
                    <AnalyticTile label="IMPRESIONES" value={fmtInt(insights.impressions || '0')} wash="bg-amber-wash" color="text-[oklch(0.62_0.20_75)]" />
                    <AnalyticTile label="LEADS" value={fmtInt(insights.leads || 0)} wash="bg-lime-wash" color="text-[var(--success)]" />
                    <AnalyticTile label="CPL" value={insights.leads ? fmtUSD(Number(insights.spend) / insights.leads) : '—'} wash="bg-coral-wash" color="text-[var(--danger)]" />
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <SmallStat label="CTR" value={`${fmt(insights.ctr || 0)}%`} />
                    <SmallStat label="CPM" value={fmtUSD(Number(insights.cpm || 0))} />
                    <SmallStat label="FREQ" value={fmt(insights.frequency || 0)} />
                    <SmallStat label="CHATS" value={fmtInt(insights.msgs || 0)} />
                  </div>
                </>
              )}

              {/* Meta IDs */}
              <div className="card p-5">
                <div className="eyebrow mb-3 flex items-center gap-1.5"><Layers size={11} /> Meta IDs</div>
                <div className="space-y-2 text-[12px]">
                  <IdRow label="Campaign ID" value={campaign.id} onCopy={copyId} />
                  <IdRow label="Account ID" value={campaign.account_id || '—'} onCopy={copyId} />
                </div>
              </div>
            </section>
          )}

          {tab === 'config' && (
            <section className="space-y-4 stagger">
              <div className="card p-5">
                <div className="eyebrow mb-4 flex items-center gap-1.5"><Layers size={11} /> Ad sets ({adsets.length})</div>
                {adsets.length === 0 ? (
                  <p className="text-sm text-[var(--fg-muted)]">Sin ad sets</p>
                ) : (
                  <div className="divide-y divide-[var(--hairline)]">
                    {adsets.map((s) => (
                      <div key={s.id} className="py-3 flex items-center gap-4">
                        <span className={`dot dot-${statusDot(s.effective_status)}`} />
                        <div className="flex-1 min-w-0">
                          <div className="text-[13px] text-[var(--fg)] font-medium truncate">{s.name}</div>
                          <div className="text-[10px] font-[family-name:var(--font-mono)] text-[var(--fg-faint)]">{s.id} · {s.optimization_goal || '—'} · {s.billing_event || '—'}</div>
                        </div>
                        <div className="text-[11px] text-[var(--fg-muted)]">{fmtBudget(s.daily_budget, s.lifetime_budget)}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="card p-5">
                <div className="eyebrow mb-3 flex items-center gap-1.5"><Eye size={11} /> Metadata cruda</div>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-2 text-[12px]">
                  <ConfigRow label="ID" value={campaign.id} />
                  <ConfigRow label="Account" value={campaign.account_id || '—'} />
                  <ConfigRow label="Status" value={campaign.status} />
                  <ConfigRow label="Effective" value={campaign.effective_status} />
                  <ConfigRow label="Objective" value={campaign.objective || '—'} />
                  <ConfigRow label="Bid strategy" value={campaign.bid_strategy || '—'} />
                  <ConfigRow label="Buying" value={campaign.buying_type || '—'} />
                  <ConfigRow label="Daily budget" value={campaign.daily_budget ? fmtUSD(Number(campaign.daily_budget) / 100) : '—'} />
                  <ConfigRow label="Lifetime budget" value={campaign.lifetime_budget ? fmtUSD(Number(campaign.lifetime_budget) / 100) : '—'} />
                  <ConfigRow label="Budget remaining" value={campaign.budget_remaining ? fmtUSD(Number(campaign.budget_remaining) / 100) : '—'} />
                  <ConfigRow label="Created" value={fmtDate(campaign.created_time)} />
                  <ConfigRow label="Updated" value={fmtDate(campaign.updated_time)} />
                </div>
              </div>
            </section>
          )}
        </main>
      </div>
      <ToastStack toasts={toasts} onDismiss={dismiss} />
    </div>
  );
}

function MetaCell({ icon: Icon, label, value }: { icon: typeof Target; label: string; value: string }) {
  return (
    <div className="bg-[var(--bg-elevated)] px-4 py-3">
      <div className="eyebrow flex items-center gap-1.5 mb-1">
        <Icon size={11} />
        {label}
      </div>
      <div className="text-[13px] text-[var(--fg)] font-medium truncate" title={value}>{value}</div>
    </div>
  );
}

function AnalyticTile({ label, value, wash, color }: { label: string; value: string; wash: string; color: string }) {
  return (
    <div className={`card p-5 ${wash}`}>
      <div className="eyebrow mb-2">{label}</div>
      <div className={`numeric text-[28px] font-semibold tracking-tight ${color}`}>{value}</div>
    </div>
  );
}

function SmallStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="card-flat px-4 py-3">
      <div className="eyebrow mb-1">{label}</div>
      <div className="numeric text-[16px] font-semibold text-[var(--fg)]">{value}</div>
    </div>
  );
}

function IdRow({ label, value, onCopy }: { label: string; value: string; onCopy: (v: string) => void }) {
  return (
    <div className="flex items-center justify-between gap-3 py-1.5 border-b border-[var(--hairline)] last:border-0">
      <span className="text-[var(--fg-muted)]">{label}</span>
      <div className="flex items-center gap-2">
        <span className="font-[family-name:var(--font-mono)] text-[var(--fg)]">{value}</span>
        <button
          onClick={() => onCopy(value)}
          className="p-1 rounded hover:bg-[var(--surface)] text-[var(--fg-muted)] hover:text-[var(--accent)] transition-colors"
          aria-label="Copiar"
        >
          <CopyIcon size={12} />
        </button>
      </div>
    </div>
  );
}

function ConfigRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3 py-1 border-b border-[var(--hairline)]">
      <span className="text-[var(--fg-muted)] text-[11px]">{label}</span>
      <span className="text-[var(--fg)] text-[12px] truncate" title={value}>{value}</span>
    </div>
  );
}
