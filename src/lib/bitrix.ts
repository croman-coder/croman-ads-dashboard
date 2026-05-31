/**
 * Bitrix24 REST client via inbound webhook.
 * Env: BITRIX_WEBHOOK_URL = https://TUCUENTA.bitrix24.com/rest/1/CODE/
 *
 * No secret in code — webhook URL carries auth. Server-side only.
 */

function base(): string | null {
  const u = process.env.BITRIX_WEBHOOK_URL;
  if (!u) return null;
  return u.endsWith('/') ? u : `${u}/`;
}

export function isBitrixConfigured(): boolean {
  return !!process.env.BITRIX_WEBHOOK_URL;
}

async function call<T = unknown>(method: string, params: Record<string, unknown>): Promise<T> {
  const b = base();
  if (!b) throw new Error('BITRIX_WEBHOOK_URL no configurado');
  const r = await fetch(`${b}${method}.json`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  const j = await r.json();
  if (j.error) throw new Error(`Bitrix ${j.error}: ${j.error_description || ''}`);
  return j.result as T;
}

export type BitrixLead = {
  name?: string;
  phone?: string;
  email?: string;
  source?: string;       // ad campaign / form name
  comments?: string;
  utm_campaign?: string;
};

/** Create a CRM lead. Returns Bitrix lead id. */
export async function createBitrixLead(lead: BitrixLead): Promise<number> {
  const fields: Record<string, unknown> = {
    TITLE: lead.name ? `${lead.name} — Meta Ads` : 'Lead Meta Ads',
    NAME: lead.name || '',
    SOURCE_ID: 'WEB',
    SOURCE_DESCRIPTION: lead.source || 'Meta Lead Ad',
    COMMENTS: lead.comments || '',
  };
  if (lead.phone) fields.PHONE = [{ VALUE: lead.phone, VALUE_TYPE: 'WORK' }];
  if (lead.email) fields.EMAIL = [{ VALUE: lead.email, VALUE_TYPE: 'WORK' }];
  if (lead.utm_campaign) fields.UTM_CAMPAIGN = lead.utm_campaign;

  const id = await call<number>('crm.lead.add', { fields, params: { REGISTER_SONET_EVENT: 'Y' } });
  return id;
}

/** Check if a lead with this dedup key (e.g. meta leadgen_id in comments) exists. */
export async function findBitrixLeadByExternal(externalId: string): Promise<boolean> {
  try {
    const res = await call<Array<{ ID: string }>>('crm.lead.list', {
      filter: { '%COMMENTS': externalId },
      select: ['ID'],
    });
    return Array.isArray(res) && res.length > 0;
  } catch {
    return false;
  }
}
