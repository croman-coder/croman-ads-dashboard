/**
 * Audience Intelligence heuristic engine.
 * Scores breakdown segments by lead volume, CPL efficiency, and CTR
 * to surface the target audience per account.
 */

export type Segment = {
  label: string;
  spend: number;
  impressions: number;
  clicks: number;
  leads: number;
  ctr: number;
  cpl: number | null;
  score: number;
  share_spend: number;
  share_leads: number;
};

export type RawRow = {
  spend?: string;
  impressions?: string;
  clicks?: string;
  ctr?: string;
  actions?: Array<{ action_type: string; value: string }>;
  age?: string;
  gender?: string;
  region?: string;
  publisher_platform?: string;
  platform_position?: string;
  device_platform?: string;
  impression_device?: string;
};

function leadCount(row: RawRow): number {
  const a = (row.actions || []).find((x) => x.action_type === 'lead');
  return a ? Number(a.value) : 0;
}

function labelFor(row: RawRow, breakdown: string): string {
  switch (breakdown) {
    case 'age': return row.age || '—';
    case 'gender': return row.gender === 'male' ? 'Hombres' : row.gender === 'female' ? 'Mujeres' : (row.gender || '—');
    case 'age,gender': {
      const g = row.gender === 'male' ? 'H' : row.gender === 'female' ? 'M' : '?';
      return `${g} ${row.age || '—'}`;
    }
    case 'region': return row.region || '—';
    case 'publisher_platform,platform_position': return `${row.publisher_platform || '—'} / ${row.platform_position || '—'}`;
    case 'device_platform': return row.device_platform || '—';
    case 'impression_device': return row.impression_device || '—';
    default: return '—';
  }
}

/**
 * Build scored segments. Higher score = better target.
 *   score = wL*(leads/totLeads) - wCPL*(cpl/avgCPL) + wCTR*(ctr/avgCTR)
 */
export function scoreSegments(rows: RawRow[], breakdown: string): Segment[] {
  const segs = rows.map((r) => {
    const spend = Number(r.spend || 0);
    const impressions = Number(r.impressions || 0);
    const clicks = Number(r.clicks || 0);
    const leads = leadCount(r);
    const ctr = Number(r.ctr || 0);
    const cpl = leads ? spend / leads : null;
    return { label: labelFor(r, breakdown), spend, impressions, clicks, leads, ctr, cpl };
  });

  const totLeads = segs.reduce((s, x) => s + x.leads, 0) || 1;
  const totSpend = segs.reduce((s, x) => s + x.spend, 0) || 1;
  const withCpl = segs.filter((s) => s.cpl != null);
  const avgCpl = withCpl.length ? withCpl.reduce((s, x) => s + (x.cpl as number), 0) / withCpl.length : 1;
  const avgCtr = segs.length ? segs.reduce((s, x) => s + x.ctr, 0) / segs.length : 1;

  const wL = 0.55, wCPL = 0.35, wCTR = 0.10;

  return segs
    .map((s): Segment => {
      const leadTerm = wL * (s.leads / totLeads);
      const cplTerm = s.cpl != null && avgCpl ? wCPL * (s.cpl / avgCpl) : wCPL; // penalize null cpl
      const ctrTerm = avgCtr ? wCTR * (s.ctr / avgCtr) : 0;
      const score = leadTerm - cplTerm + ctrTerm;
      return {
        ...s,
        score,
        share_spend: (s.spend / totSpend) * 100,
        share_leads: (s.leads / totLeads) * 100,
      };
    })
    .sort((a, b) => b.score - a.score);
}

export type Recommendation = {
  segment: string;
  cpl: number | null;
  vs_avg_pct: number | null;
  reason: string;
};

/** Best segments → human-readable recommendation. */
export function buildRecommendations(segments: Segment[]): {
  recommended: Recommendation[];
  underUtilized: Segment[];
  leaks: Segment[];
} {
  const withCpl = segments.filter((s) => s.cpl != null && s.leads >= 3);
  const avgCpl = withCpl.length ? withCpl.reduce((s, x) => s + (x.cpl as number), 0) / withCpl.length : 0;

  const recommended: Recommendation[] = withCpl
    .slice(0, 3)
    .map((s) => ({
      segment: s.label,
      cpl: s.cpl,
      vs_avg_pct: avgCpl ? (((s.cpl as number) - avgCpl) / avgCpl) * 100 : null,
      reason: `${s.leads} leads · ${s.share_spend.toFixed(0)}% del spend`,
    }));

  // under-utilized: good cpl (below avg), low spend share (<10%)
  const underUtilized = withCpl
    .filter((s) => (s.cpl as number) < avgCpl * 0.9 && s.share_spend < 10)
    .slice(0, 4);

  // leaks: high spend share (>10%), bad cpl (above avg 1.3x)
  const leaks = segments
    .filter((s) => s.share_spend > 10 && (s.cpl == null || (s.cpl as number) > avgCpl * 1.3))
    .slice(0, 4);

  return { recommended, underUtilized, leaks };
}
