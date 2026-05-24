import { cn } from '@/lib/utils';

interface Props {
  label: string;
  value: string;
  hint?: string;
  trend?: 'up' | 'down' | 'flat';
  trendValue?: string;
  accent?: 'primary' | 'success' | 'warning' | 'destructive';
}

const ACCENT = {
  primary: 'bg-[var(--color-primary)]',
  success: 'bg-[var(--color-success)]',
  warning: 'bg-[var(--color-warning)]',
  destructive: 'bg-[var(--color-destructive)]',
} as const;

export function KpiCard({ label, value, hint, trend, trendValue, accent = 'primary' }: Props) {
  return (
    <div className="relative bg-white border border-[var(--color-border)] rounded p-4">
      <div className={cn('absolute left-0 top-0 bottom-0 w-1 rounded-l', ACCENT[accent])} />
      <div className="pl-2">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
          {label}
        </div>
        <div className="text-2xl font-bold text-slate-900 mt-1 font-[family-name:var(--font-mono)]">
          {value}
        </div>
        {(hint || trendValue) && (
          <div className="text-xs text-slate-500 mt-1 flex items-center gap-2">
            {trendValue && (
              <span
                className={cn(
                  'font-semibold',
                  trend === 'up' && 'text-[var(--color-success)]',
                  trend === 'down' && 'text-[var(--color-destructive)]',
                  trend === 'flat' && 'text-slate-500'
                )}
              >
                {trend === 'up' && '▲'} {trend === 'down' && '▼'} {trendValue}
              </span>
            )}
            {hint && <span>{hint}</span>}
          </div>
        )}
      </div>
    </div>
  );
}
