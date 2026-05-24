/**
 * Meta Marketing API client — server-side only.
 * Uses META_ACCESS_TOKEN from env.
 */

const VERSION = process.env.META_API_VERSION || 'v21.0';
const BASE_URL = `https://graph.facebook.com/${VERSION}`;

function getToken(): string {
  const t = process.env.META_ACCESS_TOKEN;
  if (!t) throw new Error('META_ACCESS_TOKEN missing in env');
  return t;
}

function buildUrl(path: string, params: Record<string, unknown> = {}): string {
  const url = new URL(`${BASE_URL}${path.startsWith('/') ? path : `/${path}`}`);
  url.searchParams.set('access_token', getToken());
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null) continue;
    url.searchParams.set(k, typeof v === 'object' ? JSON.stringify(v) : String(v));
  }
  return url.toString();
}

export async function metaGet<T = unknown>(
  path: string,
  params: Record<string, unknown> = {},
  opts: { paginate?: boolean; maxPages?: number } = {}
): Promise<{ data: T[] }> {
  const { paginate = true, maxPages = 50 } = opts;
  let url = buildUrl(path, params);
  const all: T[] = [];
  let pages = 0;

  while (url && pages < maxPages) {
    const res = await fetch(url, { cache: 'no-store' });
    const json = await res.json();

    if (!res.ok || json.error) {
      const msg = json.error?.message || res.statusText;
      throw new Error(`Meta API ${res.status}: ${msg}`);
    }

    if (Array.isArray(json.data)) {
      all.push(...json.data);
      url = paginate ? json.paging?.next : '';
      pages++;
    } else {
      return { data: [json as T] };
    }
  }

  return { data: all };
}

export async function metaPost(path: string, body: Record<string, unknown> = {}): Promise<unknown> {
  const url = buildUrl(path);
  const form = new URLSearchParams();
  for (const [k, v] of Object.entries(body)) {
    if (v === undefined || v === null) continue;
    form.append(k, typeof v === 'object' ? JSON.stringify(v) : String(v));
  }
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: form.toString(),
  });
  const json = await res.json();
  if (!res.ok || json.error) {
    const msg = json.error?.message || res.statusText;
    throw new Error(`Meta API ${res.status}: ${msg}`);
  }
  return json;
}

/* ---------- Helpers for action counts ---------- */

export type ActionItem = { action_type: string; value: string };

export function getAction(row: { actions?: ActionItem[] }, type: string): number {
  const a = (row.actions || []).find((x) => x.action_type === type);
  return a ? Number(a.value) : 0;
}

/* ---------- Domain queries ---------- */

export async function listAccounts() {
  const fields = 'id,account_id,name,account_status,currency,timezone_name,amount_spent';
  const r = await metaGet<{ id: string; name: string; currency: string }>('/me/adaccounts', {
    fields,
    limit: 200,
  });
  return r.data;
}

export async function listCampaigns(accountId: string) {
  const fields = 'id,name,status,effective_status,objective,daily_budget,lifetime_budget';
  const id = accountId.startsWith('act_') ? accountId : `act_${accountId}`;
  const r = await metaGet(`/${id}/campaigns`, { fields, limit: 200 });
  return r.data;
}

export async function listAds(accountId: string) {
  const fields = 'id,name,adset_id,campaign_id,effective_status,status,created_time';
  const id = accountId.startsWith('act_') ? accountId : `act_${accountId}`;
  const r = await metaGet(`/${id}/ads`, { fields, limit: 500 });
  return r.data;
}

export async function listAdSets(accountId: string) {
  const fields = 'id,name,campaign_id,status,effective_status,daily_budget,lifetime_budget,billing_event,optimization_goal,targeting,start_time,end_time';
  const id = accountId.startsWith('act_') ? accountId : `act_${accountId}`;
  const r = await metaGet(`/${id}/adsets`, { fields, limit: 500 });
  return r.data;
}

export async function getAdSet(adsetId: string) {
  const fields = 'id,name,campaign_id,status,effective_status,daily_budget,lifetime_budget,billing_event,optimization_goal,targeting,start_time,end_time';
  const r = await metaGet(`/${adsetId}`, { fields }, { paginate: false });
  return Array.isArray(r.data) ? r.data[0] : r;
}

export async function getCampaign(campaignId: string) {
  const fields = 'id,name,status,effective_status,objective,daily_budget,lifetime_budget';
  const r = await metaGet(`/${campaignId}`, { fields }, { paginate: false });
  return Array.isArray(r.data) ? r.data[0] : r;
}

/* ---------- Mutation helpers ---------- */

const VALID_STATUS = ['ACTIVE', 'PAUSED'] as const;
type ValidStatus = (typeof VALID_STATUS)[number];

export async function setStatus(objectId: string, status: string) {
  const upper = status.toUpperCase() as ValidStatus;
  if (!VALID_STATUS.includes(upper)) {
    throw new Error(`Invalid status ${status}. Allowed: ${VALID_STATUS.join(', ')}`);
  }
  return metaPost(`/${objectId}`, { status: upper });
}

export async function renameObject(objectId: string, name: string) {
  if (!name || name.trim().length === 0) throw new Error('Name required');
  return metaPost(`/${objectId}`, { name });
}

export async function setBudget(
  objectId: string,
  amount: number,
  type: 'daily' | 'lifetime'
) {
  const cents = Math.round(amount * 100);
  if (!Number.isFinite(cents) || cents <= 0) throw new Error(`Invalid amount ${amount}`);
  const field = type === 'lifetime' ? 'lifetime_budget' : 'daily_budget';
  return metaPost(`/${objectId}`, { [field]: cents });
}

export async function updateTargeting(adsetId: string, targeting: Record<string, unknown>) {
  return metaPost(`/${adsetId}`, { targeting });
}

export async function getInsights(
  accountId: string,
  opts: {
    level?: string;
    since?: string;
    until?: string;
    breakdowns?: string;
    fields?: string;
  } = {}
) {
  const id = accountId.startsWith('act_') ? accountId : `act_${accountId}`;
  const params: Record<string, unknown> = {
    level: opts.level || 'campaign',
    limit: 500,
    fields:
      opts.fields ||
      'campaign_id,campaign_name,adset_id,adset_name,ad_id,ad_name,spend,impressions,reach,clicks,ctr,cpc,cpm,frequency,actions,action_values',
  };
  if (opts.since && opts.until) {
    params.time_range = JSON.stringify({ since: opts.since, until: opts.until });
  } else {
    params.date_preset = 'last_30d';
  }
  if (opts.breakdowns) params.breakdowns = opts.breakdowns;
  const r = await metaGet(`/${id}/insights`, params);
  return r.data;
}
