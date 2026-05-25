import { NextResponse } from 'next/server';
import { list, del } from '@vercel/blob';
import { requireSession } from '@/lib/api-auth';

export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await requireSession();
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json({ error: 'BLOB_READ_WRITE_TOKEN ausente' }, { status: 503 });
  }
  try {
    const { blobs } = await list({ prefix: 'creatives/', limit: 200 });
    return NextResponse.json({
      blobs: blobs.map((b) => ({
        url: b.url,
        pathname: b.pathname,
        size: b.size,
        uploadedAt: b.uploadedAt,
      })),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  const session = await requireSession();
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const url = new URL(req.url);
  const target = url.searchParams.get('url');
  if (!target) return NextResponse.json({ error: 'url required' }, { status: 400 });
  try {
    await del(target);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Unknown' }, { status: 500 });
  }
}
