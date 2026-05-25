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

async function safe<T>(fn: () => Promise<T>): Promise<{ data: T; error?: undefined } | { data?: undefined; error: string; code?: number }> {
  try {
    const data = await fn();
    return { data };
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown';
    const codeMatch = msg.match(/\(#(\d+)\)/);
    return { error: msg, code: codeMatch ? Number(codeMatch[1]) : undefined };
  }
}

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const url = new URL(req.url);
    const since = url.searchParams.get('since') || undefined;
    const until = url.searchParams.get('until') || undefined;

    const [campaignR, adsR, adsetsR, insightsR] = await Promise.all([
      safe(() => getCampaign(id)),
      safe(() => getCampaignAds(id)),
      safe(() => getCampaignAdSets(id)),
      safe(() => getInsights(id, { since, until, level: 'campaign' })),
    ]);

    // Hard-fail only if campaign itself fails (rest are renderable empty).
    if (campaignR.error) {
      return NextResponse.json(
        {
          error: campaignR.error,
          code: campaignR.code,
          hint:
            campaignR.code === 200
              ? 'El token no tiene asset assignment para la cuenta dueña de esta campaña. Revisar /settings → Meta API.'
              : undefined,
        },
        { status: 403 }
      );
    }

    let insights: Record<string, unknown> | null = null;
    if (insightsR.data) {
      const arr = insightsR.data as Row[];
      if (arr[0]) {
        insights = {
          ...arr[0],
          leads: getAction(arr[0], 'lead'),
          msgs: getAction(arr[0], 'onsite_conversion.messaging_conversation_started_7d'),
        };
      }
    }

    // Surface partial errors so the UI can show 'ads no disponibles' instead of crashing.
    const partial_errors: Record<string, string> = {};
    if (adsR.error) partial_errors.ads = adsR.error;
    if (adsetsR.error) partial_errors.adsets = adsetsR.error;
    if (insightsR.error) partial_errors.insights = insightsR.error;

    return NextResponse.json({
      campaign: campaignR.data,
      ads: adsR.data || [],
      adsets: adsetsR.data || [],
      insights,
      partial_errors: Object.keys(partial_errors).length ? partial_errors : undefined,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
