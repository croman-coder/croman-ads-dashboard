'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { X, Sparkles } from 'lucide-react';

/**
 * Floating animated assistant orb. Reacts to route changes with a
 * context tip. Idle breathing animation. Dismissible per tip.
 */

const TIPS: Record<string, { title: string; body: string }> = {
  '/': { title: 'Panel general', body: 'Acá ves KPIs consolidados. Usá el rango de fechas arriba para comparar períodos.' },
  '/pixel': { title: 'Pixel & CAPI', body: 'Verde = pixel entregando eventos. Activá CAPI server-side para cerrar attribution de ventas.' },
  '/audience/intelligence': { title: 'Público objetivo', body: 'Los 3 públicos recomendados tienen mejor CPL. Tocá "Usar en campaña" para arrancar con ellos.' },
  '/budgets': { title: 'Presupuestos', body: 'Por defecto solo ves los que ENTREGAN. Cambios son inmediatos — ojo el tope $1000.' },
  '/campaigns': { title: 'Campañas', body: 'Filtrá por Entregando para ver solo lo que corre hoy. Click una card para el detalle.' },
  '/integrations': { title: 'Integraciones', body: 'Meta ya conectado. TikTok y Google llegan pronto.' },
  '/creative/new': { title: 'Crear con IA', body: 'Describí la pauta en lenguaje natural + subí materiales. La IA arma los copys.' },
  '/approvals': { title: 'Aprobaciones', body: 'Toda mutación riesgosa cae acá antes de tocar Meta. Nada se publica sin tu OK.' },
};

export function FloatingAgent() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [tip, setTip] = useState<{ title: string; body: string } | null>(null);
  const [pulse, setPulse] = useState(false);
  const lastPath = useRef<string>('');

  useEffect(() => {
    const t = TIPS[pathname];
    if (!t) { setTip(null); return; }
    if (lastPath.current === pathname) return;
    lastPath.current = pathname;
    const dismissed = typeof window !== 'undefined' && sessionStorage.getItem(`agent_tip_${pathname}`);
    setTip(t);
    setPulse(true);
    const pt = setTimeout(() => setPulse(false), 2400);
    if (!dismissed) {
      const ot = setTimeout(() => setOpen(true), 1000);
      return () => { clearTimeout(pt); clearTimeout(ot); };
    }
    return () => clearTimeout(pt);
  }, [pathname]);

  function dismiss() {
    setOpen(false);
    if (tip && typeof window !== 'undefined') sessionStorage.setItem(`agent_tip_${pathname}`, '1');
  }

  if (pathname === '/login') return null;

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3 pointer-events-none">
      {open && tip && (
        <div className="glass p-4 max-w-xs pointer-events-auto fade-in mr-1">
          <div className="flex items-start gap-2">
            <Sparkles size={14} className="text-[var(--accent)] shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-semibold text-[var(--fg)]">{tip.title}</p>
              <p className="text-[12px] text-[var(--fg-soft)] mt-1 leading-relaxed">{tip.body}</p>
            </div>
            <button onClick={dismiss} className="text-[var(--fg-muted)] hover:text-[var(--fg)] shrink-0" aria-label="Cerrar">
              <X size={13} />
            </button>
          </div>
        </div>
      )}

      {/* Orb */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="pointer-events-auto relative w-14 h-14 rounded-full flex items-center justify-center transition-transform hover:scale-105 active:scale-95"
        style={{
          background: 'radial-gradient(circle at 30% 30%, oklch(0.72 0.23 278), oklch(0.55 0.24 300) 60%, oklch(0.45 0.22 320))',
          boxShadow: '0 8px 32px oklch(0.62 0.22 278 / 0.5), inset 0 2px 6px rgba(255,255,255,0.3)',
        }}
        aria-label="Asistente"
      >
        {/* Breathing rings */}
        <span className="absolute inset-0 rounded-full animate-orb-pulse" style={{ background: 'oklch(0.62 0.22 278 / 0.4)' }} />
        {pulse && <span className="absolute inset-0 rounded-full animate-orb-ping" style={{ background: 'oklch(0.62 0.22 278 / 0.3)' }} />}
        <Sparkles size={20} className="text-white relative z-10" />
      </button>
    </div>
  );
}
