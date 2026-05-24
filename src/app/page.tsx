'use client';

import { useEffect, useState } from 'react';
import { Sidebar } from '@/components/Sidebar';
import { TopBar } from '@/components/TopBar';
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
  const [account, setAccount] = useState('');
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
        <main className="flex-1 p-6 space-y-6">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
              <p className="text-sm text-slate-500">Resumen general · cuenta activa</p>
            </div>
            <DateRangePicker value={range} onChange={setRange} />
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded text-sm">
              {error}
            </div>
          )}

          <section className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            <KpiCard label="INVERSIÓN" value={fmtUSD(totals.spend)} accent="primary" />
            <KpiCard label="LEADS" value={fmtInt(totals.leads)} accent="success" />
            <KpiCard label="CHATS" value={fmtInt(totals.msgs)} accent="primary" />
            <KpiCard label="CPL" value={fmtUSD(cpl)} accent={cpl > 5 ? 'destructive' : cpl > 3 ? 'warning' : 'success'} />
            <KpiCard label="CTR" value={`${fmt(ctr)}%`} accent="primary" />
            <KpiCard label="CPM" value={fmtUSD(cpm)} accent="primary" />
          </section>

          <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="bg-white border border-[var(--color-border)] rounded p-5">
              <h2 className="text-sm font-semibold text-slate-700 mb-3">Gasto por campaña (top 10)</h2>
              <div style={{ width: '100%', height: 320 }}>
                <ResponsiveContainer>
                  <BarChart data={chartData} layout="vertical" margin={{ left: 60 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                    <XAxis type="number" tick={{ fontSize: 11, fill: '#64748B' }} />
                    <YAxis dataKey="name" type="category" width={150} tick={{ fontSize: 11, fill: '#475569' }} />
                    <Tooltip contentStyle={{ fontSize: 12, borderRadius: 4 }} />
                    <Bar dataKey="spend" name="Spend USD" fill="#1E40AF" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-white border border-[var(--color-border)] rounded p-5">
              <h2 className="text-sm font-semibold text-slate-700 mb-3">CPL por campaña (top 10)</h2>
              <div style={{ width: '100%', height: 320 }}>
                <ResponsiveContainer>
                  <BarChart data={chartData} layout="vertical" margin={{ left: 60 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                    <XAxis type="number" tick={{ fontSize: 11, fill: '#64748B' }} />
                    <YAxis dataKey="name" type="category" width={150} tick={{ fontSize: 11, fill: '#475569' }} />
                    <Tooltip contentStyle={{ fontSize: 12, borderRadius: 4 }} />
                    <Bar dataKey="cpl" name="CPL USD" radius={[0, 4, 4, 0]}>
                      {chartData.map((d, i) => (
                        <Cell key={i} fill={d.cpl > 5 ? '#DC2626' : d.cpl > 3 ? '#D97706' : '#059669'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </section>

          <section className="bg-white border border-[var(--color-border)] rounded overflow-hidden">
            <div className="px-5 py-3 border-b border-[var(--color-border)] flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-700">Campañas</h2>
              {loading && <span className="text-xs text-slate-500">Cargando…</span>}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-[var(--color-muted)]">
                  <tr className="text-xs uppercase tracking-wider text-slate-600">
                    <th className="px-4 py-2 text-left">Campaña</th>
                    <th className="px-4 py-2 text-right">Spend</th>
                    <th className="px-4 py-2 text-right">Impr.</th>
                    <th className="px-4 py-2 text-right">Clicks</th>
                    <th className="px-4 py-2 text-right">CTR</th>
                    <th className="px-4 py-2 text-right">Leads</th>
                    <th className="px-4 py-2 text-right">CPL</th>
                    <th className="px-4 py-2 text-right">Freq.</th>
                  </tr>
                </thead>
                <tbody className="font-[family-name:var(--font-mono)]">
                  {rows.length === 0 && !loading && (
                    <tr><td colSpan={8} className="px-4 py-8 text-center text-slate-400">Sin datos</td></tr>
                  )}
                  {rows
                    .slice()
                    .sort((a, b) => Number(b.spend || 0) - Number(a.spend || 0))
                    .map((r) => {
                      const sp = Number(r.spend || 0);
                      const rcpl = r.leads ? sp / r.leads : 0;
                      return (
                        <tr key={r.campaign_id} className="border-t border-slate-100 hover:bg-slate-50">
                          <td className="px-4 py-2 text-slate-800 font-sans">{r.campaign_name}</td>
                          <td className="px-4 py-2 text-right">{fmtUSD(sp)}</td>
                          <td className="px-4 py-2 text-right text-slate-600">{fmtInt(r.impressions)}</td>
                          <td className="px-4 py-2 text-right text-slate-600">{fmtInt(r.clicks)}</td>
                          <td className="px-4 py-2 text-right text-slate-600">{fmt(r.ctr)}%</td>
                          <td className="px-4 py-2 text-right">{r.leads || '—'}</td>
                          <td className={`px-4 py-2 text-right font-semibold ${rcpl > 5 ? 'text-[var(--color-destructive)]' : rcpl > 3 ? 'text-[var(--color-warning)]' : 'text-[var(--color-success)]'}`}>
                            {r.leads ? fmtUSD(rcpl) : '—'}
                          </td>
                          <td className="px-4 py-2 text-right text-slate-600">{fmt(r.frequency)}</td>
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
