'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Mail, Lock, ArrowRight, Loader2, ShieldCheck } from 'lucide-react';

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get('next') || '/';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Redirect if already logged in
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
    <div className="min-h-screen flex items-center justify-center px-4 py-10 relative overflow-hidden">
      <div className="orb orb-1" />
      <div className="orb orb-2" />
      <div className="orb orb-3" />

      <div className="relative w-full max-w-md z-10 fade-in">
        {/* Brand */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#6A77E0] to-[#3B47A8] flex items-center justify-center text-white text-2xl font-black shadow-[0_8px_32px_rgba(94,106,210,0.45)] mb-4 fade-in">
            C
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-white">Croman Ads</h1>
          <p className="text-sm text-[var(--fg-muted)] mt-1">Santa Rosa Paraguay · Panel de gestión</p>
        </div>

        {/* Card */}
        <div className="glass-strong rounded-2xl p-7">
          <h2 className="text-lg font-semibold text-white mb-1">Bienvenido</h2>
          <p className="text-sm text-[var(--fg-muted)] mb-6">Inicia sesión para continuar</p>

          <form onSubmit={submit} className="space-y-4">
            <div>
              <label className="text-[11px] font-semibold uppercase tracking-wider text-[var(--fg-muted)] block mb-1.5">
                Email
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--fg-faint)]" size={16} />
                <input
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="croman@santarosa.com.py"
                  className="w-full pl-10 pr-3 py-2.5 bg-[var(--bg-deep)] border border-[var(--border)] rounded-lg text-sm text-white placeholder:text-[var(--fg-faint)] focus:outline-none focus:border-[var(--color-primary)] transition-colors"
                />
              </div>
            </div>

            <div>
              <label className="text-[11px] font-semibold uppercase tracking-wider text-[var(--fg-muted)] block mb-1.5">
                Contraseña
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--fg-faint)]" size={16} />
                <input
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-3 py-2.5 bg-[var(--bg-deep)] border border-[var(--border)] rounded-lg text-sm text-white placeholder:text-[var(--fg-faint)] focus:outline-none focus:border-[var(--color-primary)] transition-colors"
                />
              </div>
            </div>

            {error && (
              <div className="bg-red-500/10 border border-red-500/30 text-red-300 text-sm px-3 py-2 rounded-lg">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full py-2.5 rounded-lg text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-60"
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

          <div className="mt-5 pt-4 border-t border-[var(--border)] flex items-center gap-2 text-[11px] text-[var(--fg-muted)]">
            <ShieldCheck size={12} />
            Sesión cifrada · JWT HttpOnly · 7 días
          </div>
        </div>

        <div className="text-center text-[11px] text-[var(--fg-faint)] mt-6">
          © {new Date().getFullYear()} Croman Ads · Santa Rosa PY
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
