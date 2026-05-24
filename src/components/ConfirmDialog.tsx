'use client';

import { AlertTriangle } from 'lucide-react';

interface Props {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  destructive,
  loading,
  onConfirm,
  onCancel,
}: Props) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={onCancel}
    >
      <div
        className="card max-w-md w-full mx-4 p-6 shadow-2xl fade-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-3">
          <div className={destructive ? 'text-[var(--danger)]' : 'text-[var(--warning)]'}>
            <AlertTriangle size={22} strokeWidth={2.25} />
          </div>
          <div className="flex-1">
            <h3 className="display text-xl text-[var(--fg)]">{title}</h3>
            <p className="text-sm text-[var(--fg-soft)] mt-2 leading-relaxed">{message}</p>
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 mt-6">
          <button
            onClick={onCancel}
            disabled={loading}
            className="btn-ghost px-4 py-1.5"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className={destructive ? 'btn-danger px-4 py-1.5' : 'btn-primary px-4 py-1.5'}
          >
            {loading ? '…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
