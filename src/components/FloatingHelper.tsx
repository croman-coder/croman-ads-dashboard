'use client';

import { useEffect, useState } from 'react';
import { X, Sparkles } from 'lucide-react';

interface Props {
  /** Unique key for dismissal persistence */
  id: string;
  /** Title bold line */
  title: string;
  /** Body text */
  body: string;
  /** Optional accent emoji or short tag */
  tag?: string;
}

export function FloatingHelper({ id, title, body, tag = '✨' }: Props) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const dismissed = localStorage.getItem(`croman_ads_helper_${id}`);
    if (!dismissed) {
      const t = setTimeout(() => setOpen(true), 800);
      return () => clearTimeout(t);
    }
  }, [id]);

  function dismiss() {
    setOpen(false);
    localStorage.setItem(`croman_ads_helper_${id}`, '1');
  }

  if (!open) return null;
  return (
    <div className="fixed bottom-5 left-1/2 -translate-x-1/2 lg:left-auto lg:right-5 lg:translate-x-0 z-40 max-w-md w-[calc(100%-2rem)] pointer-events-auto fade-in">
      <div className="card-pop p-4 flex items-start gap-3 relative overflow-hidden">
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[oklch(0.52_0.22_278)] to-[oklch(0.62_0.26_330)] flex items-center justify-center shrink-0 mascot">
          <Sparkles size={18} className="text-white" strokeWidth={2.25} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] uppercase tracking-[0.16em] font-bold text-[var(--accent)] mb-1">{tag} Tip</p>
          <p className="text-[13px] font-semibold text-[var(--fg)] leading-snug">{title}</p>
          <p className="text-[12px] text-[var(--fg-muted)] mt-1 leading-relaxed">{body}</p>
        </div>
        <button
          onClick={dismiss}
          className="text-[var(--fg-muted)] hover:text-[var(--fg)] transition-colors shrink-0"
          aria-label="Cerrar"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
}
