import { cn } from '@/lib/utils';

interface Props {
  label: string;
  value: string;
  hint?: string;
  trend?: 'up' | 'down' | 'flat';
  trendValue?: string;
  accent?: 'primary' | 'success' | 'warning' | 'destructive' | 'data' | 'amber';
}

const WASH = {
  primary: 'bg-indigo-wash',
  success: 'bg-lime-wash',
  warning: 'bg-amber-wash',
  destructive: 'bg-coral-wash',
  data: 'bg-cyan-wash',
  amber: 'bg-amber-wash',
} as const;

const ACCENT_COLOR = {
  primary: 'text-[var(--accent)]',
  success: 'text-[var(--success)]',
  warning: 'text-[var(--warning)]',
  destructive: 'text-[var(--danger)]',
  data: 'text-[oklch(0.52_0.18_200)]',
  amber: 'text-[oklch(0.62_0.20_75)]',
} as const;

const DOT_COLOR = {
  primary: 'bg-[var(--accent)]',
  success: 'bg-[var(--success)]',
  warning: 'bg-[var(--warning)]',
  destructive: 'bg-[var(--danger)]',
  data: 'bg-[oklch(0.72_0.18_200)]',
  amber: 'bg-[oklch(0.78_0.16_75)]',
} as const;

export function KpiCard({ label, value, hint, trend, trendValue, accent = 'primary' }: Props) {
  return (
    <div className={cn('card lift p-5 relative overflow-hidden', WASH[accent])}>
      <div className="flex items-center gap-2 mb-3 relative">
        <span className={cn('w-1.5 h-1.5 rounded-full', DOT_COLOR[accent])} />
        <span className="eyebrow">{label}</span>
      </div>
      <div className={cn('numeric text-[34px] leading-none font-semibold tracking-tight', ACCENT_COLOR[accent])}>
        {value}
      </div>
      {(hint || trendValue) && (
        <div className="text-[11px] text-[var(--fg-muted)] mt-3 flex items-center gap-2">
          {trendValue && (
            <span
              className={cn(
                'font-semibold inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px]',
                trend === 'up' && 'bg-[oklch(0.58_0.20_152_/_0.12)] text-[var(--success)]',
                trend === 'down' && 'bg-[oklch(0.58_0.24_22_/_0.12)] text-[var(--danger)]',
                trend === 'flat' && 'bg-[var(--surface)] text-[var(--fg-muted)]'
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
