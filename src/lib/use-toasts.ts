'use client';

import { useState, useCallback } from 'react';
import type { ToastData } from '@/components/Toast';

let counter = 0;

export function useToasts() {
  const [toasts, setToasts] = useState<ToastData[]>([]);

  const push = useCallback((message: string, type: 'success' | 'error' = 'success') => {
    const id = ++counter;
    setToasts((prev) => [...prev, { id, message, type }]);
  }, []);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return { toasts, push, dismiss };
}
