'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Sidebar } from '@/components/Sidebar';
import { TopBar } from '@/components/TopBar';
import { useAccount } from '@/lib/use-account';
import { ToastStack } from '@/components/Toast';
import { useToasts } from '@/lib/use-toasts';
import {
  Brain,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  Target,
  Sparkles,
  ArrowUpRight,
} from 'lucide-react';

type Segment = {
  label: string;
  spend: number;
  impressions: number;
  clicks: number;
  leads: number;
  ctr: number;
  cpl: number | null;
  score: number;
  share_spend: number;
  share_leads: number;
};
type Recommendation = { segment: string; cpl: number | null; vs_avg_pct: number | null; reason: string };
type Resp = {
  breakdown: string;
  segments: Segment[];
  recommended: Recommendation[];
  underUtilized: Segment[];
  leaks: Segment[];
};

const BREAKDOWNS = [
  { v: 'age,gender', label: 'Edad + Género' },
  { v: 'age', label: 'Edad' },
  { v: 'gender', label: 'Género' },
  { v: 'region', label: 'Región' },
  { v: 'publisher_platform,platform_position', label: 'Placement' },
  { v: 'device_platform', label: 'Dispositivo' },
];

function usd(n: number | null) {
  if (n == null) return '—';
  return `$${n.toFixed(2)}`;
}
function int(n: number) {
  return n.toLocaleString('es-PY');
}

