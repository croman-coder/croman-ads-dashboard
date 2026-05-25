'use client';

import { useEffect, useRef, useState } from 'react';
import { Calendar, ChevronDown, GitCompare, Check } from 'lucide-react';

const PRESETS = [
  { label: 'Últimos 7 días', value: 'last_7d' },
  { label: 'Últimos 14 días', value: 'last_14d' },
  { label: 'Últimos 30 días', value: 'last_30d' },
  { label: 'Últimos 90 días', value: 'last_90d' },
  { label: 'Este mes', value: 'this_month' },
  { label: 'Mes pasado', value: 'last_month' },
  { label: 'Personalizado…', value: 'custom' },
] as const;

const COMPARE_PRESETS = [
  { label: 'Sin comparar', value: 'none' },
  { label: 'Período anterior', value: 'prev_period' },
  { label: 'Año anterior', value: 'prev_year' },
  { label: 'Personalizado…', value: 'custom' },
] as const;

export type DateRange = { since: string; until: string };
export type Comparison = { mode: 'none' | 'prev_period' | 'prev_year' | 'custom'; since?: string; until?: string };

interface Props {
  value: { since?: string; until?: string };
  onChange: (v: DateRange) => void;
  comparison?: Comparison;
  onComparisonChange?: (c: Comparison) => void;
}

function iso(d: Date): string { return d.toISOString().slice(0, 10); }
function dayDiff(a: string, b: string): number {
  return Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86400000) + 1;
}
function shiftYears(s: string, years: number): string {
  const d = new Date(s); d.setFullYear(d.getFullYear() - years); return iso(d);
}

function calcRange(preset: string): DateRange | null {
  const now = new Date();
  const until = iso(now);
  const d = new Date(now);
  switch (preset) {
    case 'last_7d': d.setDate(d.getDate() - 6); break;
    case 'last_14d': d.setDate(d.getDate() - 13); break;
    case 'last_30d': d.setDate(d.getDate() - 29); break;
    case 'last_90d': d.setDate(d.getDate() - 89); break;
    case 'this_month': d.setDate(1); break;
    case 'last_month': {
      d.setMonth(d.getMonth() - 1, 1);
      const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);
      return { since: iso(d), until: iso(lastMonthEnd) };
    }
    default: return null;
  }
  return { since: iso(d), until };
}

