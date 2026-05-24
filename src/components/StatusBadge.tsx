import { cn } from '@/lib/utils';

const MAP: Record<string, { label: string; cls: string }> = {
  ACTIVE: { label: 'Activo', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  PAUSED: { label: 'Pausado', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
  DELETED: { label: 'Eliminado', cls: 'bg-red-50 text-red-700 border-red-200' },
  ARCHIVED: { label: 'Archivado', cls: 'bg-slate-100 text-slate-700 border-slate-200' },
  IN_PROCESS: { label: 'En revisión', cls: 'bg-blue-50 text-blue-700 border-blue-200' },
  CAMPAIGN_PAUSED: { label: 'Camp. pausada', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
  ADSET_PAUSED: { label: 'Adset pausado', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
  WITH_ISSUES: { label: 'Con errores', cls: 'bg-red-50 text-red-700 border-red-200' },
};

export function StatusBadge({ status }: { status?: string }) {
  if (!status) return null;
  const entry = MAP[status] || { label: status, cls: 'bg-slate-50 text-slate-700 border-slate-200' };
  return (
    <span
      className={cn(
        'inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium border',
        entry.cls
      )}
    >
      {entry.label}
    </span>
  );
}
