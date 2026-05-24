import { NextResponse } from 'next/server';
import { listPageLeadForms } from '@/lib/meta-api';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const pageId = url.searchParams.get('page_id');
    if (!pageId) return NextResponse.json({ error: 'page_id required' }, { status: 400 });
    const data = await listPageLeadForms(pageId);
    return NextResponse.json({ data });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
