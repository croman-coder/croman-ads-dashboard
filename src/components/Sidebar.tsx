'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Megaphone,
  Image as ImageIcon,
  Users,
  Wallet,
  BarChart3,
  Settings,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const NAV = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/campaigns', label: 'Campañas', icon: Megaphone },
  { href: '/ads', label: 'Anuncios', icon: ImageIcon },
  { href: '/audience', label: 'Audiencia', icon: Users },
  { href: '/budgets', label: 'Presupuestos', icon: Wallet },
  { href: '/analytics', label: 'Analítica', icon: BarChart3 },
  { href: '/settings', label: 'Ajustes', icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  return (
    <aside className="hidden md:flex w-60 shrink-0 flex-col border-r border-[var(--color-border)] bg-white">
      <div className="px-5 py-5 border-b border-[var(--color-border)]">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded bg-[var(--color-primary)] grid place-items-center text-white font-bold text-sm">
            C
          </div>
          <div className="font-semibold text-[15px] text-[var(--color-primary)]">Croman Ads</div>
        </div>
        <div className="text-[11px] uppercase tracking-wider text-slate-500 mt-3">Santa Rosa PY</div>
      </div>
      <nav className="flex-1 px-2 py-3 space-y-0.5">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || (href !== '/' && pathname.startsWith(href));
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center gap-3 px-3 py-2 rounded text-sm transition-colors duration-150',
                active
                  ? 'bg-[var(--color-primary)] text-white'
                  : 'text-slate-700 hover:bg-[var(--color-muted)]'
              )}
            >
              <Icon size={16} />
              <span>{label}</span>
            </Link>
          );
        })}
      </nav>
      <div className="px-3 py-3 border-t border-[var(--color-border)] text-[11px] text-slate-500">
        v0.1 · {new Date().getFullYear()}
      </div>
    </aside>
  );
}
