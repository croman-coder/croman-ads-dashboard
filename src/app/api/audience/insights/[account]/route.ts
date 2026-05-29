import { NextResponse } from 'next/server';
import { requireSession } from '@/lib/api-auth';
import { getInsights } from '@/lib/meta-api';
import { scoreSegments, buildRecommendations, type RawRow } from '@/lib/audience-intelligence';

export const dynamic = 'force-dynamic';

const ALLOWED_BREAKDOWNS = new Set([
  'age',
  'gender',
  'age,gender',
  'region',
  'publisher_platform,platform_position',
  'device_platform',
  'impression_device',
]);

export async function GET(req: Request, ctx: { params: Promise<{ account: string }> }) {
  const session = await requireSession();
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const { account } = await ctx.params;
  const url = new URL(req.url);
  const breakdown = url.searchParams.get('breakdown') || 'age,gender';
  const since = url.searchParams.get('since') || undefined;
  const until = url.searchParams.get('until') || undefined;

  if (!ALLOWED_BREAKDOWNS.has(breakdown)) {
    return NextResponse.json({ error: 'breakdown no permitido' }, { status: 400 });
  }

  try {
    const rows = (await getInsights(account, {
      level: 'account',
      breakdowns: breakdown,
      since,
      until,
      fields: 'spend,impressions,clicks,ctr,actions',
    })) as RawRow[];

    const segments = scoreSegments(rows, breakdown);
    const analysis = buildRecommendations(segments);

    return NextResponse.json({ breakdown, segments, ...analysis, account });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 });
  }
}
