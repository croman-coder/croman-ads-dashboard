import { NextResponse } from 'next/server';
import { createHash } from 'crypto';
import { requireSession } from '@/lib/api-auth';
import { sendCapiEvent } from '@/lib/meta-api';

export const dynamic = 'force-dynamic';

/**
 * Conversions API ingest endpoint.
 *
 * SECURITY: PII (email, phone) arrives in plaintext here and is SHA256-hashed
 * SERVER-SIDE before any outbound call. Raw PII is NEVER logged or persisted.
 * Only normalized + hashed values leave this function.
 *
 * Auth: logged-in session OR x-capi-key header matching CAPI_INGEST_KEY
 * (for the external CRM source).
 */

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function normEmail(e: string): string {
  return e.trim().toLowerCase();
}

function normPhone(p: string): string {
  // Strip everything but digits → E.164-ish digits only
  return p.replace(/[^\d]/g, '');
}

async function authorize(req: Request): Promise<boolean> {
  const key = req.headers.get('x-capi-key');
  if (key && process.env.CAPI_INGEST_KEY && key === process.env.CAPI_INGEST_KEY) {
    return true;
  }
  const session = await requireSession();
  return !!session;
}

export async function POST(req: Request) {
  if (!(await authorize(req))) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'invalid body' }, { status: 400 });
  }

  const {
    pixel_id,
    event_name,
    event_time,
    event_id,
    email,
    phone,
    value,
    currency,
    fbc,
    fbp,
    action_source,
  } = body as Record<string, string | number | undefined>;

  if (!pixel_id || !event_name) {
    return NextResponse.json({ error: 'pixel_id + event_name required' }, { status: 400 });
  }

  // Build user_data with hashed PII only. Arrays per Meta CAPI spec.
  const user_data: Record<string, string[] | string> = {};
  if (typeof email === 'string' && email) user_data.em = [sha256(normEmail(email))];
  if (typeof phone === 'string' && phone) user_data.ph = [sha256(normPhone(phone))];
  if (typeof fbc === 'string' && fbc) user_data.fbc = fbc;
  if (typeof fbp === 'string' && fbp) user_data.fbp = fbp;

  const custom_data: Record<string, unknown> = {};
  if (value != null) custom_data.value = Number(value);
  if (currency) custom_data.currency = String(currency);

  try {
    const result = await sendCapiEvent(String(pixel_id), {
      event_name: String(event_name),
      event_time: event_time ? Number(event_time) : Math.floor(Date.now() / 1000),
      event_id: event_id ? String(event_id) : undefined,
      action_source: action_source ? String(action_source) : 'system_generated',
      user_data,
      custom_data: Object.keys(custom_data).length ? custom_data : undefined,
    });
    return NextResponse.json({
      ok: true,
      events_received: result.events_received,
      fbtrace_id: result.fbtrace_id,
      // Echo only hash counts + matched keys, NEVER raw PII
      matched: Object.keys(user_data),
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 });
  }
}
