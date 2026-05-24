'use client';

import { useEffect, useState, useCallback } from 'react';
import { Sidebar } from '@/components/Sidebar';
import { TopBar } from '@/components/TopBar';
import { useAccount } from '@/lib/use-account';
import { AlertOctagon, AlertTriangle, Info, RefreshCw, ChevronRight } from 'lucide-react';
import type { Alert } from '@/lib/diagnostics';

const SEVERITY_META: Record<Alert['severity'], { icon: typeof AlertOctagon; color: string; label: string; bg: string }> = {
  critical: { icon: AlertOctagon, color: 'text-[var(--danger)]', label: 'Crítico', bg: 'bg-[oklch(0.65_0.20_25_/_0.08)]' },
  high: { icon: AlertOctagon, color: 'text-[var(--danger)]', label: 'Alto', bg: 'bg-[oklch(0.65_0.20_25_/_0.05)]' },
  medium: { icon: AlertTriangle, color: 'text-[var(--warning)]', label: 'Medio', bg: 'bg-[oklch(0.78_0.155_80_/_0.06)]' },
  low: { icon: Info, color: 'text-[var(--info)]', label: 'Bajo', bg: '' },
  info: { icon: Info, color: 'text-[var(--fg-muted)]', label: 'Info', bg: '' },
};

const CAUSE_LABEL: Record<NonNullable<Alert['cause']>, string> = {
  saturation: 'Saturación audiencia',
  placement: 'Placement ineficiente',
  audience: 'Targeting demográfico',
  creative: 'Creativo / hook débil',
  budget: 'Presupuesto',
  tracking: 'Tracking / configuración',
  objective: 'Objetivo de campaña',
};

