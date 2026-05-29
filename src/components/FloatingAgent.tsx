'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { X, Sparkles, Send } from 'lucide-react';

/**
 * ALE-style floating assistant. Orb button opens a side chat panel.
 * Scripted (rule-based) replies: contextual tips per route, quick actions.
 * No LLM cost — instant. LLM wiring is a later phase.
 */

type Msg = { from: 'agent' | 'user'; text: string; ts: string };
type QuickAction = { label: string; href?: string; reply?: string };

const ROUTE_GREETING: Record<string, string> = {
  '/': 'Estás en el panel general. Te muestro KPIs consolidados de la cuenta activa. ¿Querés comparar períodos o ver el público objetivo?',
  '/pixel': 'Acá ves la salud del pixel. Verde = entregando eventos. ¿Necesitás activar CAPI server-side para cerrar attribution de ventas?',
  '/audience/intelligence': 'Te muestro quién convierte mejor por cuenta. Los públicos recomendados tienen el CPL más bajo. ¿Querés usarlos en una campaña?',
  '/budgets': 'Por defecto solo ves lo que ENTREGA hoy. Cambios de presupuesto son inmediatos — ojo el tope de USD 1000.',
  '/campaigns': 'Tus campañas. Filtrá por Entregando para ver solo lo que corre. ¿Buscás una en particular?',
  '/integrations': 'Meta ya está conectado vía System User. TikTok y Google llegan pronto.',
  '/creative/new': 'Describí la pauta en lenguaje natural + subí materiales. Yo armo los copys con IA.',
  '/onboarding': 'Configurá tu negocio en 4 pasos. Eso alimenta la IA al generar pautas. ¿Empezamos por "¿Qué ofrecés?"?',
  '/approvals': 'Toda mutación riesgosa cae acá antes de tocar Meta. Nada se publica sin tu OK.',
  '/settings': 'Gestioná tu perfil, usuarios y permisos por cuenta. ¿Buscás invitar a alguien?',
};

const ROUTE_ACTIONS: Record<string, QuickAction[]> = {
  '/': [
    { label: 'Ver público objetivo', href: '/audience/intelligence' },
    { label: 'Crear pauta con IA', href: '/creative/new' },
  ],
  '/pixel': [{ label: '¿Cómo activo CAPI?', reply: 'Las ventas del CRM se mandan a /api/capi/event. El server hashea email/teléfono con SHA256 antes de Meta — el dato crudo nunca se guarda. Cerrás attribution post-iOS.' }],
  '/audience/intelligence': [{ label: 'Crear campaña', href: '/creative/new' }],
  '/budgets': [{ label: 'Ver campañas', href: '/campaigns' }],
  '/onboarding': [{ label: 'Ir a integraciones', href: '/integrations' }, { label: 'Crear pauta', href: '/creative/new' }],
  '/integrations': [{ label: 'Configurar negocio', href: '/onboarding' }],
};

const FAQ: Array<{ q: RegExp; a: string }> = [
  { q: /capi|conversion|pixel/i, a: 'El pixel mide eventos web (PageView, Lead, Purchase). CAPI server-side manda las ventas del CRM a Meta con PII hasheada SHA256, cerrando attribution post-iOS. Andá a /pixel para ver la salud.' },
  { q: /lookalike|lal/i, a: 'Lookalikes se crean desde una audiencia semilla (idealmente lista de compradores). Próximamente desde el módulo de audiencias.' },
  { q: /retarget|remarket|audiencia/i, a: 'Podés crear audiencias custom desde pixel, engagement IG/FB, lead forms o lista de clientes. Todo pasa por aprobación antes de tocar Meta.' },
  { q: /cpl|costo.*lead/i, a: 'El CPL = inversión / leads. En /audience/intelligence te muestro qué segmentos tienen el CPL más bajo por cuenta.' },
  { q: /presupuesto|budget|tope/i, a: 'El tope de presupuesto es USD 1000. Los cambios son inmediatos pero los riesgosos pasan por /approvals primero.' },
  { q: /aprob|approval/i, a: 'Activar campañas, subir presupuesto y crear audiencias caen en /approvals. Nada llega a Meta sin tu confirmación.' },
  { q: /hola|buenas|hey/i, a: '¡Hola! Soy tu asistente. Preguntame sobre pixel, audiencias, CPL, presupuestos o aprobaciones.' },
];

function now() {
  return new Date().toLocaleTimeString('es-PY', { hour: '2-digit', minute: '2-digit' });
}

