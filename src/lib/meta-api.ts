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

/* ---------- Pages + Forms ---------- */

export async function listPromotePages(accountId: string) {
  const id = accountId.startsWith('act_') ? accountId : `act_${accountId}`;
  const r = await metaGet<{ id: string; name: string }>(`/${id}/promote_pages`, {
    fields: 'id,name,category',
    limit: 50,
  });
  return r.data;
}

export async function getPageAccessToken(pageId: string): Promise<string | null> {
  const r = await metaGet<{ id: string; name: string; access_token?: string }>(`/me/accounts`, {
    fields: 'id,name,access_token',
    limit: 100,
  });
  const found = r.data.find((p) => p.id === pageId);
  return found?.access_token || null;
}

export async function listPageLeadForms(pageId: string) {
  const token = await getPageAccessToken(pageId);
  if (!token) throw new Error(`No page access token available for page ${pageId}`);
  const url = new URL(`${BASE_URL}/${pageId}/leadgen_forms`);
  url.searchParams.set('access_token', token);
  url.searchParams.set('fields', 'id,name,status,locale,leads_count,created_time');
  url.searchParams.set('limit', '100');
  const all: Array<{ id: string; name: string; status?: string; leads_count?: number }> = [];
  let nextUrl: string | undefined = url.toString();
  while (nextUrl) {
    const res: Response = await fetch(nextUrl, { cache: 'no-store' });
    const json = await res.json();
    if (!res.ok || json.error) throw new Error(`Page API ${res.status}: ${json.error?.message || res.statusText}`);
    if (Array.isArray(json.data)) all.push(...json.data);
    nextUrl = json.paging?.next;
  }
  return all;
}

/* ---------- Media upload ---------- */

export async function uploadAdImage(accountId: string, base64: string): Promise<{ hash: string }> {
  const id = accountId.startsWith('act_') ? accountId : `act_${accountId}`;
  const res = await metaPost(`/${id}/adimages`, { bytes: base64 }) as { images?: Record<string, { hash: string }> };
  const images = res.images || {};
  const first = Object.values(images)[0];
  if (!first?.hash) throw new Error(`No image_hash returned: ${JSON.stringify(res).slice(0, 200)}`);
  return { hash: first.hash };
}

/* ---------- Ad creative swap ---------- */

interface CreativeSpec {
  page_id?: string;
  instagram_user_id?: string;
  link_data?: {
    call_to_action?: { value?: { lead_gen_form_id?: string; link?: string } };
    [k: string]: unknown;
  };
  video_data?: {
    call_to_action?: { value?: { lead_gen_form_id?: string; link?: string } };
    [k: string]: unknown;
  };
}

export async function getCreative(creativeId: string) {
  const r = await metaGet(`/${creativeId}`, {
    fields: 'id,name,object_story_spec,asset_feed_spec',
  }, { paginate: false });
  return Array.isArray(r.data) ? r.data[0] : r;
}

export async function getAd(adId: string) {
  const r = await metaGet(`/${adId}`, {
    fields: 'id,name,status,effective_status,adset_id,creative{id,name,object_story_spec,asset_feed_spec,call_to_action_type}',
  }, { paginate: false });
  return Array.isArray(r.data) ? r.data[0] : r;
}

export async function swapLeadFormOnAd(adId: string, newFormId: string, accountId: string): Promise<{ new_creative_id: string }> {
  const ad = await getAd(adId) as { name: string; creative: { id: string; name: string; object_story_spec?: CreativeSpec } };
  if (!ad.creative?.object_story_spec) throw new Error('Creative without object_story_spec (asset_feed_spec not supported in this API)');
  const spec: CreativeSpec = JSON.parse(JSON.stringify(ad.creative.object_story_spec));
  const target = spec.link_data || spec.video_data;
  if (!target) throw new Error('Creative missing link_data/video_data');
  if (!target.call_to_action) target.call_to_action = { value: {} };
  if (!target.call_to_action.value) target.call_to_action.value = {};
  target.call_to_action.value.lead_gen_form_id = newFormId;
  if (!target.call_to_action.value.link) target.call_to_action.value.link = 'http://fb.me/';

  const acctId = accountId.startsWith('act_') ? accountId : `act_${accountId}`;
  const newCreative = await metaPost(`/${acctId}/adcreatives`, {
    name: `${ad.creative.name} | swap`,
    object_story_spec: spec,
  }) as { id: string };
  await metaPost(`/${adId}`, { creative: { creative_id: newCreative.id } });
  return { new_creative_id: newCreative.id };
}

