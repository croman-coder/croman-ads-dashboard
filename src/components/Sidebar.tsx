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
  Bell,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAlertCount } from '@/lib/use-alerts';

const NAV = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/alerts', label: 'Alertas', icon: Bell, showBadge: true },
  { href: '/campaigns', label: 'Campañas', icon: Megaphone },
  { href: '/ads', label: 'Anuncios', icon: ImageIcon },
  { href: '/audience', label: 'Audiencia', icon: Users },
  { href: '/budgets', label: 'Presupuestos', icon: Wallet },
  { href: '/analytics', label: 'Analítica', icon: BarChart3 },
  { href: '/settings', label: 'Ajustes', icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const alertCount = useAlertCount();

  return (
    <aside className="hidden md:flex w-60 shrink-0 flex-col border-r border-[var(--hairline)] bg-[var(--bg-base)] relative z-10">
      <div className="px-5 py-5 border-b border-[var(--hairline)]">
        <Link href="/" className="flex items-center gap-2.5 group">
          <div className="w-9 h-9 rounded-md bg-[var(--accent)] text-[var(--accent-fg)] flex items-center justify-center font-black text-base shrink-0">
            C
          </div>
          <div>
            <div className="font-semibold text-[14px] text-[var(--fg)] leading-tight">Croman Ads</div>
            <div className="text-[10px] uppercase tracking-[0.12em] text-[var(--fg-muted)] mt-0.5">Santa Rosa PY</div>
          </div>
        </Link>
      </div>
      <nav className="flex-1 px-2 py-3 space-y-px">
        {NAV.map(({ href, label, icon: Icon, showBadge }) => {
          const active = pathname === href || (href !== '/' && pathname.startsWith(href));
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center gap-3 px-3 py-2 rounded-md text-[13px] transition-colors duration-150 relative',
                active
                  ? 'bg-[var(--accent-soft)] text-[var(--fg)]'
                  : 'text-[var(--fg-soft)] hover:text-[var(--fg)] hover:bg-[var(--surface)]'
              )}
            >
              <Icon size={15} strokeWidth={active ? 2.25 : 2} className={active ? 'text-[var(--accent)]' : 'text-[var(--fg-muted)]'} />
              <span className="font-medium flex-1">{label}</span>
              {showBadge && alertCount > 0 && (
                <span className="bg-[var(--danger)] text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full leading-none min-w-[18px] text-center">
                  {alertCount > 99 ? '99+' : alertCount}
                </span>
              )}
            </Link>
          );
        })}
      </nav>
      <div className="px-5 py-3 border-t border-[var(--hairline)]">
        <div className="text-[10px] uppercase tracking-[0.12em] text-[var(--fg-muted)]">v1.0 · Phase 6</div>
        <div className="text-[10px] text-[var(--fg-faint)] mt-1">Editorial industrial</div>
      </div>
    </aside>
  );
}
