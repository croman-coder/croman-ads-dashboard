'use client';

import { useEffect, useMemo, useState } from 'react';
import { Sidebar } from '@/components/Sidebar';
import { TopBar } from '@/components/TopBar';
import { useAccount } from '@/lib/use-account';
import { KpiCard } from '@/components/KpiCard';
import { DateRangePicker } from '@/components/DateRangePicker';
import { AiInsights } from '@/components/AiInsights';
import { TopPerformer } from '@/components/TopPerformer';
import { fmt, fmtInt, fmtUSD } from '@/lib/utils';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Cell,
} from 'recharts';

type CampaignRow = {
  campaign_id: string;
  campaign_name: string;
  spend: string;
  impressions: string;
  clicks: string;
  ctr: string;
  cpm: string;
  frequency: string;
  leads: number;
  msgs: number;
};

function shiftRangeBack(since?: string, until?: string): { since: string; until: string } | null {
  if (!since || !until) {
    // default range = last 30 days; previous = the 30 before
    const now = new Date();
    const e = new Date(now); e.setDate(e.getDate() - 30);
    const s = new Date(now); s.setDate(s.getDate() - 60);
    return { since: s.toISOString().slice(0, 10), until: e.toISOString().slice(0, 10) };
  }
  const s = new Date(since); const u = new Date(until);
  const days = Math.max(1, Math.round((u.getTime() - s.getTime()) / 86400000) + 1);
  const prevU = new Date(s); prevU.setDate(prevU.getDate() - 1);
  const prevS = new Date(prevU); prevS.setDate(prevS.getDate() - days + 1);
  return { since: prevS.toISOString().slice(0, 10), until: prevU.toISOString().slice(0, 10) };
}

function pct(curr: number, prev: number): { value: number; trend: 'up' | 'down' | 'flat' } {
  if (!prev) return { value: 0, trend: 'flat' };
  const d = ((curr - prev) / prev) * 100;
  return { value: d, trend: Math.abs(d) < 0.5 ? 'flat' : d > 0 ? 'up' : 'down' };
}

