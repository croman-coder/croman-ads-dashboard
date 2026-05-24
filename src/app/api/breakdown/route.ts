import { NextResponse } from 'next/server';
import { getInsights, getAction } from '@/lib/meta-api';

export const dynamic = 'force-dynamic';

const VALID_BREAKDOWNS = new Set([
  'age',
  'gender',
  'age,gender',
  'publisher_platform,platform_position',
  'device_platform',
  'region',
  'country',
  'hourly_stats_aggregated_by_advertiser_time_zone',
]);

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const accountId = url.searchParams.get('account_id');
    const breakdowns = url.searchParams.get('breakdowns');
    if (!accountId || !breakdowns) {
      return NextResponse.json({ error: 'account_id + breakdowns required' }, { status: 400 });
    }
    if (!VALID_BREAKDOWNS.has(breakdowns)) {
      return NextResponse.json({ error: `Invalid breakdowns. Allowed: ${[...VALID_BREAKDOWNS].join(' | ')}` }, { status: 400 });
    }
    const since = url.searchParams.get('since') || undefined;
    const until = url.searchParams.get('until') || undefined;
    const data = await getInsights(accountId, { since, until, level: 'account', breakdowns });
    type Row = { spend?: string; impressions?: string; clicks?: string; ctr?: string; actions?: Array<{ action_type: string; value: string }> };
    const enriched = (data as Row[]).map((r) => ({
      ...r,
      leads: getAction(r, 'lead'),
    }));
    return NextResponse.json({ data: enriched });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
