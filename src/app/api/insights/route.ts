import { NextResponse } from 'next/server';
import { getInsights, listCampaigns, getAction } from '@/lib/meta-api';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const accountId = url.searchParams.get('account_id');
    if (!accountId) return NextResponse.json({ error: 'account_id required' }, { status: 400 });
    const since = url.searchParams.get('since') || undefined;
    const until = url.searchParams.get('until') || undefined;
    const level = url.searchParams.get('level') || 'campaign';
    const breakdowns = url.searchParams.get('breakdowns') || undefined;

    const data = await getInsights(accountId, { since, until, level, breakdowns });

    // enrich with leads + msgs
    type Row = {
      spend?: string;
      impressions?: string;
      clicks?: string;
      actions?: Array<{ action_type: string; value: string }>;
    };
    const enriched = (data as Row[]).map((r) => ({
      ...r,
      leads: getAction(r, 'lead'),
      msgs: getAction(r, 'onsite_conversion.messaging_conversation_started_7d'),
    }));

    return NextResponse.json({ data: enriched });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
