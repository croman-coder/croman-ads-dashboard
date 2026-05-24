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
    <div className="fixed bottom-4 right-4 z-50 space-y-2" aria-live="polite">
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

  const Icon = toast.type === 'success' ? CheckCircle : AlertCircle;
  return (
    <div
      className={cn(
        'flex items-start gap-2 px-4 py-3 rounded shadow-md border max-w-md',
        toast.type === 'success'
          ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
          : 'bg-red-50 border-red-200 text-red-800'
      )}
      role="alert"
    >
      <Icon size={18} className="shrink-0 mt-0.5" />
      <div className="flex-1 text-sm">{toast.message}</div>
      <button onClick={() => onDismiss(toast.id)} className="text-slate-500 hover:text-slate-700">
        <X size={14} />
      </button>
    </div>
  );
}

let toastIdCounter = 0;
export function useToast() {
  // simple state hook bundled inline so callers stay terse
  const id = ++toastIdCounter;
  return id;
}
