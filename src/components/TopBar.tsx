'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronDown, RefreshCw, LogOut, User } from 'lucide-react';

type Account = { id: string; name: string; currency: string };

interface Props {
  selected: string;
  onSelect: (id: string) => void;
}

export function TopBar({ selected, onSelect }: Props) {
  const router = useRouter();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [email, setEmail] = useState('');
  const menuRef = useRef<HTMLDivElement>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch('/api/accounts');
      const j = await r.json();
      if (j.error) throw new Error(j.error);
      setAccounts(j.data || []);
      if (!selected && j.data?.[0]) onSelect(j.data[0].id);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    fetch('/api/auth/session').then((r) => r.json()).then((j) => {
      if (j.authenticated) setEmail(j.email);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    function close(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    }
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.replace('/login');
  }

  const initial = email ? email[0].toUpperCase() : 'U';

  return (
    <header className="sticky top-0 z-20 bg-[var(--bg-base)] border-b border-[var(--hairline)]">
      <div className="flex items-center justify-between px-8 py-3 gap-4">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div className="text-[10px] uppercase tracking-[0.16em] text-[var(--fg-muted)] font-semibold whitespace-nowrap">
            Cuenta activa
          </div>
          <div className="relative min-w-0 flex-1 max-w-md">
            <select
              value={selected}
              onChange={(e) => onSelect(e.target.value)}
              className="appearance-none w-full bg-[var(--surface)] text-[var(--fg)] text-sm font-medium pl-3 pr-9 py-2 rounded border border-[var(--hairline)] cursor-pointer hover:border-[var(--border-strong)] transition-colors"
              disabled={loading || accounts.length === 0}
            >
              {accounts.length === 0 && <option>{loading ? 'Cargando…' : 'Sin cuentas'}</option>}
              {accounts.map((a) => (
                <option key={a.id} value={a.id} className="bg-[var(--bg-elevated)]">
                  {a.name} ({a.currency})
                </option>
              ))}
            </select>
            <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-[var(--fg-muted)]" />
          </div>
          {error && <div className="text-xs text-[var(--danger)] truncate max-w-xs">{error}</div>}
        </div>

        <div className="flex items-center gap-4 shrink-0">
          <button
            onClick={load}
            disabled={loading}
            className="flex items-center gap-1.5 text-xs text-[var(--fg-muted)] hover:text-[var(--fg)] transition-colors"
            aria-label="Recargar cuentas"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            <span className="hidden sm:inline">Recargar</span>
          </button>

          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setMenuOpen((v) => !v)}
              className="w-9 h-9 rounded-md bg-[var(--accent)] text-[var(--accent-fg)] flex items-center justify-center font-bold text-sm hover:brightness-110 transition-all"
              aria-label="Menú usuario"
            >
              {initial}
            </button>
            {menuOpen && (
              <div className="absolute right-0 top-12 w-64 card shadow-2xl z-30 overflow-hidden fade-in">
                <div className="px-4 py-3 border-b border-[var(--hairline)]">
                  <div className="flex items-center gap-2.5">
                    <User size={14} className="text-[var(--fg-muted)]" />
                    <div className="min-w-0 flex-1">
                      <div className="text-[10px] uppercase tracking-[0.12em] text-[var(--fg-muted)]">Sesión activa</div>
                      <div className="text-sm text-[var(--fg)] font-medium truncate mt-0.5">{email || '—'}</div>
                    </div>
                  </div>
                </div>
                <button
                  onClick={logout}
                  className="w-full px-4 py-3 flex items-center gap-2 text-sm text-[var(--danger)] hover:bg-[oklch(0.65_0.20_25_/_0.08)] transition-colors"
                >
                  <LogOut size={14} />
                  Cerrar sesión
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
