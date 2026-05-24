import { NextResponse } from 'next/server';
import { uploadAdImage } from '@/lib/meta-api';

export const dynamic = 'force-dynamic';
// Allow up to 10MB image uploads
export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    const { account_id, base64 } = await req.json();
    if (!account_id || !base64) {
      return NextResponse.json({ error: 'account_id + base64 required' }, { status: 400 });
    }
    // strip data URI prefix if present
    const clean = base64.includes(',') ? base64.split(',')[1] : base64;
    const result = await uploadAdImage(account_id, clean);
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
