'use client';

import { useEffect, useState } from 'react';
import { ChevronDown, RefreshCw } from 'lucide-react';

type Account = { id: string; name: string; currency: string };

interface Props {
  selected: string;
  onSelect: (id: string) => void;
}

export function TopBar({ selected, onSelect }: Props) {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <header className="sticky top-0 z-10 bg-white border-b border-[var(--color-border)]">
      <div className="flex items-center justify-between px-6 py-3">
        <div className="flex items-center gap-3">
          <div className="text-sm text-slate-500">Cuenta</div>
          <div className="relative">
            <select
              value={selected}
              onChange={(e) => onSelect(e.target.value)}
              className="appearance-none bg-[var(--color-muted)] text-slate-800 text-sm font-medium pl-3 pr-9 py-2 rounded border border-[var(--color-border)] cursor-pointer min-w-[280px] hover:bg-white transition-colors"
              disabled={loading || accounts.length === 0}
            >
              {accounts.length === 0 && <option>{loading ? 'Cargando…' : 'Sin cuentas'}</option>}
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name} ({a.currency})
                </option>
              ))}
            </select>
            <ChevronDown size={16} className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500" />
          </div>
          {error && <div className="text-xs text-[var(--color-destructive)]">{error}</div>}
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={load}
            disabled={loading}
            className="flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900 transition-colors"
            aria-label="Recargar cuentas"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            <span className="hidden sm:inline">Recargar</span>
          </button>
        </div>
      </div>
    </header>
  );
}