export default function Dashboard() {
  const { account, setAccount } = useAccount();
  const [range, setRange] = useState<{ since?: string; until?: string }>({});
  const [rows, setRows] = useState<CampaignRow[]>([]);
  const [prevRows, setPrevRows] = useState<CampaignRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!account) return;
    setLoading(true);
    setError(null);
    const qs = new URLSearchParams({ account_id: account, level: 'campaign' });
    if (range.since) qs.set('since', range.since);
    if (range.until) qs.set('until', range.until);

    const prev = shiftRangeBack(range.since, range.until);
    const qsPrev = new URLSearchParams({ account_id: account, level: 'campaign' });
    if (prev) {
      qsPrev.set('since', prev.since);
      qsPrev.set('until', prev.until);
    }

    Promise.all([
      fetch(`/api/insights?${qs}`).then((r) => r.json()),
      fetch(`/api/insights?${qsPrev}`).then((r) => r.json()),
    ])
      .then(([curr, p]) => {
        if (curr.error) throw new Error(curr.error);
        setRows(curr.data || []);
        setPrevRows(p?.data || []);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [account, range.since, range.until]);

  const totals = useMemo(
    () =>
      rows.reduce(
        (a, r) => ({
          spend: a.spend + Number(r.spend || 0),
          impressions: a.impressions + Number(r.impressions || 0),
          clicks: a.clicks + Number(r.clicks || 0),
          leads: a.leads + (r.leads || 0),
          msgs: a.msgs + (r.msgs || 0),
        }),
        { spend: 0, impressions: 0, clicks: 0, leads: 0, msgs: 0 }
      ),
    [rows]
  );

  const prevTotals = useMemo(
    () =>
      prevRows.reduce(
        (a, r) => ({
          spend: a.spend + Number(r.spend || 0),
          impressions: a.impressions + Number(r.impressions || 0),
          clicks: a.clicks + Number(r.clicks || 0),
          leads: a.leads + (r.leads || 0),
          msgs: a.msgs + (r.msgs || 0),
        }),
        { spend: 0, impressions: 0, clicks: 0, leads: 0, msgs: 0 }
      ),
    [prevRows]
  );

  const cpl = totals.leads ? totals.spend / totals.leads : 0;
  const ctr = totals.impressions ? (totals.clicks / totals.impressions) * 100 : 0;
  const cpm = totals.impressions ? (totals.spend / totals.impressions) * 1000 : 0;

  const prevCpl = prevTotals.leads ? prevTotals.spend / prevTotals.leads : 0;
  const prevCtr = prevTotals.impressions ? (prevTotals.clicks / prevTotals.impressions) * 100 : 0;
  const prevCpm = prevTotals.impressions ? (prevTotals.spend / prevTotals.impressions) * 1000 : 0;

  const dSpend = pct(totals.spend, prevTotals.spend);
  const dLeads = pct(totals.leads, prevTotals.leads);
  const dMsgs = pct(totals.msgs, prevTotals.msgs);
  // CPL/CPM lower is better — invert trend semantics
  const dCpl = pct(cpl, prevCpl);
  const dCtr = pct(ctr, prevCtr);
  const dCpm = pct(cpm, prevCpm);

  const chartData = rows
    .map((r) => ({
      name: r.campaign_name?.slice(0, 24) || '',
      spend: Number(r.spend || 0),
      leads: r.leads || 0,
      cpl: r.leads ? Number(r.spend || 0) / r.leads : 0,
    }))
    .sort((a, b) => b.spend - a.spend)
    .slice(0, 10);

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex-1 flex flex-col">
        <TopBar selected={account} onSelect={setAccount} />
        <main className="flex-1 px-8 py-8 space-y-8 max-w-[1500px] mx-auto w-full">
          <div className="flex items-end justify-between flex-wrap gap-4 fade-in">
            <div>
              <p className="text-[11px] uppercase tracking-[0.16em] text-[var(--fg-muted)] mb-1">Panel de control</p>
              <h1 className="display text-5xl text-[var(--fg)]">Dashboard</h1>
              <p className="text-sm text-[var(--fg-muted)] mt-2">Resumen ejecutivo · cuenta seleccionada</p>
            </div>
            <DateRangePicker value={range} onChange={setRange} />
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/30 text-red-300 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          <section className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 stagger">
            <KpiCard
              label="INVERSIÓN"
              value={fmtUSD(totals.spend)}
              accent="primary"
              trend={dSpend.trend}
              trendValue={dSpend.value ? `${dSpend.value > 0 ? '+' : ''}${dSpend.value.toFixed(1)}%` : ''}
              hint="vs período anterior"
            />
            <KpiCard
              label="LEADS"
              value={fmtInt(totals.leads)}
              accent="success"
              trend={dLeads.trend}
              trendValue={dLeads.value ? `${dLeads.value > 0 ? '+' : ''}${dLeads.value.toFixed(1)}%` : ''}
              hint="vs período anterior"
            />
            <KpiCard
              label="CHATS"
              value={fmtInt(totals.msgs)}
              accent="primary"
              trend={dMsgs.trend}
              trendValue={dMsgs.value ? `${dMsgs.value > 0 ? '+' : ''}${dMsgs.value.toFixed(1)}%` : ''}
              hint="vs período anterior"
            />
            <KpiCard
              label="CPL"
              value={fmtUSD(cpl)}
              accent={cpl > 5 ? 'destructive' : cpl > 3 ? 'warning' : 'success'}
              trend={dCpl.trend === 'up' ? 'down' : dCpl.trend === 'down' ? 'up' : 'flat'}
              trendValue={dCpl.value ? `${dCpl.value > 0 ? '+' : ''}${dCpl.value.toFixed(1)}%` : ''}
              hint="menor es mejor"
            />
            <KpiCard
              label="CTR"
              value={`${fmt(ctr)}%`}
              accent="primary"
              trend={dCtr.trend}
              trendValue={dCtr.value ? `${dCtr.value > 0 ? '+' : ''}${dCtr.value.toFixed(1)}%` : ''}
              hint="vs período anterior"
            />
            <KpiCard
              label="CPM"
              value={fmtUSD(cpm)}
              accent="primary"
              trend={dCpm.trend === 'up' ? 'down' : dCpm.trend === 'down' ? 'up' : 'flat'}
              trendValue={dCpm.value ? `${dCpm.value > 0 ? '+' : ''}${dCpm.value.toFixed(1)}%` : ''}
              hint="menor es mejor"
            />
          </section>

          {/* AI Insights + Top Performer side by side */}
          <section className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-5 stagger">
            <AiInsights rows={rows} totals={totals} prevTotals={prevTotals} />
            <TopPerformer rows={rows} accountId={account} />
          </section>

          <section className="grid grid-cols-1 lg:grid-cols-2 gap-5 stagger">
            <div className="card p-6">
              <div className="flex items-baseline justify-between mb-5">
                <h2 className="display text-3xl">Gasto por campaña</h2>
                <span className="eyebrow">Top 10 · USD</span>
              </div>
              <div style={{ width: '100%', height: 320 }}>
                <ResponsiveContainer>
                  <BarChart data={chartData} layout="vertical" margin={{ left: 60 }}>
                    <defs>
                      <linearGradient id="gSpend" x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%" stopColor="oklch(0.52 0.22 278)" />
                        <stop offset="100%" stopColor="oklch(0.62 0.26 330)" />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="2 4" stroke="#ededeb" />
                    <XAxis type="number" tick={{ fontSize: 11, fill: '#6a6a74' }} axisLine={false} tickLine={false} />
                    <YAxis dataKey="name" type="category" width={150} tick={{ fontSize: 11, fill: '#3a3a44' }} axisLine={false} tickLine={false} />
                    <Tooltip
                      contentStyle={{ fontSize: 12, borderRadius: 8, background: '#ffffff', border: '1px solid #e6e6e0', color: '#0a0a0c', boxShadow: '0 8px 24px rgba(10,10,12,0.10)' }}
                      cursor={{ fill: 'oklch(0.52 0.22 278 / 0.06)' }}
                    />
                    <Bar dataKey="spend" name="Spend USD" fill="url(#gSpend)" radius={[0, 6, 6, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="card p-6">
              <div className="flex items-baseline justify-between mb-5">
                <h2 className="display text-3xl">CPL por campaña</h2>
                <span className="eyebrow">USD por lead</span>
              </div>
              <div style={{ width: '100%', height: 320 }}>
                <ResponsiveContainer>
                  <BarChart data={chartData} layout="vertical" margin={{ left: 60 }}>
                    <defs>
                      <linearGradient id="gGood" x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%" stopColor="oklch(0.78 0.18 130)" />
                        <stop offset="100%" stopColor="oklch(0.58 0.20 152)" />
                      </linearGradient>
                      <linearGradient id="gMid" x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%" stopColor="oklch(0.78 0.16 75)" />
                        <stop offset="100%" stopColor="oklch(0.72 0.22 30)" />
                      </linearGradient>
                      <linearGradient id="gBad" x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%" stopColor="oklch(0.62 0.26 330)" />
                        <stop offset="100%" stopColor="oklch(0.58 0.24 22)" />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="2 4" stroke="#ededeb" />
                    <XAxis type="number" tick={{ fontSize: 11, fill: '#6a6a74' }} axisLine={false} tickLine={false} />
                    <YAxis dataKey="name" type="category" width={150} tick={{ fontSize: 11, fill: '#3a3a44' }} axisLine={false} tickLine={false} />
                    <Tooltip
                      contentStyle={{ fontSize: 12, borderRadius: 8, background: '#ffffff', border: '1px solid #e6e6e0', color: '#0a0a0c', boxShadow: '0 8px 24px rgba(10,10,12,0.10)' }}
                      cursor={{ fill: 'oklch(0.52 0.22 278 / 0.06)' }}
                    />
                    <Bar dataKey="cpl" name="CPL USD" radius={[0, 6, 6, 0]}>
                      {chartData.map((d, i) => (
                        <Cell key={i} fill={d.cpl > 5 ? 'url(#gBad)' : d.cpl > 3 ? 'url(#gMid)' : 'url(#gGood)'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="flex items-center gap-4 mt-4 text-[11px] text-[var(--fg-muted)]">
                <span className="flex items-center gap-1.5"><span className="dot dot-success" /> &lt;$3</span>
                <span className="flex items-center gap-1.5"><span className="dot dot-warning" /> $3–$5</span>
                <span className="flex items-center gap-1.5"><span className="dot dot-danger" /> ≥$5</span>
              </div>
            </div>
          </section>

          <section className="card overflow-hidden fade-in">
            <div className="px-6 py-4 border-b border-[var(--hairline)] flex items-center justify-between">
              <div>
                <h2 className="display text-2xl text-[var(--fg)]">Campañas</h2>
                <p className="text-[11px] text-[var(--fg-muted)] mt-0.5">{rows.length} activas · ordenado por inversión</p>
              </div>
              {loading && <span className="text-xs text-[var(--fg-muted)] flex items-center gap-2"><span className="dot dot-warning animate-pulse" /> Cargando…</span>}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-[10px] uppercase tracking-[0.14em] text-[var(--fg-muted)] font-semibold border-b border-[var(--hairline)]">
                    <th className="px-6 py-3 text-left">Campaña</th>
                    <th className="px-4 py-3 text-right">Spend</th>
                    <th className="px-4 py-3 text-right">Impr.</th>
                    <th className="px-4 py-3 text-right">Clicks</th>
                    <th className="px-4 py-3 text-right">CTR</th>
                    <th className="px-4 py-3 text-right">Leads</th>
                    <th className="px-4 py-3 text-right">CPL</th>
                    <th className="px-6 py-3 text-right">Freq.</th>
                  </tr>
                </thead>
                <tbody style={{ fontVariantNumeric: 'tabular-nums' }}>
                  {rows.length === 0 && !loading && (
                    <tr><td colSpan={8} className="px-4 py-16 text-center text-[var(--fg-muted)]">Sin datos para este rango</td></tr>
                  )}
                  {rows
                    .slice()
                    .sort((a, b) => Number(b.spend || 0) - Number(a.spend || 0))
                    .map((r) => {
                      const sp = Number(r.spend || 0);
                      const rcpl = r.leads ? sp / r.leads : 0;
                      const cplColor = rcpl > 5 ? 'text-[var(--danger)]' : rcpl > 3 ? 'text-[var(--warning)]' : 'text-[var(--success)]';
                      return (
                        <tr key={r.campaign_id} className="border-t border-[var(--hairline)] hover:bg-[var(--surface)] transition-colors">
                          <td className="px-6 py-3 text-[var(--fg)] font-medium">{r.campaign_name}</td>
                          <td className="px-4 py-3 text-right text-[var(--fg)] font-[family-name:var(--font-mono)]">{fmtUSD(sp)}</td>
                          <td className="px-4 py-3 text-right text-[var(--fg-soft)] font-[family-name:var(--font-mono)]">{fmtInt(r.impressions)}</td>
                          <td className="px-4 py-3 text-right text-[var(--fg-soft)] font-[family-name:var(--font-mono)]">{fmtInt(r.clicks)}</td>
                          <td className="px-4 py-3 text-right text-[var(--fg-soft)] font-[family-name:var(--font-mono)]">{fmt(r.ctr)}%</td>
                          <td className="px-4 py-3 text-right text-[var(--fg)] font-[family-name:var(--font-mono)]">{r.leads || '—'}</td>
                          <td className={`px-4 py-3 text-right font-semibold font-[family-name:var(--font-mono)] ${cplColor}`}>
                            {r.leads ? fmtUSD(rcpl) : '—'}
                          </td>
                          <td className="px-6 py-3 text-right text-[var(--fg-soft)] font-[family-name:var(--font-mono)]">{fmt(r.frequency)}</td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}