export function FloatingAgent() {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [pulse, setPulse] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const seeded = useRef(false);

  // Seed greeting on first open per route
  useEffect(() => {
    if (!open) return;
    if (seeded.current) return;
    seeded.current = true;
    const greet = ROUTE_GREETING[pathname] || 'Soy tu asistente de Croman Ads. ¿En qué te ayudo?';
    setMsgs([{ from: 'agent', text: greet, ts: now() }]);
  }, [open, pathname]);

  // Pulse on route change
  useEffect(() => {
    setPulse(true);
    const t = setTimeout(() => setPulse(false), 2400);
    return () => clearTimeout(t);
  }, [pathname]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [msgs]);

  function reply(text: string) {
    const hit = FAQ.find((f) => f.q.test(text));
    const answer = hit ? hit.a : 'No tengo respuesta exacta para eso todavía. Probá preguntar sobre pixel, audiencias, CPL, presupuesto o aprobaciones.';
    setTimeout(() => setMsgs((m) => [...m, { from: 'agent', text: answer, ts: now() }]), 400);
  }

  function send(text: string) {
    if (!text.trim()) return;
    setMsgs((m) => [...m, { from: 'user', text, ts: now() }]);
    setInput('');
    reply(text);
  }

  function quick(a: QuickAction) {
    if (a.href) { router.push(a.href); setOpen(false); return; }
    setMsgs((m) => [...m, { from: 'user', text: a.label, ts: now() }]);
    if (a.reply) setTimeout(() => setMsgs((m) => [...m, { from: 'agent', text: a.reply as string, ts: now() }]), 400);
  }

  if (pathname === '/login') return null;
  const actions = ROUTE_ACTIONS[pathname] || [];

  return (
    <>
      {/* Chat panel */}
      {open && (
        <div className="fixed top-0 right-0 bottom-0 w-full sm:w-[400px] z-50 flex flex-col glass border-l border-[rgba(255,255,255,0.1)] fade-in">
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--hairline)]">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full flex items-center justify-center" style={{ background: 'radial-gradient(circle at 30% 30%, oklch(0.72 0.23 278), oklch(0.50 0.24 320))' }}>
                <Sparkles size={16} className="text-white" />
              </div>
              <div>
                <div className="text-[14px] font-semibold text-[var(--fg)]">Asistente</div>
                <div className="text-[11px] text-[var(--success)] flex items-center gap-1.5"><span className="dot dot-success" /> En línea</div>
              </div>
            </div>
            <button onClick={() => setOpen(false)} className="text-[var(--fg-muted)] hover:text-[var(--fg)]" aria-label="Cerrar">
              <X size={18} />
            </button>
          </div>

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
            <div className="text-center"><span className="text-[10px] uppercase tracking-[0.14em] text-[var(--fg-faint)] bg-[var(--surface)] px-2 py-0.5 rounded-full">Hoy</span></div>
            {msgs.map((m, i) => (
              <div key={i} className={`flex ${m.from === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[80%] px-3.5 py-2.5 text-[13px] leading-relaxed ${
                  m.from === 'user'
                    ? 'bg-[var(--accent)] text-white rounded-2xl rounded-br-sm'
                    : 'bg-[var(--bg-elevated-2)] text-[var(--fg-soft)] rounded-2xl rounded-bl-sm'
                }`}>
                  {m.text}
                  <div className={`text-[9px] mt-1 ${m.from === 'user' ? 'text-white/60' : 'text-[var(--fg-faint)]'}`}>{m.ts}</div>
                </div>
              </div>
            ))}

            {/* Quick actions */}
            {actions.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-2">
                {actions.map((a, i) => (
                  <button key={i} onClick={() => quick(a)} className="text-[12px] px-3 py-1.5 rounded-full border border-[var(--accent)]/40 bg-[var(--accent-soft)] text-[var(--accent)] hover:bg-[var(--accent)] hover:text-white transition-colors">
                    {a.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Input */}
          <div className="px-4 py-3 border-t border-[var(--hairline)]">
            <div className="flex items-center gap-2 bg-[var(--bg-elevated-2)] border border-[var(--border)] rounded-full px-3 py-1.5">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') send(input); }}
                placeholder="Escribí tu mensaje…"
                className="flex-1 bg-transparent text-[13px] text-[var(--fg)] placeholder:text-[var(--fg-faint)] focus:outline-none"
              />
              <button onClick={() => send(input)} disabled={!input.trim()} className="w-7 h-7 rounded-full bg-[var(--accent)] text-white flex items-center justify-center disabled:opacity-40">
                <Send size={13} />
              </button>
            </div>
            <p className="text-[10px] text-[var(--fg-faint)] text-center mt-1.5">Enter para enviar</p>
          </div>
        </div>
      )}

      {/* Orb button */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full flex items-center justify-center transition-transform hover:scale-105 active:scale-95"
          style={{
            background: 'radial-gradient(circle at 30% 30%, oklch(0.72 0.23 278), oklch(0.55 0.24 300) 60%, oklch(0.45 0.22 320))',
            boxShadow: '0 8px 32px oklch(0.62 0.22 278 / 0.5), inset 0 2px 6px rgba(255,255,255,0.3)',
          }}
          aria-label="Abrir asistente"
        >
          <span className="absolute inset-0 rounded-full animate-orb-pulse" style={{ background: 'oklch(0.62 0.22 278 / 0.4)' }} />
          {pulse && <span className="absolute inset-0 rounded-full animate-orb-ping" style={{ background: 'oklch(0.62 0.22 278 / 0.3)' }} />}
          <Sparkles size={20} className="text-white relative z-10" />
        </button>
      )}
    </>
  );
}
