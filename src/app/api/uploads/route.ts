import { NextRequest, NextResponse } from 'next/server';
import { put } from '@vercel/blob';
import { requireSession } from '@/lib/api-auth';

const MAX_BYTES = 50 * 1024 * 1024; // 50MB
const ALLOWED_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'video/mp4',
  'video/quicktime',
  'video/webm',
]);

export async function POST(req: NextRequest) {
  const session = await requireSession();
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json(
      { error: 'BLOB_READ_WRITE_TOKEN no configurado. Provisionar Vercel Blob desde Dashboard → Storage.' },
      { status: 503 }
    );
  }

  const form = await req.formData();
  const files = form.getAll('files') as File[];
  if (!files.length) return NextResponse.json({ error: 'no files' }, { status: 400 });

  const uploaded: Array<{ url: string; name: string; size: number; type: string }> = [];
  const errors: string[] = [];

  for (const file of files) {
    if (!ALLOWED_TYPES.has(file.type)) {
      errors.push(`${file.name}: tipo no permitido (${file.type})`);
      continue;
    }
    if (file.size > MAX_BYTES) {
      errors.push(`${file.name}: excede 50MB`);
      continue;
    }
    const key = `creatives/${Date.now()}-${crypto.randomUUID()}-${file.name.replace(/[^\w.-]/g, '_')}`;
    const blob = await put(key, file, {
      access: 'public',
      contentType: file.type,
    });
    uploaded.push({ url: blob.url, name: file.name, size: file.size, type: file.type });
  }

  return NextResponse.json({ uploaded, errors });
}
