import { NextResponse } from 'next/server';
import { getCampaign, getCampaignAds, getCampaignAdSets, getInsights, getAction } from '@/lib/meta-api';

export const dynamic = 'force-dynamic';

type Row = {
  spend?: string;
  impressions?: string;
  clicks?: string;
  reach?: string;
  ctr?: string;
  cpm?: string;
  frequency?: string;
  actions?: Array<{ action_type: string; value: string }>;
};

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const url = new URL(req.url);
    const since = url.searchParams.get('since') || undefined;
    const until = url.searchParams.get('until') || undefined;

    const [campaign, ads, adsets, insightsRaw] = await Promise.all([
      getCampaign(id),
      getCampaignAds(id),
      getCampaignAdSets(id),
      getInsights(id, { since, until, level: 'campaign' }),
    ]);

    const insightsArr = insightsRaw as Row[];
    const insights = insightsArr[0]
      ? {
          ...insightsArr[0],
          leads: getAction(insightsArr[0], 'lead'),
          msgs: getAction(insightsArr[0], 'onsite_conversion.messaging_conversation_started_7d'),
        }
      : null;

    return NextResponse.json({ campaign, ads, adsets, insights });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
