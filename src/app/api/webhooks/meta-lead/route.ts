import { NextResponse } from 'next/server';
import { getLeadgenLead, parseLeadFields } from '@/lib/meta-api';
import { createBitrixLead, findBitrixLeadByExternal, isBitrixConfigured } from '@/lib/bitrix';
import { resolveBitrixOwner } from '@/lib/user-store';

export const dynamic = 'force-dynamic';

/**
 * Meta Leadgen Webhook → Bitrix bridge.
 *
 * GET  = verification handshake (hub.challenge).
 * POST = leadgen event. Fetch lead → push to Bitrix crm.lead.add (deduped).
 *
 * This endpoint is PUBLIC (Meta calls it server-to-server). Security:
 *  - GET verified via META_WEBHOOK_VERIFY_TOKEN.
 *  - POST is best-effort; Meta signs with X-Hub-Signature-256 (HMAC app secret)
 *    — verified when META_APP_SECRET present.
 */

function verifyGet(url: URL): { ok: boolean; challenge?: string } {
  const mode = url.searchParams.get('hub.mode');
  const token = url.searchParams.get('hub.verify_token');
  const challenge = url.searchParams.get('hub.challenge');
  const expected = process.env.META_WEBHOOK_VERIFY_TOKEN;
  if (mode === 'subscribe' && token && expected && token === expected) {
    return { ok: true, challenge: challenge || '' };
  }
  return { ok: false };
}

export async function GET(req: Request) {
  const { ok, challenge } = verifyGet(new URL(req.url));
  if (!ok) return NextResponse.json({ error: 'verify failed' }, { status: 403 });
  // Meta expects raw challenge echoed
  return new Response(challenge || '', { status: 200, headers: { 'Content-Type': 'text/plain' } });
}

type LeadgenChange = {
  field?: string;
  value?: { leadgen_id?: string; form_id?: string; page_id?: string; campaign_id?: string };
};
type WebhookEntry = { changes?: LeadgenChange[] };

export async function POST(req: Request) {
  let body: { entry?: WebhookEntry[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'bad json' }, { status: 400 });
  }

  if (!isBitrixConfigured()) {
    // Acknowledge to Meta (avoid retries) but note not wired
    return NextResponse.json({ ok: true, note: 'BITRIX_WEBHOOK_URL ausente; lead no reenviado' });
  }

  const results: Array<{ leadgen_id?: string; status: string }> = [];

  for (const entry of body.entry || []) {
    for (const change of entry.changes || []) {
      if (change.field !== 'leadgen') continue;
      const leadgenId = change.value?.leadgen_id;
      if (!leadgenId) continue;
      const accountId = change.value?.page_id; // leadgen value carries page_id; account resolution best-effort
      try {
        // Dedup: skip if already in Bitrix (leadgen_id stored in comments)
        const dup = await findBitrixLeadByExternal(leadgenId);
        if (dup) {
          results.push({ leadgen_id: leadgenId, status: 'duplicate_skip' });
          continue;
        }
        const lead = await getLeadgenLead(leadgenId);
        const parsed = parseLeadFields(lead);
        // Resolve responsible Bitrix vendedor from the ad account owner mapping
        const assigned = accountId ? await resolveBitrixOwner(accountId).catch(() => null) : null;
        await createBitrixLead({
          name: parsed.name,
          phone: parsed.phone,
          email: parsed.email,
          source: lead.campaign_name || lead.form_name || 'Meta Lead Ad',
          comments: `Meta leadgen_id: ${leadgenId}\nForm: ${lead.form_name || '—'}\nCampaña: ${lead.campaign_name || '—'}`,
          utm_campaign: lead.campaign_name,
          assigned_by_id: assigned || undefined,
        });
        results.push({ leadgen_id: leadgenId, status: assigned ? `created (asignado ${assigned})` : 'created' });
      } catch (e) {
        results.push({ leadgen_id: leadgenId, status: `error: ${e instanceof Error ? e.message : 'unknown'}` });
      }
    }
  }

  return NextResponse.json({ ok: true, results });
}
