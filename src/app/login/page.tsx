'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Mail, Lock, ArrowRight, Loader2, ShieldCheck, Eye, EyeOff } from 'lucide-react';

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get('next') || '/';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/auth/session').then((r) => r.json()).then((j) => {
      if (j.authenticated) router.replace(next);
    });
  }, [router, next]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const r = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const j = await r.json();
      if (!r.ok || j.error) throw new Error(j.error || 'Error');
      router.replace(next);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      {/* Left — editorial cover with vivid aurora wash */}
      <div className="hidden lg:flex flex-col justify-between p-12 border-r border-[var(--hairline)] relative overflow-hidden"
           style={{ background: 'linear-gradient(135deg, #fafaf6 0%, #ffffff 60%, oklch(0.52 0.22 278 / 0.06) 100%)' }}>
        <div className="absolute inset-0 pointer-events-none"
             style={{ backgroundImage: 'radial-gradient(ellipse 60% 50% at 100% 0%, oklch(0.62 0.26 330 / 0.15), transparent 60%), radial-gradient(ellipse 60% 50% at 0% 100%, oklch(0.72 0.18 200 / 0.12), transparent 60%)' }} />
        <div className="relative z-10">
          <div className="bg-[var(--fg)] inline-flex px-3 py-2 rounded-md">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="Santa Rosa" className="h-7 w-auto object-contain" />
          </div>
        </div>
        <div className="relative z-10">
          <p className="text-[11px] uppercase tracking-[0.16em] text-[var(--fg-muted)] mb-3">Santa Rosa Paraguay</p>
          <h1 className="display text-6xl text-[var(--fg)] leading-[0.95] max-w-md">
            Gestión<br />de pautas<br /><span className="text-[var(--accent)] italic">precisa.</span>
          </h1>
          <p className="text-sm text-[var(--fg-muted)] mt-6 max-w-sm leading-relaxed">
            Panel para administrar campañas Meta Ads de la red de concesionarias.
            Auditoría, optimización y reporte en una sola interfaz.
          </p>
        </div>
        <div className="relative z-10 flex items-center gap-2 text-[11px] text-[var(--fg-faint)]">
          <ShieldCheck size={12} />
          Sesión cifrada · JWT HttpOnly · Rate-limited
        </div>
      </div>

      {/* Right — form */}
      <div className="flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm fade-in">
          <div className="lg:hidden mb-8 bg-[var(--fg)] inline-flex px-3 py-2 rounded-md">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="Santa Rosa" className="h-7 w-auto object-contain" />
          </div>

          <p className="text-[11px] uppercase tracking-[0.16em] text-[var(--fg-muted)] mb-2">Acceso</p>
          <h2 className="display text-4xl text-[var(--fg)] mb-2">Ingresá</h2>
          <p className="text-sm text-[var(--fg-muted)] mb-8">Usá tu cuenta autorizada para continuar.</p>

          <form onSubmit={submit} className="space-y-5">
            <div>
              <label className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--fg-muted)] block mb-1.5">
                Email
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--fg-faint)]" size={15} />
                <input
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="nombre@santarosa.com.py"
                  className="w-full pl-10 pr-3 py-2.5 bg-[var(--bg-deep)] border border-[var(--hairline)] rounded text-sm text-[var(--fg)] placeholder:text-[var(--fg-faint)] focus:outline-none focus:border-[var(--accent)] transition-colors"
                />
              </div>
            </div>

            <div>
              <label className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--fg-muted)] block mb-1.5">
                Contraseña
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--fg-faint)]" size={15} />
                <input
                  type={showPwd ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-10 py-2.5 bg-[var(--bg-deep)] border border-[var(--hairline)] rounded text-sm text-[var(--fg)] placeholder:text-[var(--fg-faint)] focus:outline-none focus:border-[var(--accent)] transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPwd((v) => !v)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded text-[var(--fg-muted)] hover:text-[var(--fg)] hover:bg-[var(--surface)] transition-colors"
                  aria-label={showPwd ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                  tabIndex={-1}
                >
                  {showPwd ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>

            {error && (
              <div className="bg-[oklch(0.65_0.20_25_/_0.08)] border border-[var(--danger)] text-[var(--danger)] text-sm px-3 py-2 rounded">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full py-2.5 rounded text-sm flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {loading ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <>
                  Iniciar sesión <ArrowRight size={16} />
                </>
              )}
            </button>
          </form>

          <div className="mt-8 pt-6 border-t border-[var(--hairline)] text-[11px] text-[var(--fg-faint)]">
            © {new Date().getFullYear()} Santa Rosa Paraguay
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-[var(--fg-muted)]">Cargando…</div>}>
      <LoginForm />
    </Suspense>
  );
}