export default function AlertsPage() {
  const { account, setAccount } = useAccount();
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [health, setHealth] = useState<{ score: number; grade: string; label: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Alert['severity'] | 'all'>('all');

  const load = useCallback(async () => {
    if (!account) return;
    setLoading(true);
    setError(null);
    try {
      const r = await fetch(`/api/diagnostics?account_id=${account}`);
      const j = await r.json();
      if (j.error) throw new Error(j.error);
      setAlerts(j.alerts || []);
      setHealth(j.health);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error');
    } finally {
      setLoading(false);
    }
  }, [account]);

  useEffect(() => { load(); }, [load]);

  const filtered = filter === 'all' ? alerts : alerts.filter((a) => a.severity === filter);
  const counts = alerts.reduce(
    (acc, a) => ({ ...acc, [a.severity]: (acc[a.severity] || 0) + 1 }),
    {} as Record<string, number>
  );

  const gradeColor = health
    ? health.score >= 75
      ? 'text-[var(--success)]'
      : health.score >= 60
        ? 'text-[var(--warning)]'
        : 'text-[var(--danger)]'
    : '';

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex-1 flex flex-col">
        <TopBar selected={account} onSelect={setAccount} />
        <main className="flex-1 px-8 py-8 max-w-[1400px] mx-auto w-full space-y-6">
          <div className="flex items-end justify-between gap-4 flex-wrap fade-in">
            <div>
              <p className="text-[11px] uppercase tracking-[0.16em] text-[var(--fg-muted)] mb-1">Diagnóstico</p>
              <h1 className="display text-5xl text-[var(--fg)]">Alertas</h1>
              <p className="text-sm text-[var(--fg-muted)] mt-2 max-w-2xl">
                Problemas detectados automáticamente. Severidad calculada por gasto, frecuencia, CPL y tracking.
              </p>
            </div>
            <button onClick={load} disabled={loading} className="btn-ghost px-3 py-2 rounded-md text-xs flex items-center gap-2">
              <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
              Re-analizar
            </button>
          </div>

          {/* Health score */}
          {health && (
            <div className="card p-6 flex items-center gap-8 fade-in">
              <div>
                <p className="text-[10px] uppercase tracking-[0.16em] text-[var(--fg-muted)] mb-1">Salud cuenta</p>
                <div className="flex items-baseline gap-3">
                  <span className={`display text-7xl ${gradeColor}`}>{health.grade}</span>
                  <span className="text-2xl font-medium text-[var(--fg-soft)] font-[family-name:var(--font-mono)]">{health.score}/100</span>
                </div>
                <p className="text-sm text-[var(--fg-muted)] mt-1">{health.label}</p>
              </div>
              <div className="h-16 w-px bg-[var(--hairline)]" />
              <div className="flex gap-6">
                {(['critical', 'high', 'medium', 'low'] as const).map((s) => {
                  const meta = SEVERITY_META[s];
                  const n = counts[s] || 0;
                  return (
                    <button
                      key={s}
                      onClick={() => setFilter(filter === s ? 'all' : s)}
                      className={`text-left transition-opacity ${filter !== 'all' && filter !== s ? 'opacity-40' : ''}`}
                    >
                      <div className={`text-3xl font-bold font-[family-name:var(--font-mono)] ${meta.color}`}>{n}</div>
                      <div className="text-[10px] uppercase tracking-[0.16em] text-[var(--fg-muted)] mt-0.5">{meta.label}</div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {error && (
            <div className="bg-[oklch(0.65_0.20_25_/_0.1)] border border-[var(--danger)] text-[var(--danger)] px-4 py-3 rounded text-sm">
              {error}
            </div>
          )}

          {/* Alert list */}
          {filtered.length === 0 && !loading ? (
            <div className="card p-12 text-center">
              <p className="display text-2xl text-[var(--fg)]">Sin alertas</p>
              <p className="text-sm text-[var(--fg-muted)] mt-2">
                {filter === 'all' ? 'Todas las campañas operan dentro de parámetros normales.' : 'Ningún problema en este nivel de severidad.'}
              </p>
            </div>
          ) : (
            <div className="space-y-px stagger">
              {filtered.map((a) => {
                const meta = SEVERITY_META[a.severity];
                const Icon = meta.icon;
                return (
                  <article
                    key={a.id}
                    className={`card-flat p-5 hover:bg-[var(--surface-2)] transition-colors ${meta.bg}`}
                  >
                    <div className="flex items-start gap-4">
                      <Icon size={20} className={`shrink-0 mt-0.5 ${meta.color}`} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`text-[10px] uppercase tracking-[0.16em] font-bold ${meta.color}`}>
                            {meta.label}
                          </span>
                          <span className="text-[10px] text-[var(--fg-faint)]">·</span>
                          <span className="text-[10px] uppercase tracking-[0.12em] text-[var(--fg-muted)]">{a.scope}</span>
                          {a.cause && (
                            <>
                              <span className="text-[10px] text-[var(--fg-faint)]">·</span>
                              <span className="text-[10px] uppercase tracking-[0.12em] text-[var(--fg-muted)]">
                                {CAUSE_LABEL[a.cause]}
                              </span>
                            </>
                          )}
                        </div>
                        <h3 className="text-base font-semibold text-[var(--fg)] mb-1">{a.title}</h3>
                        <p className="text-sm text-[var(--fg-soft)] mb-2">{a.description}</p>
                        <div className="flex items-center gap-3 flex-wrap text-xs">
                          {a.metric && (
                            <span className="font-[family-name:var(--font-mono)] text-[var(--fg-muted)]">
                              {a.metric}
                            </span>
                          )}
                          <span className="text-[var(--fg-faint)]">·</span>
                          <span className="text-[var(--fg-muted)] italic truncate max-w-md">{a.scope_name}</span>
                        </div>
                        <div className="mt-3 pt-3 border-t border-[var(--hairline)] flex items-start gap-2">
                          <ChevronRight size={14} className="shrink-0 mt-0.5 text-[var(--accent)]" />
                          <p className="text-sm text-[var(--fg)]">
                            <span className="text-[var(--accent)] font-semibold">Acción: </span>
                            {a.suggested_action}
                          </p>
                        </div>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
