import { NextResponse } from 'next/server';
import { getInsights, getAction } from '@/lib/meta-api';
import { analyzeInsights, healthScore } from '@/lib/diagnostics';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

interface RawRow {
  spend?: string;
  impressions?: string;
  clicks?: string;
  ctr?: string;
  cpm?: string;
  frequency?: string;
  campaign_id?: string;
  campaign_name?: string;
  ad_id?: string;
  ad_name?: string;
  actions?: Array<{ action_type: string; value: string }>;
}

function enrich(r: RawRow) {
  return {
    ...r,
    leads: getAction(r, 'lead'),
  };
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const accountId = url.searchParams.get('account_id');
    if (!accountId) return NextResponse.json({ error: 'account_id required' }, { status: 400 });
    const since = url.searchParams.get('since') || undefined;
    const until = url.searchParams.get('until') || undefined;

    const [campRows, adRows] = await Promise.all([
      getInsights(accountId, { since, until, level: 'campaign' }),
      getInsights(accountId, { since, until, level: 'ad' }),
    ]);
    const camps = (campRows as RawRow[]).map(enrich);
    const ads = (adRows as RawRow[]).map(enrich);
    const alerts = analyzeInsights(camps, ads);
    const health = healthScore(alerts);
    return NextResponse.json({ alerts, health, counts: { campaigns: camps.length, ads: ads.length } });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
