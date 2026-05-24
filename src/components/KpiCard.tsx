import { cn } from '@/lib/utils';

interface Props {
  label: string;
  value: string;
  hint?: string;
  trend?: 'up' | 'down' | 'flat';
  trendValue?: string;
  accent?: 'primary' | 'success' | 'warning' | 'destructive';
}

const ACCENT_COLOR = {
  primary: 'text-[var(--accent)]',
  success: 'text-[var(--success)]',
  warning: 'text-[var(--warning)]',
  destructive: 'text-[var(--danger)]',
} as const;

const DOT_COLOR = {
  primary: 'bg-[var(--accent)]',
  success: 'bg-[var(--success)]',
  warning: 'bg-[var(--warning)]',
  destructive: 'bg-[var(--danger)]',
} as const;

export function KpiCard({ label, value, hint, trend, trendValue, accent = 'primary' }: Props) {
  return (
    <div className="card p-5">
      <div className="flex items-center gap-2 mb-3">
        <span className={cn('w-1.5 h-1.5 rounded-full', DOT_COLOR[accent])} />
        <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--fg-muted)]">
          {label}
        </span>
      </div>
      <div className="text-3xl font-bold text-[var(--fg)] font-[family-name:var(--font-mono)] tracking-tight">
        {value}
      </div>
      {(hint || trendValue) && (
        <div className="text-xs text-[var(--fg-muted)] mt-2 flex items-center gap-2">
          {trendValue && (
            <span
              className={cn(
                'font-semibold flex items-center gap-0.5',
                trend === 'up' && 'text-[var(--success)]',
                trend === 'down' && 'text-[var(--danger)]',
                trend === 'flat' && 'text-[var(--fg-muted)]'
              )}
            >
              {trend === 'up' && '↑'} {trend === 'down' && '↓'} {trendValue}
            </span>
          )}
          {hint && <span>{hint}</span>}
        </div>
      )}
    </div>
  );
}
