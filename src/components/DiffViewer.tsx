'use client';

import type { Proposal } from '@/lib/proposal-store';
import { fmtUSD } from '@/lib/utils';

export function DiffViewer({ proposal }: { proposal: Proposal }) {
  if (proposal.action === 'set_budget') return <BudgetDiff p={proposal} />;
  if (proposal.action === 'activate') return <ActivateDiff p={proposal} />;
  return <CreateCampaignDiff p={proposal} />;
}

function BudgetDiff({ p }: { p: Proposal }) {
  const cur = p.current_state as { amount?: number; type?: string } | null;
  const next = p.payload as { amount: number; type: string };
  const before = cur?.amount ?? 0;
  const after = next.amount;
  const delta = after - before;
  const pct = before ? ((delta / before) * 100).toFixed(0) : '∞';
  return (
    <div className="font-[family-name:var(--font-mono)] text-sm">
      <span className="text-[var(--fg-muted)]">{fmtUSD(before)}</span>
      <span className="mx-2 text-[var(--fg-faint)]">→</span>
      <span className="text-[var(--fg)] font-semibold">{fmtUSD(after)}</span>
      <span className={`ml-3 ${delta > 0 ? 'text-[var(--warning)]' : 'text-[var(--success)]'}`}>
        ({delta > 0 ? '+' : ''}{fmtUSD(Math.abs(delta))} · {pct}%)
      </span>
      <span className="ml-3 text-[10px] uppercase tracking-[0.12em] text-[var(--fg-muted)]">{next.type}</span>
    </div>
  );
}

function ActivateDiff({ p }: { p: Proposal }) {
  void p;
  return (
    <div className="font-[family-name:var(--font-mono)] text-sm flex items-center gap-2">
      <span className="dot dot-warning" />
      <span className="text-[var(--fg-muted)]">PAUSED</span>
      <span className="text-[var(--fg-faint)]">→</span>
      <span className="dot dot-success" />
      <span className="text-[var(--fg)] font-semibold">ACTIVE</span>
    </div>
  );
}

function CreateCampaignDiff({ p }: { p: Proposal }) {
  const body = p.payload as Record<string, unknown>;
  const rows: Array<[string, string]> = [
    ['Campaña', String(body.campaign_name ?? '')],
    ['Objetivo', String(body.objective ?? '')],
    ['Ad Set', String(body.adset_name ?? '')],
    ['Presupuesto', `${fmtUSD(Number(body.budget_amount ?? 0))} ${body.budget_type}`],
    ['Page', String(body.page_id ?? '')],
    ['Ad', String(body.ad_name ?? '')],
    ['Headline', String(body.headline ?? '')],
  ];
  return (
    <div className="space-y-1 text-sm font-[family-name:var(--font-mono)]">
      {rows.map(([k, v]) => (
        <div key={k} className="grid grid-cols-[120px_1fr] gap-2">
          <span className="text-[10px] uppercase tracking-[0.12em] text-[var(--fg-muted)] self-center">{k}</span>
          <span className="text-[var(--fg)] truncate">{v}</span>
        </div>
      ))}
    </div>
  );
}
