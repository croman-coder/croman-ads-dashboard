'use client';

import { Sparkles, TrendingUp, TrendingDown, AlertTriangle, CircleDot } from 'lucide-react';
import { fmtUSD } from '@/lib/utils';

type Row = {
  campaign_id: string;
  campaign_name: string;
  spend: string;
  impressions: string;
  clicks: string;
  ctr?: string;
  frequency?: string;
  leads: number;
  msgs?: number;
};

type Totals = {
  spend: number;
  impressions: number;
  clicks: number;
  leads: number;
  msgs: number;
};

type Insight = {
  tone: 'good' | 'warn' | 'bad' | 'info';
  title: string;
  body: string;
};

function buildInsights(rows: Row[], totals: Totals, prev: Totals): Insight[] {
  const out: Insight[] = [];
  if (!rows.length) return out;

  // 1. Spend / leads delta narrative
  if (prev.spend > 0) {
    const spendDelta = ((totals.spend - prev.spend) / prev.spend) * 100;
    const leadDelta = prev.leads ? ((totals.leads - prev.leads) / prev.leads) * 100 : 0;
    if (Math.abs(spendDelta) > 5 || Math.abs(leadDelta) > 5) {
      const efficiency = leadDelta - spendDelta;
      out.push({
        tone: efficiency >= 0 ? 'good' : 'warn',
        title:
          efficiency >= 0
            ? `Eficiencia ${efficiency > 0 ? 'mejoró' : 'estable'} ${efficiency >= 0 ? '+' : ''}${efficiency.toFixed(1)}%`
            : `Eficiencia bajó ${efficiency.toFixed(1)}%`,
        body: `Inversión ${spendDelta > 0 ? '+' : ''}${spendDelta.toFixed(0)}% mientras leads ${leadDelta > 0 ? '+' : ''}${leadDelta.toFixed(0)}% vs período anterior.`,
      });
    }
  }

  // 2. Top campaign concentration
  const sortedBySpend = [...rows].sort((a, b) => Number(b.spend || 0) - Number(a.spend || 0));
  const top = sortedBySpend[0];
  if (top && totals.spend > 0) {
    const share = (Number(top.spend) / totals.spend) * 100;
    if (share > 40) {
      out.push({
        tone: share > 65 ? 'warn' : 'info',
        title: `Concentración en "${top.campaign_name.slice(0, 40)}"`,
        body: `Esta campaña absorbe ${share.toFixed(0)}% del spend total. Si pierde performance, todo el resultado cae.`,
      });
    }
  }

  // 3. High CPL alerts
  const highCpl = rows
    .filter((r) => r.leads > 0)
    .map((r) => ({ r, cpl: Number(r.spend) / r.leads }))
    .filter((x) => x.cpl > 5)
    .sort((a, b) => b.cpl - a.cpl);
  if (highCpl.length > 0) {
    const worst = highCpl[0];
    out.push({
      tone: 'bad',
      title: `${highCpl.length} campaña${highCpl.length > 1 ? 's' : ''} con CPL > $5`,
      body: `Peor: "${worst.r.campaign_name.slice(0, 40)}" a ${fmtUSD(worst.cpl)}/lead. Considerá pausar o revisar segmentación.`,
    });
  }

  // 4. Campaigns spending without conversions
  const dead = rows.filter((r) => Number(r.spend) > 10 && r.leads === 0);
  if (dead.length > 0) {
    out.push({
      tone: 'bad',
      title: `${dead.length} campaña${dead.length > 1 ? 's gastan' : ' gasta'} sin generar leads`,
      body: `Spend acumulado ${fmtUSD(dead.reduce((s, r) => s + Number(r.spend), 0))} sin un solo lead. Revisar creative o objetivo.`,
    });
  }

  // 5. Frequency fatigue
  const fatigued = rows.filter((r) => Number(r.frequency || 0) > 3.5);
  if (fatigued.length > 0) {
    out.push({
      tone: 'warn',
      title: `${fatigued.length} campaña${fatigued.length > 1 ? 's' : ''} con frecuencia > 3.5`,
      body: 'Audiencia agotada, mismo usuario ve el ad demasiadas veces. Ampliar segmentación o rotar creative.',
    });
  }

  // 6. CTR benchmark
  const ctr = totals.impressions ? (totals.clicks / totals.impressions) * 100 : 0;
  if (ctr > 0) {
    if (ctr < 0.8) {
      out.push({
        tone: 'warn',
        title: `CTR ${ctr.toFixed(2)}% bajo el benchmark`,
        body: 'Benchmark Meta auto: 0.8–1.5%. Probar hooks nuevos en los primeros 3 segundos del creative.',
      });
    } else if (ctr > 2) {
      out.push({
        tone: 'good',
        title: `CTR ${ctr.toFixed(2)}% sobre benchmark`,
        body: 'Performance fuerte vs promedio Meta auto. Considerá escalar el spend en las campañas top.',
      });
    }
  }

  // 7. Total summary if all clean
  if (out.length === 0) {
    out.push({
      tone: 'good',
      title: 'Sin alertas críticas',
      body: `${rows.length} campañas activas operando dentro de rangos saludables. Período actual: ${fmtUSD(totals.spend)} spend → ${totals.leads} leads.`,
    });
  }

  return out;
}

const TONE_CONFIG = {
  good: { icon: TrendingUp, color: 'text-[var(--success)]', border: 'border-l-[var(--success)]' },
  warn: { icon: AlertTriangle, color: 'text-[var(--warning)]', border: 'border-l-[var(--warning)]' },
  bad: { icon: TrendingDown, color: 'text-[var(--danger)]', border: 'border-l-[var(--danger)]' },
  info: { icon: CircleDot, color: 'text-[var(--accent)]', border: 'border-l-[var(--accent)]' },
} as const;

export function AiInsights({ rows, totals, prevTotals }: { rows: Row[]; totals: Totals; prevTotals: Totals }) {
  const insights = buildInsights(rows, totals, prevTotals);

  return (
    <div className="card p-6">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <Sparkles size={14} className="text-[var(--accent)]" />
          <h2 className="display text-2xl text-[var(--fg)]">Insights</h2>
        </div>
        <span className="eyebrow">Análisis automático</span>
      </div>

      {rows.length === 0 ? (
        <p className="text-sm text-[var(--fg-muted)] py-8 text-center">
          Sin datos para analizar. Seleccioná una cuenta o cambiá el rango.
        </p>
      ) : (
        <div className="space-y-2.5">
          {insights.map((ins, i) => {
            const cfg = TONE_CONFIG[ins.tone];
            const Icon = cfg.icon;
            return (
              <div
                key={i}
                className={`bg-[var(--bg-deep)] border border-[var(--hairline)] border-l-2 ${cfg.border} px-4 py-3 flex items-start gap-3`}
              >
                <Icon size={14} className={`${cfg.color} shrink-0 mt-0.5`} strokeWidth={2.25} />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-[var(--fg)] leading-tight">{ins.title}</div>
                  <p className="text-[12.5px] text-[var(--fg-muted)] mt-1 leading-relaxed">{ins.body}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
