import { NextResponse } from 'next/server';
import { listAdSets, getAdSet, getInsights } from '@/lib/meta-api';

export const dynamic = 'force-dynamic';

type AdSet = { id: string; effective_status: string; [k: string]: unknown };
type InsightRow = { adset_id?: string; spend?: string; impressions?: string };

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const adsetId = url.searchParams.get('id');
    if (adsetId) {
      const data = await getAdSet(adsetId);
      return NextResponse.json({ data });
    }
    const accountId = url.searchParams.get('account_id');
    if (!accountId) return NextResponse.json({ error: 'account_id or id required' }, { status: 400 });

    const adsets = (await listAdSets(accountId)) as AdSet[];

    // delivering = ACTIVE + recent (last 3d) spend/impressions > 0
    const today = new Date();
    const since = new Date(today); since.setDate(since.getDate() - 3);
    const fmt = (d: Date) => d.toISOString().slice(0, 10);
    let recent: InsightRow[] = [];
    try {
      recent = (await getInsights(accountId, {
        level: 'adset',
        since: fmt(since),
        until: fmt(today),
        fields: 'adset_id,spend,impressions',
      })) as InsightRow[];
    } catch { recent = []; }
    const map = new Map<string, { spend: number; impressions: number }>();
    for (const r of recent) {
      if (!r.adset_id) continue;
      map.set(r.adset_id, { spend: Number(r.spend || 0), impressions: Number(r.impressions || 0) });
    }

    const data = adsets.map((a) => {
      const m = map.get(a.id);
      const has = !!m && (m.spend > 0 || m.impressions > 0);
      return { ...a, delivering: a.effective_status === 'ACTIVE' && has };
    });
    return NextResponse.json({ data });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
