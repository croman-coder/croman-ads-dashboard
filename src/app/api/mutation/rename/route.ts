import { NextResponse } from 'next/server';
import { renameObject } from '@/lib/meta-api';

const SUFFIX = ' | Claude';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const { object_id, name, append_suffix } = await req.json();
    if (!object_id) return NextResponse.json({ error: 'object_id required' }, { status: 400 });
    if (!name && !append_suffix) {
      return NextResponse.json({ error: 'name or append_suffix required' }, { status: 400 });
    }
    let finalName = name as string;
    if (append_suffix && !finalName.endsWith(SUFFIX)) finalName = finalName + SUFFIX;
    const result = await renameObject(object_id, finalName);
    return NextResponse.json({ ok: true, name: finalName, result });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