export default function IntelligencePage() {
  const router = useRouter();
  const { account, setAccount } = useAccount();
  const { toasts, push, dismiss } = useToasts();
  const [breakdown, setBreakdown] = useState('age,gender');
  const [data, setData] = useState<Resp | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!account) return;
    setLoading(true);
    setError(null);
    try {
      const r = await fetch(`/api/audience/insights/${account}?breakdown=${encodeURIComponent(breakdown)}`);
      const j = await r.json();
      if (j.error) throw new Error(j.error);
      setData(j);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error');
    } finally {
      setLoading(false);
    }
  }, [account, breakdown]);

  useEffect(() => { load(); }, [load]);

  // CPL heat color
  function cplColor(cpl: number | null, avg: number) {
    if (cpl == null) return 'text-[var(--fg-faint)]';
    if (cpl < avg * 0.85) return 'text-[var(--success)]';
    if (cpl > avg * 1.3) return 'text-[var(--danger)]';
    return 'text-[var(--warning)]';
  }
  const withCpl = (data?.segments || []).filter((s) => s.cpl != null);
  const avgCpl = withCpl.length ? withCpl.reduce((s, x) => s + (x.cpl as number), 0) / withCpl.length : 0;

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex-1 flex flex-col">
        <TopBar selected={account} onSelect={setAccount} />
        <main className="flex-1 px-8 py-8 max-w-[1500px] mx-auto w-full space-y-6">
          <header className="flex items-end justify-between flex-wrap gap-4 fade-in">
            <div>
              <p className="eyebrow mb-1 flex items-center gap-1.5"><Brain size={12} className="text-[var(--accent)]" /> Audience Intelligence</p>
              <h1 className="display text-5xl">Público objetivo.</h1>
              <p className="text-sm text-[var(--fg-muted)] mt-2">Quién convierte por cuenta — segmentos rankeados por eficiencia.</p>
            </div>
            <button onClick={load} disabled={loading} className="btn-ghost px-4 py-2 flex items-center gap-2">
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Recargar
            </button>
          </header>

          {/* Breakdown pills */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {BREAKDOWNS.map((b) => (
              <button
                key={b.v}
                onClick={() => setBreakdown(b.v)}
                className={`px-3.5 py-1.5 rounded-full text-[12px] font-medium border transition-colors ${
                  breakdown === b.v
                    ? 'border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]'
                    : 'border-[var(--border)] text-[var(--fg-soft)] hover:border-[var(--border-strong)]'
                }`}
              >
                {b.label}
              </button>
            ))}
          </div>

          {error && (
            <div className="card border-[var(--danger)]/30 bg-[var(--danger)]/10 text-[var(--danger)] px-4 py-3 text-sm">{error}</div>
          )}

          {/* Recommended audience cards */}
          {data && data.recommended.length > 0 && (
            <section className="grid grid-cols-1 md:grid-cols-3 gap-4 stagger">
              {data.recommended.map((r, i) => (
                <div key={i} className="card p-5 relative overflow-hidden">
                  <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[var(--accent)] to-[oklch(0.70_0.26_330)]" />
                  <div className="flex items-center gap-2 mb-3">
                    <Target size={14} className="text-[var(--accent)]" />
                    <span className="eyebrow">Público #{i + 1}</span>
                  </div>
                  <div className="text-xl font-semibold text-[var(--fg)]">{r.segment}</div>
                  <div className="numeric text-2xl text-[var(--success)] mt-2">{usd(r.cpl)}</div>
                  <div className="text-[12px] text-[var(--fg-muted)] mt-1">{r.reason}</div>
                  {r.vs_avg_pct != null && (
                    <div className={`text-[11px] mt-2 inline-flex items-center gap-1 ${r.vs_avg_pct < 0 ? 'text-[var(--success)]' : 'text-[var(--danger)]'}`}>
                      {r.vs_avg_pct < 0 ? <TrendingDown size={11} /> : <TrendingUp size={11} />}
                      {r.vs_avg_pct > 0 ? '+' : ''}{r.vs_avg_pct.toFixed(0)}% vs CPL promedio
                    </div>
                  )}
                  <button
                    onClick={() => { push('Targeting copiado al wizard (pronto)', 'success'); router.push('/campaigns/new'); }}
                    className="mt-4 w-full btn-gradient py-2 flex items-center justify-center gap-1.5 text-[12px]"
                  >
                    <Sparkles size={13} /> Usar en campaña
                  </button>
                </div>
              ))}
            </section>
          )}

          {/* Under-utilized + leaks */}
          {data && (data.underUtilized.length > 0 || data.leaks.length > 0) && (
            <section className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              <div className="card p-6">
                <div className="eyebrow mb-3 flex items-center gap-1.5"><ArrowUpRight size={11} className="text-[var(--success)]" /> Sub-aprovechados · escalar</div>
                {data.underUtilized.length === 0 ? (
                  <p className="text-[12px] text-[var(--fg-muted)]">Ninguno detectado.</p>
                ) : (
                  <ul className="space-y-2">
                    {data.underUtilized.map((s, i) => (
                      <li key={i} className="flex items-center justify-between text-[13px]">
                        <span className="text-[var(--fg)]">{s.label}</span>
                        <span className="font-[family-name:var(--font-mono)] text-[var(--success)]">{usd(s.cpl)} · {s.share_spend.toFixed(0)}% spend</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div className="card p-6">
                <div className="eyebrow mb-3 flex items-center gap-1.5"><TrendingDown size={11} className="text-[var(--danger)]" /> Fugas · recortar</div>
                {data.leaks.length === 0 ? (
                  <p className="text-[12px] text-[var(--fg-muted)]">Ninguna detectada.</p>
                ) : (
                  <ul className="space-y-2">
                    {data.leaks.map((s, i) => (
                      <li key={i} className="flex items-center justify-between text-[13px]">
                        <span className="text-[var(--fg)]">{s.label}</span>
                        <span className="font-[family-name:var(--font-mono)] text-[var(--danger)]">{usd(s.cpl)} · {s.share_spend.toFixed(0)}% spend</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </section>
          )}

          {/* Full ranked table + CPL heat */}
          <section className="card overflow-hidden">
            <div className="px-6 py-4 border-b border-[var(--hairline)]">
              <h2 className="display text-2xl">Segmentos rankeados</h2>
              <p className="text-[11px] text-[var(--fg-muted)] mt-0.5">Ordenados por score (volumen leads + eficiencia CPL + CTR)</p>
            </div>
            {loading && !data ? (
              <div className="p-8 text-center text-[var(--fg-muted)]"><RefreshCw size={18} className="animate-spin mx-auto" /></div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-[10px] uppercase tracking-[0.14em] text-[var(--fg-muted)] font-semibold border-b border-[var(--hairline)]">
                      <th className="px-6 py-3 text-left">Segmento</th>
                      <th className="px-4 py-3 text-right">Spend</th>
                      <th className="px-4 py-3 text-right">% Spend</th>
                      <th className="px-4 py-3 text-right">Leads</th>
                      <th className="px-4 py-3 text-right">% Leads</th>
                      <th className="px-4 py-3 text-right">CTR</th>
                      <th className="px-6 py-3 text-right">CPL</th>
                    </tr>
                  </thead>
                  <tbody style={{ fontVariantNumeric: 'tabular-nums' }}>
                    {(data?.segments || []).map((s, i) => (
                      <tr key={i} className="border-t border-[var(--hairline)] hover:bg-[var(--surface)] transition-colors">
                        <td className="px-6 py-3 text-[var(--fg)] font-medium">{s.label}</td>
                        <td className="px-4 py-3 text-right font-[family-name:var(--font-mono)] text-[var(--fg-soft)]">${s.spend.toFixed(0)}</td>
                        <td className="px-4 py-3 text-right font-[family-name:var(--font-mono)] text-[var(--fg-muted)]">{s.share_spend.toFixed(1)}%</td>
                        <td className="px-4 py-3 text-right font-[family-name:var(--font-mono)] text-[var(--fg)]">{int(s.leads)}</td>
                        <td className="px-4 py-3 text-right font-[family-name:var(--font-mono)] text-[var(--fg-muted)]">{s.share_leads.toFixed(1)}%</td>
                        <td className="px-4 py-3 text-right font-[family-name:var(--font-mono)] text-[var(--fg-soft)]">{s.ctr.toFixed(2)}%</td>
                        <td className={`px-6 py-3 text-right font-[family-name:var(--font-mono)] font-semibold ${cplColor(s.cpl, avgCpl)}`}>{usd(s.cpl)}</td>
                      </tr>
                    ))}
                    {data && data.segments.length === 0 && (
                      <tr><td colSpan={7} className="px-4 py-12 text-center text-[var(--fg-muted)]">Sin datos para este breakdown</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </main>
      </div>
      <ToastStack toasts={toasts} onDismiss={dismiss} />
    </div>
  );
}
