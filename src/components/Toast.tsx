'use client';

import { useEffect } from 'react';
import { CheckCircle, AlertCircle, X } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface ToastData {
  id: number;
  message: string;
  type: 'success' | 'error';
}

interface Props {
  toasts: ToastData[];
  onDismiss: (id: number) => void;
}

export function ToastStack({ toasts, onDismiss }: Props) {
  return (
    <div className="fixed bottom-5 right-5 z-50 space-y-2 max-w-md w-full pointer-events-none" aria-live="polite">
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} onDismiss={onDismiss} />
      ))}
    </div>
  );
}

function ToastItem({ toast, onDismiss }: { toast: ToastData; onDismiss: (id: number) => void }) {
  useEffect(() => {
    const timer = setTimeout(() => onDismiss(toast.id), 4000);
    return () => clearTimeout(timer);
  }, [toast.id, onDismiss]);

  const isSuccess = toast.type === 'success';
  const Icon = isSuccess ? CheckCircle : AlertCircle;
  return (
    <div
      className={cn(
        'pointer-events-auto card flex items-start gap-3 px-4 py-3 shadow-2xl fade-in border-l-2',
        isSuccess ? 'border-l-[var(--success)]' : 'border-l-[var(--danger)]'
      )}
      role="alert"
    >
      <Icon
        size={16}
        className={cn('shrink-0 mt-0.5', isSuccess ? 'text-[var(--success)]' : 'text-[var(--danger)]')}
        strokeWidth={2.25}
      />
      <div className="flex-1 text-sm text-[var(--fg)] leading-snug">{toast.message}</div>
      <button
        onClick={() => onDismiss(toast.id)}
        className="text-[var(--fg-muted)] hover:text-[var(--fg)] transition-colors shrink-0"
        aria-label="Cerrar"
      >
        <X size={13} />
      </button>
    </div>
  );
}

let toastIdCounter = 0;
export function useToast() {
  const id = ++toastIdCounter;
  return id;
}
