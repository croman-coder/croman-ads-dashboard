import { NextResponse } from 'next/server';
import { createCampaignWizard } from '@/lib/meta-api';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const required = [
      'account_id', 'campaign_name', 'objective', 'adset_name',
      'budget_amount', 'budget_type', 'page_id', 'targeting',
      'ad_name', 'headline', 'message', 'image_hash',
    ];
    for (const k of required) {
      if (body[k] === undefined || body[k] === null || body[k] === '') {
        return NextResponse.json({ error: `${k} required` }, { status: 400 });
      }
    }
    const result = await createCampaignWizard(body);
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
