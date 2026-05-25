'use client';

import { useState } from 'react';
import { Calendar } from 'lucide-react';

const PRESETS = [
  { label: 'Últimos 7 días', value: 'last_7d' },
  { label: 'Últimos 14 días', value: 'last_14d' },
  { label: 'Últimos 30 días', value: 'last_30d' },
  { label: 'Últimos 90 días', value: 'last_90d' },
  { label: 'Este mes', value: 'this_month' },
  { label: 'Mes pasado', value: 'last_month' },
];

interface Props {
  value: { since?: string; until?: string };
  onChange: (v: { since?: string; until?: string }) => void;
}

function calcRange(preset: string): { since: string; until: string } {
  const now = new Date();
  const until = now.toISOString().slice(0, 10);
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
      return { since: d.toISOString().slice(0, 10), until: lastMonthEnd.toISOString().slice(0, 10) };
    }
  }
  return { since: d.toISOString().slice(0, 10), until };
}

export function DateRangePicker({ value, onChange }: Props) {
  const [preset, setPreset] = useState('last_30d');
  return (
    <div className="flex items-center gap-2">
      <Calendar size={14} className="text-[var(--fg-muted)]" />
      <select
        value={preset}
        onChange={(e) => {
          setPreset(e.target.value);
          onChange(calcRange(e.target.value));
        }}
        className="bg-[var(--bg-elevated)] border border-[var(--border)] rounded-md text-sm text-[var(--fg)] px-3 py-1.5 cursor-pointer focus:outline-none focus:border-[var(--accent)] hover:border-[var(--border-strong)] transition-colors shadow-sm"
      >
        {PRESETS.map((p) => (
          <option key={p.value} value={p.value} className="bg-[var(--bg-elevated)] text-[var(--fg)]">{p.label}</option>
        ))}
      </select>
      {value.since && value.until && (
        <span className="text-xs text-[var(--fg-muted)] font-[family-name:var(--font-mono)] hidden lg:inline">
          {value.since} → {value.until}
        </span>
      )}
    </div>
  );
}
