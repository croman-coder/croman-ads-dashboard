'use client';

import { useEffect, useState, useCallback } from 'react';
import { Sidebar } from '@/components/Sidebar';
import { TopBar } from '@/components/TopBar';
import { DateRangePicker } from '@/components/DateRangePicker';
import { ToastStack } from '@/components/Toast';
import { useToasts } from '@/lib/use-toasts';
import { useAccount } from '@/lib/use-account';
import { fmt, fmtUSD, fmtInt } from '@/lib/utils';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell, LabelList,
} from 'recharts';
import { Download, RefreshCw } from 'lucide-react';

type Row = {
  spend?: string;
  impressions?: string;
  clicks?: string;
  ctr?: string;
  leads: number;
  age?: string;
  gender?: string;
  publisher_platform?: string;
  platform_position?: string;
  device_platform?: string;
  region?: string;
  country?: string;
  hourly_stats_aggregated_by_advertiser_time_zone?: string;
};

const TABS = [
  { key: 'age,gender', label: 'Edad × Género' },
  { key: 'publisher_platform,platform_position', label: 'Placement' },
  { key: 'region', label: 'Región' },
  { key: 'device_platform', label: 'Dispositivo' },
  { key: 'hourly_stats_aggregated_by_advertiser_time_zone', label: 'Hora' },
];