export function DateRangePicker({ value, onChange, comparison, onComparisonChange }: Props) {
  const [preset, setPreset] = useState('last_30d');
  const [open, setOpen] = useState(false);
  const [customSince, setCustomSince] = useState(value.since || '');
  const [customUntil, setCustomUntil] = useState(value.until || '');
  const [comparePreset, setComparePreset] = useState<Comparison['mode']>(comparison?.mode || 'prev_period');
  const [compareSince, setCompareSince] = useState(comparison?.since || '');
  const [compareUntil, setCompareUntil] = useState(comparison?.until || '');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function close(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  function pickPreset(v: string) {
    setPreset(v);
    if (v === 'custom') return;
    const r = calcRange(v);
    if (r) {
      onChange(r);
      setCustomSince(r.since);
      setCustomUntil(r.until);
      autoComputeCompare(r, comparePreset);
    }
  }

  function applyCustom() {
    if (!customSince || !customUntil) return;
    if (customSince > customUntil) return;
    const r = { since: customSince, until: customUntil };
    onChange(r);
    autoComputeCompare(r, comparePreset);
  }

  function autoComputeCompare(base: DateRange, mode: Comparison['mode']) {
    if (!onComparisonChange) return;
    if (mode === 'none') {
      onComparisonChange({ mode: 'none' });
      return;
    }
    if (mode === 'prev_period') {
      const days = dayDiff(base.since, base.until);
      const prevUntilD = new Date(base.since); prevUntilD.setDate(prevUntilD.getDate() - 1);
      const prevSinceD = new Date(prevUntilD); prevSinceD.setDate(prevSinceD.getDate() - days + 1);
      onComparisonChange({ mode: 'prev_period', since: iso(prevSinceD), until: iso(prevUntilD) });
      return;
    }
    if (mode === 'prev_year') {
      onComparisonChange({ mode: 'prev_year', since: shiftYears(base.since, 1), until: shiftYears(base.until, 1) });
      return;
    }
    if (mode === 'custom') {
      onComparisonChange({ mode: 'custom', since: compareSince || base.since, until: compareUntil || base.until });
    }
  }

  function pickCompare(mode: Comparison['mode']) {
    setComparePreset(mode);
    if (mode !== 'custom') {
      const base = value.since && value.until ? { since: value.since, until: value.until } : calcRange(preset === 'custom' ? 'last_30d' : preset);
      if (base) autoComputeCompare(base, mode);
    } else if (compareSince && compareUntil && onComparisonChange) {
      onComparisonChange({ mode: 'custom', since: compareSince, until: compareUntil });
    } else if (onComparisonChange) {
      onComparisonChange({ mode: 'custom' });
    }
  }

  const activeLabel =
    preset === 'custom'
      ? value.since && value.until ? `${value.since} → ${value.until}` : 'Personalizado'
      : PRESETS.find((p) => p.value === preset)?.label || 'Rango';

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 bg-[var(--bg-elevated)] border border-[var(--border)] rounded-md text-sm text-[var(--fg)] pl-3 pr-2.5 py-1.5 cursor-pointer hover:border-[var(--border-strong)] focus:outline-none focus:border-[var(--accent)] transition-colors shadow-sm"
      >
        <Calendar size={13} className="text-[var(--fg-muted)]" />
        <span className="font-medium">{activeLabel}</span>
        {comparison && comparison.mode !== 'none' && (
          <span className="text-[10px] text-[var(--accent)] font-[family-name:var(--font-mono)] flex items-center gap-1 border-l border-[var(--hairline)] pl-2 ml-1">
            <GitCompare size={10} /> vs
          </span>
        )}
        <ChevronDown size={13} className="text-[var(--fg-muted)]" />
      </button>

      {open && (
        <div
          className="absolute right-0 top-full mt-2 w-[440px] max-w-[calc(100vw-2rem)] bg-[var(--bg-elevated)] border border-[var(--border)] rounded-lg z-50 overflow-hidden p-5 fade-in"
          style={{ boxShadow: '0 16px 48px rgba(10, 10, 12, 0.18), 0 4px 12px rgba(10, 10, 12, 0.08)' }}
        >
          <div className="grid grid-cols-2 gap-5">
            {/* Primary range */}
            <div>
              <div className="eyebrow mb-2 flex items-center gap-1.5"><Calendar size={11} /> Período</div>
              <div className="space-y-px">
                {PRESETS.map((p) => (
                  <button
                    key={p.value}
                    onClick={() => pickPreset(p.value)}
                    className={`w-full text-left px-2 py-1.5 rounded text-[12.5px] flex items-center justify-between transition-colors ${
                      preset === p.value
                        ? 'bg-[var(--accent-soft)] text-[var(--accent)] font-medium'
                        : 'text-[var(--fg-soft)] hover:bg-[var(--surface)]'
                    }`}
                  >
                    {p.label}
                    {preset === p.value && <Check size={12} />}
                  </button>
                ))}
              </div>
              {preset === 'custom' && (
                <div className="mt-3 space-y-2 pt-3 border-t border-[var(--hairline)]">
                  <input type="date" value={customSince} onChange={(e) => setCustomSince(e.target.value)} className="w-full bg-[var(--bg-elevated)] border border-[var(--border)] rounded px-2 py-1.5 text-[12px] text-[var(--fg)] focus:outline-none focus:border-[var(--accent)]" />
                  <input type="date" value={customUntil} onChange={(e) => setCustomUntil(e.target.value)} className="w-full bg-[var(--bg-elevated)] border border-[var(--border)] rounded px-2 py-1.5 text-[12px] text-[var(--fg)] focus:outline-none focus:border-[var(--accent)]" />
                  <button onClick={applyCustom} disabled={!customSince || !customUntil || customSince > customUntil} className="btn-primary w-full py-1.5 text-[12px]">Aplicar</button>
                </div>
              )}
            </div>

            {/* Comparison */}
            {onComparisonChange && (
              <div>
                <div className="eyebrow mb-2 flex items-center gap-1.5"><GitCompare size={11} /> Comparar con</div>
                <div className="space-y-px">
                  {COMPARE_PRESETS.map((p) => (
                    <button
                      key={p.value}
                      onClick={() => pickCompare(p.value)}
                      className={`w-full text-left px-2 py-1.5 rounded text-[12.5px] flex items-center justify-between transition-colors ${
                        comparePreset === p.value
                          ? 'bg-[var(--accent-soft)] text-[var(--accent)] font-medium'
                          : 'text-[var(--fg-soft)] hover:bg-[var(--surface)]'
                      }`}
                    >
                      {p.label}
                      {comparePreset === p.value && <Check size={12} />}
                    </button>
                  ))}
                </div>
                {comparePreset === 'custom' && (
                  <div className="mt-3 space-y-2 pt-3 border-t border-[var(--hairline)]">
                    <input type="date" value={compareSince} onChange={(e) => setCompareSince(e.target.value)} className="w-full bg-[var(--bg-elevated)] border border-[var(--border)] rounded px-2 py-1.5 text-[12px] text-[var(--fg)] focus:outline-none focus:border-[var(--accent)]" />
                    <input type="date" value={compareUntil} onChange={(e) => setCompareUntil(e.target.value)} className="w-full bg-[var(--bg-elevated)] border border-[var(--border)] rounded px-2 py-1.5 text-[12px] text-[var(--fg)] focus:outline-none focus:border-[var(--accent)]" />
                    <button
                      onClick={() => onComparisonChange({ mode: 'custom', since: compareSince, until: compareUntil })}
                      disabled={!compareSince || !compareUntil || compareSince > compareUntil}
                      className="btn-primary w-full py-1.5 text-[12px]"
                    >Aplicar</button>
                  </div>
                )}
                {comparison && comparison.mode !== 'none' && comparison.since && comparison.until && (
                  <div className="mt-3 pt-3 border-t border-[var(--hairline)] text-[11px] text-[var(--fg-muted)] font-[family-name:var(--font-mono)]">
                    {comparison.since} → {comparison.until}
                  </div>
                )}
              </div>
            )}
          </div>

          {value.since && value.until && (
            <div className="mt-4 pt-3 border-t border-[var(--hairline)] text-[11px] text-[var(--fg-muted)] font-[family-name:var(--font-mono)]">
              Actual: {value.since} → {value.until} · {dayDiff(value.since, value.until)} días
            </div>
          )}
        </div>
      )}
    </div>
  );
}
