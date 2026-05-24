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
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAlertCount } from '@/lib/use-alerts';
import { useApprovalCount } from '@/lib/use-approval-count';

type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  showBadge?: boolean;
  showApprovalBadge?: boolean;
};

type NavSection = { label: string; items: NavItem[] };

const SECTIONS: NavSection[] = [
  {
    label: 'Análisis',
    items: [
      { href: '/', label: 'Dashboard', icon: LayoutDashboard },
      { href: '/analytics', label: 'Analítica', icon: BarChart3 },
      { href: '/alerts', label: 'Alertas', icon: Bell, showBadge: true },
    ],
  },
  {
    label: 'Operación',
    items: [
      { href: '/creative/new', label: 'Crear con IA', icon: Sparkles },
      { href: '/campaigns', label: 'Campañas', icon: Megaphone },
      { href: '/ads', label: 'Anuncios', icon: ImageIcon },
      { href: '/audience', label: 'Audiencia', icon: Users },
      { href: '/budgets', label: 'Presupuestos', icon: Wallet },
    ],
  },
  {
    label: 'Control',
    items: [
      { href: '/approvals', label: 'Aprobaciones', icon: ShieldCheck, showApprovalBadge: true },
      { href: '/settings', label: 'Ajustes', icon: Settings },
    ],
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const alertCount = useAlertCount();
  const approvalCount = useApprovalCount();

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
      <nav className="flex-1 px-2 py-4 overflow-y-auto">
        {SECTIONS.map((section, idx) => (
          <div key={section.label} className={idx > 0 ? 'mt-5' : ''}>
            <div className="px-3 pb-1.5 text-[9px] font-bold uppercase tracking-[0.18em] text-[var(--fg-faint)]">
              {section.label}
            </div>
            <div className="space-y-px">
              {section.items.map(({ href, label, icon: Icon, showBadge, showApprovalBadge }) => {
                const active = pathname === href || (href !== '/' && pathname.startsWith(href));
                return (
                  <Link
                    key={href}
                    href={href}
                    className={cn(
                      'flex items-center gap-3 px-3 py-2 rounded-md text-[13px] transition-all duration-150 relative group',
                      active
                        ? 'bg-[var(--accent-soft)] text-[var(--fg)]'
                        : 'text-[var(--fg-soft)] hover:text-[var(--fg)] hover:bg-[var(--surface)]'
                    )}
                  >
                    {active && (
                      <span className="absolute left-0 top-1.5 bottom-1.5 w-[2px] rounded-r bg-[var(--accent)]" />
                    )}
                    <Icon
                      size={15}
                      strokeWidth={active ? 2.25 : 2}
                      className={cn(
                        'transition-colors',
                        active ? 'text-[var(--accent)]' : 'text-[var(--fg-muted)] group-hover:text-[var(--fg-soft)]'
                      )}
                    />
                    <span className="font-medium flex-1">{label}</span>
                    {showBadge && alertCount > 0 && (
                      <span className="bg-[var(--danger)] text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full leading-none min-w-[18px] text-center">
                        {alertCount > 99 ? '99+' : alertCount}
                      </span>
                    )}
                    {showApprovalBadge && approvalCount > 0 && (
                      <span className="bg-[var(--accent)] text-[var(--accent-fg)] text-[10px] font-bold px-1.5 py-0.5 rounded-full leading-none min-w-[18px] text-center">
                        {approvalCount > 99 ? '99+' : approvalCount}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>
      <div className="px-5 py-3 border-t border-[var(--hairline)]">
        <div className="text-[10px] uppercase tracking-[0.12em] text-[var(--fg-muted)]">v1.0 · Phase 6</div>
        <div className="text-[10px] text-[var(--fg-faint)] mt-1">Editorial industrial</div>
      </div>
    </aside>
  );
}