export default function AnalyticsPage() {
  const { account, setAccount } = useAccount();
  const [range, setRange] = useState<{ since?: string; until?: string }>({});
  const [tab, setTab] = useState(TABS[0].key);
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pages, setPages] = useState<Array<{ id: string; name: string }>>([]);
  const [exportPageId, setExportPageId] = useState('');
  const { toasts, push, dismiss } = useToasts();

  const load = useCallback(async () => {
    if (!account) return;
    setLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams({ account_id: account, breakdowns: tab });
      if (range.since) qs.set('since', range.since);
      if (range.until) qs.set('until', range.until);
      const r = await fetch(`/api/breakdown?${qs}`);
      const j = await r.json();
      if (j.error) throw new Error(j.error);
      setRows(j.data || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error');
    } finally {
      setLoading(false);
    }
  }, [account, tab, range.since, range.until]);

  useEffect(() => { load(); }, [load]);

  // Pages for export
  useEffect(() => {
    if (!account) return;
    fetch(`/api/pages?account_id=${account}`)
      .then((r) => r.json())
      .then((j) => {
        if (!j.error) {
          setPages(j.data || []);
          if (j.data?.[0]) setExportPageId(j.data[0].id);
        }
      });
  }, [account]);

  function exportLeads() {
    if (!exportPageId) {
      push('Seleccionar página', 'error');
      return;
    }
    const qs = new URLSearchParams({ page_id: exportPageId });
    if (range.since) qs.set('since', range.since);
    if (range.until) qs.set('until', range.until);
    window.open(`/api/leads/export?${qs}`, '_blank');
    push('Generando CSV…', 'success');
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex-1 flex flex-col">
        <TopBar selected={account} onSelect={setAccount} />
        <main className="flex-1 p-6 space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Analítica</h1>
              <p className="text-sm text-slate-500">Breakdowns profundos por dimensión + export de leads</p>
            </div>
            <div className="flex items-center gap-2">
              <DateRangePicker value={range} onChange={setRange} />
              <button onClick={load} disabled={loading} className="flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900">
                <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
              </button>
            </div>
          </div>

          {/* Tabs */}
          <div className="bg-white border border-[var(--color-border)] rounded">
            <div className="flex border-b border-[var(--color-border)] overflow-x-auto">
              {TABS.map((t) => (
                <button
                  key={t.key}
                  onClick={() => setTab(t.key)}
                  className={`px-4 py-3 text-sm font-medium whitespace-nowrap transition-colors border-b-2 ${
                    tab === t.key
                      ? 'border-[var(--color-primary)] text-[var(--color-primary)]'
                      : 'border-transparent text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            <div className="p-5">
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded text-sm mb-3">{error}</div>
              )}
              {tab === 'age,gender' && <AgeGenderChart rows={rows} />}
              {tab === 'publisher_platform,platform_position' && <PlacementChart rows={rows} />}
              {tab === 'region' && <RegionTable rows={rows} />}
              {tab === 'device_platform' && <DeviceTable rows={rows} />}
              {tab === 'hourly_stats_aggregated_by_advertiser_time_zone' && <HourChart rows={rows} />}
            </div>
          </div>

          {/* Export */}
          <div className="bg-white border border-[var(--color-border)] rounded p-5">
            <h2 className="text-sm font-semibold text-slate-700 mb-3">Export leads del período</h2>
            <div className="flex items-center gap-3 flex-wrap">
              <select
                value={exportPageId}
                onChange={(e) => setExportPageId(e.target.value)}
                className="px-3 py-2 border border-[var(--color-border)] rounded text-sm bg-white min-w-[280px]"
              >
                {pages.length === 0 && <option>Sin páginas</option>}
                {pages.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
              <button
                onClick={exportLeads}
                className="flex items-center gap-2 bg-[var(--color-primary)] text-white px-4 py-2 rounded text-sm font-medium hover:bg-blue-800"
              >
                <Download size={14} />
                Descargar CSV
              </button>
              {range.since && range.until && (
                <span className="text-xs text-slate-500 font-mono">{range.since} → {range.until}</span>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-2">
              Exporta todos los leads en formato CSV con name, phone, email, city, ad, campaign. Útil para subir a CRM con dedup.
            </p>
          </div>
        </main>
      </div>
      <ToastStack toasts={toasts} onDismiss={dismiss} />
    </div>
  );
}

/* ---------- Breakdown components ---------- */

function AgeGenderChart({ rows }: { rows: Row[] }) {
  const data = rows
    .filter((r) => r.age && r.gender && r.gender !== 'unknown')
    .map((r) => {
      const sp = Number(r.spend || 0);
      const leads = r.leads || 0;
      return {
        seg: `${r.age} ${r.gender}`,
        spend: sp,
        leads,
        cpl: leads ? sp / leads : 0,
      };
    })
    .sort((a, b) => a.cpl - b.cpl);

  return (
    <div>
      <div style={{ width: '100%', height: 400 }}>
        <ResponsiveContainer>
          <BarChart data={data} layout="vertical" margin={{ left: 60 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
            <XAxis type="number" tick={{ fontSize: 11, fill: '#64748B' }} />
            <YAxis dataKey="seg" type="category" width={120} tick={{ fontSize: 11, fill: '#475569' }} />
            <Tooltip contentStyle={{ fontSize: 12 }} />
            <Bar dataKey="cpl" name="CPL" radius={[0, 4, 4, 0]}>
              {data.map((d, i) => (
                <Cell key={i} fill={d.cpl > 5 ? '#DC2626' : d.cpl > 3 ? '#D97706' : '#059669'} />
              ))}
              <LabelList dataKey="cpl" position="right" formatter={(v: unknown) => typeof v === 'number' && v ? `$${v.toFixed(2)}` : ''} style={{ fontSize: 10 }} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <TableRows rows={data.map((d) => ({ name: d.seg, spend: d.spend, leads: d.leads, cpl: d.cpl }))} />
    </div>
  );
}

function PlacementChart({ rows }: { rows: Row[] }) {
  const data = rows
    .filter((r) => r.publisher_platform && r.platform_position)
    .map((r) => {
      const sp = Number(r.spend || 0);
      const leads = r.leads || 0;
      return {
        seg: `${r.publisher_platform} · ${r.platform_position}`,
        spend: sp,
        leads,
        cpl: leads ? sp / leads : 0,
      };
    })
    .filter((d) => d.spend > 0)
    .sort((a, b) => b.spend - a.spend);

  return (
    <div>
      <div style={{ width: '100%', height: 440 }}>
        <ResponsiveContainer>
          <BarChart data={data} layout="vertical" margin={{ left: 60 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
            <XAxis type="number" tick={{ fontSize: 11, fill: '#64748B' }} />
            <YAxis dataKey="seg" type="category" width={200} tick={{ fontSize: 10, fill: '#475569' }} />
            <Tooltip contentStyle={{ fontSize: 12 }} />
            <Bar dataKey="spend" name="Spend" fill="#1E40AF" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <TableRows rows={data.map((d) => ({ name: d.seg, spend: d.spend, leads: d.leads, cpl: d.cpl }))} />
    </div>
  );
}

function RegionTable({ rows }: { rows: Row[] }) {
  const data = rows
    .filter((r) => r.region)
    .map((r) => {
      const sp = Number(r.spend || 0);
      const leads = r.leads || 0;
      return {
        name: r.region || '—',
        spend: sp,
        leads,
        cpl: leads ? sp / leads : 0,
        impressions: Number(r.impressions || 0),
      };
    })
    .sort((a, b) => b.spend - a.spend)
    .slice(0, 25);

  return <TableRows rows={data} showImp />;
}

function DeviceTable({ rows }: { rows: Row[] }) {
  const data = rows
    .filter((r) => r.device_platform)
    .map((r) => {
      const sp = Number(r.spend || 0);
      const leads = r.leads || 0;
      return {
        name: r.device_platform || '—',
        spend: sp,
        leads,
        cpl: leads ? sp / leads : 0,
        impressions: Number(r.impressions || 0),
      };
    })
    .sort((a, b) => b.spend - a.spend);
  return <TableRows rows={data} showImp />;
}

function HourChart({ rows }: { rows: Row[] }) {
  const data = rows
    .filter((r) => r.hourly_stats_aggregated_by_advertiser_time_zone)
    .map((r) => {
      const sp = Number(r.spend || 0);
      const leads = r.leads || 0;
      const hr = r.hourly_stats_aggregated_by_advertiser_time_zone || '';
      return {
        hour: hr.slice(0, 5),
        spend: sp,
        leads,
        cpl: leads ? sp / leads : 0,
      };
    })
    .sort((a, b) => a.hour.localeCompare(b.hour));

  return (
    <div>
      <div style={{ width: '100%', height: 360 }}>
        <ResponsiveContainer>
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
            <XAxis dataKey="hour" tick={{ fontSize: 10, fill: '#64748B' }} />
            <YAxis tick={{ fontSize: 11, fill: '#64748B' }} />
            <Tooltip contentStyle={{ fontSize: 12 }} />
            <Bar dataKey="leads" name="Leads" fill="#1E40AF" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <TableRows rows={data.map((d) => ({ name: d.hour, spend: d.spend, leads: d.leads, cpl: d.cpl }))} />
    </div>
  );
}

function TableRows({ rows, showImp }: { rows: Array<{ name: string; spend: number; leads: number; cpl: number; impressions?: number }>; showImp?: boolean }) {
  return (
    <div className="mt-4 overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-[var(--color-muted)]">
          <tr className="text-xs uppercase tracking-wider text-slate-600">
            <th className="px-3 py-2 text-left">Segmento</th>
            {showImp && <th className="px-3 py-2 text-right">Impr.</th>}
            <th className="px-3 py-2 text-right">Spend</th>
            <th className="px-3 py-2 text-right">Leads</th>
            <th className="px-3 py-2 text-right">CPL</th>
          </tr>
        </thead>
        <tbody className="font-[family-name:var(--font-mono)]">
          {rows.length === 0 && (
            <tr><td colSpan={showImp ? 5 : 4} className="px-3 py-6 text-center text-slate-400">Sin datos</td></tr>
          )}
          {rows.map((r) => (
            <tr key={r.name} className="border-t border-slate-100 hover:bg-slate-50">
              <td className="px-3 py-2 font-sans text-slate-800">{r.name}</td>
              {showImp && <td className="px-3 py-2 text-right text-slate-600">{fmtInt(r.impressions)}</td>}
              <td className="px-3 py-2 text-right">{fmtUSD(r.spend)}</td>
              <td className="px-3 py-2 text-right">{r.leads || '—'}</td>
              <td className={`px-3 py-2 text-right font-semibold ${r.cpl > 5 ? 'text-[var(--color-destructive)]' : r.cpl > 3 ? 'text-[var(--color-warning)]' : 'text-[var(--color-success)]'}`}>
                {r.leads ? fmtUSD(r.cpl) : '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// kept for future use
export { fmt };
