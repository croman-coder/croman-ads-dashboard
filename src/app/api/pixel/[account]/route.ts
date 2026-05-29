import { NextResponse } from 'next/server';
import { requireSession } from '@/lib/api-auth';
import { getPixels, getPixelStats, getCapiStatus } from '@/lib/meta-api';

export const dynamic = 'force-dynamic';

export async function GET(_req: Request, ctx: { params: Promise<{ account: string }> }) {
  const session = await requireSession();
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const { account } = await ctx.params;
  try {
    const pixels = await getPixels(account);
    const enriched = await Promise.all(
      pixels.map(async (p) => {
        const [stats, capi] = await Promise.all([
          getPixelStats(p.id).catch(() => ({ events: [], total: 0, has_server_events: false })),
          getCapiStatus(p.id).catch(() => ({ configured: false })),
        ]);
        // Health: active if fired <24h, stale if pixel exists but no recent fire, missing handled at list level
        let health: 'active' | 'stale' | 'missing' = 'stale';
        if (p.last_fired_time) {
          const age = Date.now() - new Date(p.last_fired_time).getTime();
          health = age < 24 * 3600 * 1000 ? 'active' : 'stale';
        }
        return { ...p, stats, capi, health };
      })
    );
    return NextResponse.json({ pixels: enriched, account });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 });
  }
}
