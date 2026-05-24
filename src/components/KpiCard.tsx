import { cn } from '@/lib/utils';

interface Props {
  label: string;
  value: string;
  hint?: string;
  trend?: 'up' | 'down' | 'flat';
  trendValue?: string;
  accent?: 'primary' | 'success' | 'warning' | 'destructive';
}

const ACCENT_BG = {
  primary: 'from-[#6A77E0]/20 to-transparent',
  success: 'from-[#2EE5A1]/20 to-transparent',
  warning: 'from-[#FFB547]/20 to-transparent',
  destructive: 'from-[#FF5C7C]/20 to-transparent',
} as const;

const ACCENT_GLOW = {
  primary: 'shadow-[inset_0_0_60px_rgba(94,106,210,0.15)]',
  success: 'shadow-[inset_0_0_60px_rgba(46,229,161,0.12)]',
  warning: 'shadow-[inset_0_0_60px_rgba(255,181,71,0.12)]',
  destructive: 'shadow-[inset_0_0_60px_rgba(255,92,124,0.15)]',
} as const;

const ACCENT_BAR = {
  primary: 'bg-[var(--color-primary)]',
  success: 'bg-[var(--color-success)]',
  warning: 'bg-[var(--color-warning)]',
  destructive: 'bg-[var(--color-destructive)]',
} as const;

export function KpiCard({ label, value, hint, trend, trendValue, accent = 'primary' }: Props) {
  return (
    <div className={cn(
      'relative glass rounded-xl p-4 overflow-hidden transition-all duration-300 hover:border-white/20 hover:translate-y-[-2px]',
      ACCENT_GLOW[accent]
    )}>
      {/* Accent gradient overlay */}
      <div className={cn('absolute inset-0 bg-gradient-to-br opacity-60', ACCENT_BG[accent])} />
      {/* Top accent bar */}
      <div className={cn('absolute left-0 top-0 h-0.5 w-12 rounded-full', ACCENT_BAR[accent])} />

      <div className="relative">
        <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--fg-muted)]">
          {label}
        </div>
        <div className="text-2xl font-bold text-white mt-2 font-[family-name:var(--font-mono)] tracking-tight count-up">
          {value}
        </div>
        {(hint || trendValue) && (
          <div className="text-xs text-[var(--fg-muted)] mt-1.5 flex items-center gap-2">
            {trendValue && (
              <span
                className={cn(
                  'font-semibold flex items-center gap-0.5',
                  trend === 'up' && 'text-[var(--color-success)]',
                  trend === 'down' && 'text-[var(--color-destructive)]',
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
    </div>
  );
}
