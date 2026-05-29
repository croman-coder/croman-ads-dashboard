'use client';

import { useEffect, useState } from 'react';
import { Sidebar } from '@/components/Sidebar';
import { TopBar } from '@/components/TopBar';
import { useAccount } from '@/lib/use-account';
import { ToastStack } from '@/components/Toast';
import { useToasts } from '@/lib/use-toasts';
import { CheckCircle2, Plug, Camera, Users as UsersIcon, MessageCircle, Music2, PlaySquare, Search as SearchIcon, Loader2 } from 'lucide-react';

type Integration = {
  id: string;
  name: string;
  channels: string[];
  connected: boolean;
  accounts: number;
  status: 'connected' | 'soon' | 'error';
  error?: string;
};

const CHANNEL_ICON: Record<string, { icon: typeof Camera; color: string }> = {
  instagram: { icon: Camera, color: 'oklch(0.65 0.25 350)' },
  facebook: { icon: UsersIcon, color: 'oklch(0.60 0.20 250)' },
  whatsapp: { icon: MessageCircle, color: 'oklch(0.72 0.18 150)' },
  tiktok: { icon: Music2, color: 'oklch(0.85 0.05 200)' },
  youtube: { icon: PlaySquare, color: 'oklch(0.62 0.24 25)' },
  google: { icon: SearchIcon, color: 'oklch(0.78 0.16 90)' },
};

export default function IntegrationsPage() {
  const { account, setAccount } = useAccount();
  const { toasts, push, dismiss } = useToasts();
  const [items, setItems] = useState<Integration[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/integrations/status')
      .then((r) => r.json())
      .then((j) => setItems(j.integrations || []))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex-1 flex flex-col">
        <TopBar selected={account} onSelect={setAccount} />
        <main className="flex-1 px-8 py-8 max-w-[1300px] mx-auto w-full space-y-8">
          <header className="fade-in">
            <p className="eyebrow mb-1 flex items-center gap-1.5"><Plug size={12} className="text-[var(--accent)]" /> Explora</p>
            <h1 className="display text-5xl">Integraciones disponibles.</h1>
            <p className="text-sm text-[var(--fg-muted)] mt-2">Conectá tus fuentes externas en un solo lugar.</p>
          </header>

          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {[0, 1, 2].map((i) => (
                <div key={i} className="card p-6 h-64 animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5 stagger">
              {items.map((it) => (
                <article key={it.id} className="card lift p-6 flex flex-col">
                  <div className="flex items-start justify-between mb-4">
                    <div className="w-12 h-12 rounded-xl glass flex items-center justify-center text-[var(--fg)] font-bold text-lg">
                      {it.name[0]}
                    </div>
                    {it.status === 'connected' && (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] uppercase tracking-[0.1em] font-bold bg-[oklch(0.74_0.19_150_/_0.15)] text-[var(--success)] border border-[oklch(0.74_0.19_150_/_0.4)]">
                        <CheckCircle2 size={11} /> Conectado
                      </span>
                    )}
                    {it.status === 'soon' && (
                      <span className="px-2.5 py-1 rounded-full text-[10px] uppercase tracking-[0.1em] font-bold bg-[var(--surface-2)] text-[var(--fg-muted)] border border-[var(--border)]">
                        Pronto
                      </span>
                    )}
                  </div>

                  {/* Channel chips */}
                  <div className="flex items-center gap-2 mb-4">
                    {it.channels.map((ch) => {
                      const cfg = CHANNEL_ICON[ch];
                      if (!cfg) return null;
                      const Icon = cfg.icon;
                      return (
                        <div key={ch} className="w-7 h-7 rounded-full flex items-center justify-center" style={{ background: `color-mix(in oklch, ${cfg.color} 18%, transparent)` }}>
                          <Icon size={14} style={{ color: cfg.color }} />
                        </div>
                      );
                    })}
                  </div>

                  <h2 className="text-lg font-semibold text-[var(--fg)]">{it.name}</h2>
                  <p className="text-[13px] text-[var(--fg-muted)] mt-1 flex-1">
                    {it.id === 'meta' && 'Conectá Meta para traer tus cuentas y permisos en un solo lugar.'}
                    {it.id === 'tiktok' && 'Conectá TikTok para autorizar acceso a tus activos y permisos.'}
                    {it.id === 'google' && 'Conectá Google Ads para sincronizar cuentas y permisos.'}
                  </p>

                  {/* Asset bar */}
                  <div className="mt-4">
                    <div className="eyebrow mb-1.5">Activos configurados</div>
                    <div className="flex items-center gap-1">
                      {Array.from({ length: 6 }).map((_, i) => (
                        <div
                          key={i}
                          className="h-1 flex-1 rounded-full"
                          style={{ background: it.connected && i < Math.min(6, Math.ceil(it.accounts / 14)) ? 'var(--success)' : 'var(--border)' }}
                        />
                      ))}
                    </div>
                    {it.connected && (
                      <div className="text-[10px] text-[var(--fg-muted)] mt-1 font-[family-name:var(--font-mono)]">{it.accounts} cuentas</div>
                    )}
                  </div>

                  <button
                    onClick={() => {
                      if (it.status === 'soon') return;
                      push(it.connected ? 'Meta conectado vía System User token' : 'Revisar token en Ajustes → Meta API', it.connected ? 'success' : 'error');
                    }}
                    disabled={it.status === 'soon'}
                    className={`mt-5 w-full py-2.5 rounded-lg text-sm font-medium transition-all ${
                      it.status === 'soon'
                        ? 'bg-[var(--surface)] text-[var(--fg-faint)] cursor-not-allowed'
                        : 'btn-glass'
                    }`}
                  >
                    {it.status === 'soon' ? 'Próximamente' : it.connected ? 'Ver detalles' : 'Conectar'}
                  </button>
                </article>
              ))}
            </div>
          )}

          {/* Setup guide card */}
          <section className="glass p-6">
            <div className="eyebrow mb-3 flex items-center gap-1.5"><Loader2 size={11} className="text-[var(--accent)]" /> Guía de conexión Meta</div>
            <ol className="text-[13px] text-[var(--fg-soft)] space-y-1.5 list-decimal pl-5">
              <li>Business Manager → Usuarios del sistema → crear System User (ej. VALEN_ADS)</li>
              <li>Asignar cada cuenta publicitaria con permiso &quot;Administrar campañas&quot;</li>
              <li>Generar token con scopes ads_management, ads_read, business_management, leads_retrieval</li>
              <li>Pegar token en Ajustes → Meta API (o env META_ACCESS_TOKEN). System User token no expira.</li>
            </ol>
          </section>
        </main>
      </div>
      <ToastStack toasts={toasts} onDismiss={dismiss} />
    </div>
  );
}
