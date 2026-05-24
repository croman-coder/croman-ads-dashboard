import { cn } from '@/lib/utils';

type Tone = 'success' | 'warning' | 'danger' | 'info' | 'muted';

const TONE_CLS: Record<Tone, string> = {
  success: 'border-[oklch(0.78_0.18_150_/_0.45)] bg-[oklch(0.78_0.18_150_/_0.10)] text-[var(--success)]',
  warning: 'border-[oklch(0.82_0.18_75_/_0.45)] bg-[oklch(0.82_0.18_75_/_0.10)] text-[var(--warning)]',
  danger: 'border-[oklch(0.65_0.25_18_/_0.45)] bg-[oklch(0.65_0.25_18_/_0.10)] text-[var(--danger)]',
  info: 'border-[oklch(0.72_0.16_230_/_0.45)] bg-[oklch(0.72_0.16_230_/_0.10)] text-[var(--info)]',
  muted: 'border-[var(--border)] bg-[var(--surface)] text-[var(--fg-muted)]',
};

const MAP: Record<string, { label: string; tone: Tone }> = {
  ACTIVE: { label: 'Activo', tone: 'success' },
  PAUSED: { label: 'Pausado', tone: 'muted' },
  DELETED: { label: 'Eliminado', tone: 'danger' },
  ARCHIVED: { label: 'Archivado', tone: 'muted' },
  IN_PROCESS: { label: 'En revisión', tone: 'info' },
  CAMPAIGN_PAUSED: { label: 'Camp. pausada', tone: 'warning' },
  ADSET_PAUSED: { label: 'Adset pausado', tone: 'warning' },
  WITH_ISSUES: { label: 'Con errores', tone: 'danger' },
};

export function StatusBadge({ status }: { status?: string }) {
  if (!status) return null;
  const entry = MAP[status] || { label: status, tone: 'muted' as Tone };
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 px-2 py-0.5 text-[10px] uppercase tracking-[0.08em] font-semibold border',
        TONE_CLS[entry.tone]
      )}
      style={{ borderRadius: 2 }}
    >
      <span className={`dot dot-${entry.tone === 'info' ? 'success' : entry.tone}`} />
      {entry.label}
    </span>
  );
}
