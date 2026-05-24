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
  Sparkles,
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
    <aside className="hidden md:flex w-60 shrink-0 flex-col border-r border-[var(--border)] bg-[var(--bg-elevated)]/50 backdrop-blur-xl relative z-10">
      <div className="px-5 py-5 border-b border-[var(--border)]">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#6A77E0] to-[#3B47A8] flex items-center justify-center text-white font-black text-sm shadow-[0_4px_16px_rgba(94,106,210,0.45)]">
            C
          </div>
          <div>
            <div className="font-bold text-[15px] text-white leading-tight">Croman Ads</div>
            <div className="text-[10px] uppercase tracking-wider text-[var(--fg-muted)] mt-0.5">Santa Rosa PY</div>
          </div>
        </div>
      </div>
      <nav className="flex-1 px-2.5 py-3 space-y-0.5">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || (href !== '/' && pathname.startsWith(href));
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all duration-200 relative group',
                active
                  ? 'bg-gradient-to-r from-[#5E6AD2]/20 to-[#5E6AD2]/5 text-white border border-[var(--color-primary)]/30'
                  : 'text-[var(--fg-muted)] hover:text-white hover:bg-white/[0.04]'
              )}
            >
              {active && (
                <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 rounded-r bg-[var(--color-primary)] shadow-[0_0_12px_var(--color-primary)]" />
              )}
              <Icon size={16} className={active ? 'text-[var(--color-primary)]' : ''} />
              <span className="font-medium">{label}</span>
            </Link>
          );
        })}
      </nav>
      <div className="px-3 py-3 border-t border-[var(--border)]">
        <div className="rounded-lg bg-gradient-to-br from-[#5E6AD2]/10 to-transparent border border-[var(--border)] p-3">
          <div className="flex items-center gap-1.5 text-[11px] font-semibold text-white mb-1">
            <Sparkles size={12} className="text-[var(--color-accent)]" />
            v1.0
          </div>
          <div className="text-[10px] text-[var(--fg-muted)] leading-relaxed">
            Phase 5 · Auth + UI premium
          </div>
        </div>
      </div>
    </aside>
  );
}
