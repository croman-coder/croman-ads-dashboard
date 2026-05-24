import { NextResponse } from 'next/server';
import { swapLeadFormOnAd } from '@/lib/meta-api';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const { ad_id, new_form_id, account_id } = await req.json();
    if (!ad_id || !new_form_id || !account_id) {
      return NextResponse.json({ error: 'ad_id + new_form_id + account_id required' }, { status: 400 });
    }
    const result = await swapLeadFormOnAd(ad_id, new_form_id, account_id);
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
