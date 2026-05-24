'use client';

import { useEffect, useState } from 'react';
import { Sidebar } from '@/components/Sidebar';
import { TopBar } from '@/components/TopBar';
import { useAccount } from '@/lib/use-account';
import { KpiCard } from '@/components/KpiCard';
import { DateRangePicker } from '@/components/DateRangePicker';
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

export default function Dashboard() {
  const { account, setAccount } = useAccount();
  const [range, setRange] = useState<{ since?: string; until?: string }>({});
  const [rows, setRows] = useState<CampaignRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!account) return;
    setLoading(true);
    setError(null);
    const qs = new URLSearchParams({ account_id: account, level: 'campaign' });
    if (range.since) qs.set('since', range.since);
    if (range.until) qs.set('until', range.until);
    fetch(`/api/insights?${qs}`)
      .then((r) => r.json())
      .then((j) => {
        if (j.error) throw new Error(j.error);
        setRows(j.data || []);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [account, range.since, range.until]);

  const totals = rows.reduce(
    (a, r) => ({
      spend: a.spend + Number(r.spend || 0),
      impressions: a.impressions + Number(r.impressions || 0),
      clicks: a.clicks + Number(r.clicks || 0),
      leads: a.leads + (r.leads || 0),
      msgs: a.msgs + (r.msgs || 0),
    }),
    { spend: 0, impressions: 0, clicks: 0, leads: 0, msgs: 0 }
  );

  const cpl = totals.leads ? totals.spend / totals.leads : 0;
  const ctr = totals.impressions ? (totals.clicks / totals.impressions) * 100 : 0;
  const cpm = totals.impressions ? (totals.spend / totals.impressions) * 1000 : 0;

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
            <KpiCard label="INVERSIÓN" value={fmtUSD(totals.spend)} accent="primary" />
            <KpiCard label="LEADS" value={fmtInt(totals.leads)} accent="success" />
            <KpiCard label="CHATS" value={fmtInt(totals.msgs)} accent="primary" />
            <KpiCard label="CPL" value={fmtUSD(cpl)} accent={cpl > 5 ? 'destructive' : cpl > 3 ? 'warning' : 'success'} />
            <KpiCard label="CTR" value={`${fmt(ctr)}%`} accent="primary" />
            <KpiCard label="CPM" value={fmtUSD(cpm)} accent="primary" />
          </section>

          <section className="grid grid-cols-1 lg:grid-cols-2 gap-4 stagger">
            <div className="glass rounded-xl p-5">
              <h2 className="text-sm font-semibold text-white mb-1">Gasto por campaña</h2>
              <p className="text-[11px] text-[var(--fg-muted)] mb-3">Top 10 · USD</p>
              <div style={{ width: '100%', height: 320 }}>
                <ResponsiveContainer>
                  <BarChart data={chartData} layout="vertical" margin={{ left: 60 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                    <XAxis type="number" tick={{ fontSize: 11, fill: '#8A8F98' }} />
                    <YAxis dataKey="name" type="category" width={150} tick={{ fontSize: 11, fill: '#EDEDEF' }} />
                    <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, background: '#11111a', border: '1px solid rgba(255,255,255,0.14)' }} />
                    <Bar dataKey="spend" name="Spend USD" fill="#6A77E0" radius={[0, 6, 6, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="glass rounded-xl p-5">
              <h2 className="text-sm font-semibold text-white mb-1">CPL por campaña</h2>
              <p className="text-[11px] text-[var(--fg-muted)] mb-3">Verde &lt;$3 · Amber &lt;$5 · Rojo ≥$5</p>
              <div style={{ width: '100%', height: 320 }}>
                <ResponsiveContainer>
                  <BarChart data={chartData} layout="vertical" margin={{ left: 60 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                    <XAxis type="number" tick={{ fontSize: 11, fill: '#8A8F98' }} />
                    <YAxis dataKey="name" type="category" width={150} tick={{ fontSize: 11, fill: '#EDEDEF' }} />
                    <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, background: '#11111a', border: '1px solid rgba(255,255,255,0.14)' }} />
                    <Bar dataKey="cpl" name="CPL USD" radius={[0, 6, 6, 0]}>
                      {chartData.map((d, i) => (
                        <Cell key={i} fill={d.cpl > 5 ? '#FF5C7C' : d.cpl > 3 ? '#FFB547' : '#2EE5A1'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </section>

          <section className="glass rounded-xl overflow-hidden fade-in">
            <div className="px-5 py-3 border-b border-[var(--border)] flex items-center justify-between">
              <h2 className="text-sm font-semibold text-white">Campañas</h2>
              {loading && <span className="text-xs text-[var(--fg-muted)]">Cargando…</span>}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-[var(--surface)]">
                  <tr className="text-[11px] uppercase tracking-wider text-[var(--fg-muted)] font-semibold">
                    <th className="px-4 py-2.5 text-left">Campaña</th>
                    <th className="px-4 py-2.5 text-right">Spend</th>
                    <th className="px-4 py-2.5 text-right">Impr.</th>
                    <th className="px-4 py-2.5 text-right">Clicks</th>
                    <th className="px-4 py-2.5 text-right">CTR</th>
                    <th className="px-4 py-2.5 text-right">Leads</th>
                    <th className="px-4 py-2.5 text-right">CPL</th>
                    <th className="px-4 py-2.5 text-right">Freq.</th>
                  </tr>
                </thead>
                <tbody className="font-[family-name:var(--font-mono)]">
                  {rows.length === 0 && !loading && (
                    <tr><td colSpan={8} className="px-4 py-10 text-center text-[var(--fg-muted)]">Sin datos</td></tr>
                  )}
                  {rows
                    .slice()
                    .sort((a, b) => Number(b.spend || 0) - Number(a.spend || 0))
                    .map((r) => {
                      const sp = Number(r.spend || 0);
                      const rcpl = r.leads ? sp / r.leads : 0;
                      return (
                        <tr key={r.campaign_id} className="border-t border-[var(--border)] hover:bg-white/[0.03] transition-colors">
                          <td className="px-4 py-2 text-white font-sans">{r.campaign_name}</td>
                          <td className="px-4 py-2 text-right text-white">{fmtUSD(sp)}</td>
                          <td className="px-4 py-2 text-right text-[var(--fg-muted)]">{fmtInt(r.impressions)}</td>
                          <td className="px-4 py-2 text-right text-[var(--fg-muted)]">{fmtInt(r.clicks)}</td>
                          <td className="px-4 py-2 text-right text-[var(--fg-muted)]">{fmt(r.ctr)}%</td>
                          <td className="px-4 py-2 text-right text-white">{r.leads || '—'}</td>
                          <td className={`px-4 py-2 text-right font-semibold ${rcpl > 5 ? 'text-[var(--color-destructive)]' : rcpl > 3 ? 'text-[var(--color-warning)]' : 'text-[var(--color-success)]'}`}>
                            {r.leads ? fmtUSD(rcpl) : '—'}
                          </td>
                          <td className="px-4 py-2 text-right text-[var(--fg-muted)]">{fmt(r.frequency)}</td>
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
