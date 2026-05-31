import { NextResponse } from 'next/server';
import { listCampaigns, getInsights, getAction } from '@/lib/meta-api';

export const dynamic = 'force-dynamic';

type Campaign = { id: string; effective_status: string; [k: string]: unknown };
type InsightRow = { campaign_id?: string; spend?: string; impressions?: string };

/**
 * Lists campaigns enriched with a `delivering` flag.
 *
 * effective_status ACTIVE alone is NOT enough — "Completado" campaigns
 * (past end date or exhausted budget) keep reporting ACTIVE. A campaign is
 * truly delivering only if it has spend/impressions in the last 3 days.
 */
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const accountId = url.searchParams.get('account_id');
    if (!accountId) return NextResponse.json({ error: 'account_id required' }, { status: 400 });

    const campaigns = (await listCampaigns(accountId)) as Campaign[];

    // last 3 days spend/impressions per campaign
    const today = new Date();
    const since = new Date(today); since.setDate(since.getDate() - 3);
    const fmt = (d: Date) => d.toISOString().slice(0, 10);

    let recent: InsightRow[] = [];
    try {
      recent = (await getInsights(accountId, {
        level: 'campaign',
        since: fmt(since),
        until: fmt(today),
        fields: 'campaign_id,spend,impressions',
      })) as InsightRow[];
    } catch {
      recent = [];
    }
    const activeSpend = new Map<string, { spend: number; impressions: number }>();
    for (const r of recent) {
      if (!r.campaign_id) continue;
      activeSpend.set(r.campaign_id, {
        spend: Number(r.spend || 0),
        impressions: Number(r.impressions || 0),
      });
    }

    const data = campaigns.map((c) => {
      const m = activeSpend.get(c.id);
      const hasRecentDelivery = !!m && (m.spend > 0 || m.impressions > 0);
      return {
        ...c,
        // delivering = status ACTIVE AND real recent delivery
        delivering: c.effective_status === 'ACTIVE' && hasRecentDelivery,
        recent_spend: m?.spend ?? 0,
        recent_impressions: m?.impressions ?? 0,
      };
    });

    return NextResponse.json({ data });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