/* ---------- Campaign create wizard ---------- */

interface CampaignCreateInput {
  account_id: string;
  campaign_name: string;
  objective: string; // OUTCOME_LEADS, OUTCOME_TRAFFIC, etc
  adset_name: string;
  budget_amount: number;
  budget_type: 'daily' | 'lifetime';
  start_time?: string;
  end_time?: string;
  page_id: string;
  instagram_user_id?: string;
  targeting: Record<string, unknown>;
  ad_name: string;
  headline: string;
  description?: string;
  message: string;
  image_hash: string;
  lead_gen_form_id?: string;
  call_to_action?: string;
}

export async function createCampaignWizard(input: CampaignCreateInput) {
  const acct = input.account_id.startsWith('act_') ? input.account_id : `act_${input.account_id}`;

  // 1. Campaign
  const camp = await metaPost(`/${acct}/campaigns`, {
    name: input.campaign_name,
    objective: input.objective,
    status: 'PAUSED',
    special_ad_categories: ['NONE'],
    is_adset_budget_sharing_enabled: false,
  }) as { id: string };

  // 2. Ad set
  const budgetCents = Math.round(input.budget_amount * 100);
  const adsetBody: Record<string, unknown> = {
    name: input.adset_name,
    campaign_id: camp.id,
    status: 'PAUSED',
    billing_event: 'IMPRESSIONS',
    optimization_goal: input.objective === 'OUTCOME_LEADS' ? 'LEAD_GENERATION' : 'LINK_CLICKS',
    bid_strategy: 'LOWEST_COST_WITHOUT_CAP',
    targeting: input.targeting,
  };
  if (input.budget_type === 'daily') {
    adsetBody.daily_budget = budgetCents;
  } else {
    adsetBody.lifetime_budget = budgetCents;
    if (!input.start_time || !input.end_time) {
      throw new Error('Lifetime budget requires start_time and end_time');
    }
    adsetBody.start_time = input.start_time;
    adsetBody.end_time = input.end_time;
  }
  if (input.objective === 'OUTCOME_LEADS') {
    adsetBody.destination_type = 'ON_AD';
    adsetBody.promoted_object = { page_id: input.page_id };
  }
  const adset = await metaPost(`/${acct}/adsets`, adsetBody) as { id: string };

  // 3. Creative
  const cta = input.call_to_action || (input.objective === 'OUTCOME_LEADS' ? 'GET_QUOTE' : 'LEARN_MORE');
  const linkData: Record<string, unknown> = {
    link: 'http://fb.me/',
    message: input.message,
    name: input.headline,
    description: input.description || '',
    image_hash: input.image_hash,
    call_to_action: {
      type: cta,
      value: {
        ...(input.lead_gen_form_id ? { lead_gen_form_id: input.lead_gen_form_id } : {}),
        link: 'http://fb.me/',
      },
    },
  };
  const creative = await metaPost(`/${acct}/adcreatives`, {
    name: `Creative - ${input.ad_name}`,
    object_story_spec: {
      page_id: input.page_id,
      ...(input.instagram_user_id ? { instagram_user_id: input.instagram_user_id } : {}),
      link_data: linkData,
    },
  }) as { id: string };

  // 4. Ad
  const ad = await metaPost(`/${acct}/ads`, {
    name: input.ad_name,
    adset_id: adset.id,
    creative: { creative_id: creative.id },
    status: 'PAUSED',
  }) as { id: string };

  return {
    campaign_id: camp.id,
    adset_id: adset.id,
    creative_id: creative.id,
    ad_id: ad.id,
  };
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

export async function getCurrentBudget(objectId: string): Promise<{ amount: number; type: 'daily' | 'lifetime' } | null> {
  const r = await metaGet(`/${objectId}`, { fields: 'daily_budget,lifetime_budget' }, { paginate: false });
  const row = (Array.isArray(r.data) ? r.data[0] : r) as { daily_budget?: string; lifetime_budget?: string };
  if (row?.daily_budget) return { amount: Number(row.daily_budget) / 100, type: 'daily' };
  if (row?.lifetime_budget) return { amount: Number(row.lifetime_budget) / 100, type: 'lifetime' };
  return null;
}
