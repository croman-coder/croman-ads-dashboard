/**
 * TikTok Ads adapter — STUB.
 * Structure ready; wired once app approved + token provided.
 * Base: https://business-api.tiktok.com/open_api/v1.3/
 * Auth: OAuth 2.0. access_token via header `Access-Token`.
 *
 * Env (set after TikTok app approval):
 *   TIKTOK_APP_ID, TIKTOK_SECRET, TIKTOK_ACCESS_TOKEN, TIKTOK_ADVERTISER_ID
 */
import type {
  PlatformAdapter,
  PlatformAccount,
  PlatformCampaign,
  PlatformInsightRow,
  InsightOpts,
} from './types';
import { NotImplemented } from './types';

const BASE = 'https://business-api.tiktok.com/open_api/v1.3';

function token(): string | null {
  return process.env.TIKTOK_ACCESS_TOKEN || null;
}

/** TikTok GET — header auth + JSON. Returns data.list or data. */
async function ttGet<T = unknown>(path: string, params: Record<string, string | number> = {}): Promise<T> {
  const t = token();
  if (!t) throw new NotImplemented('tiktok', 'no TIKTOK_ACCESS_TOKEN');
  const url = new URL(`${BASE}${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v));
  const r = await fetch(url, { headers: { 'Access-Token': t } });
  const j = await r.json();
  if (j.code !== 0) throw new Error(`TikTok API ${j.code}: ${j.message}`);
  return j.data as T;
}

type TTAdvertiser = { advertiser_id: string; advertiser_name: string; currency: string };
type TTCampaign = {
  campaign_id: string;
  campaign_name: string;
  operation_status: string;
  objective_type?: string;
  budget?: number;
  budget_mode?: string;
};
type TTReport = {
  dimensions?: { campaign_id?: string };
  metrics?: Record<string, string>;
};

export const tiktokAdapter: PlatformAdapter = {
  id: 'tiktok',
  label: 'TikTok Ads',

  isConfigured() {
    return !!process.env.TIKTOK_ACCESS_TOKEN;
  },

  async listAccounts(): Promise<PlatformAccount[]> {
    // /oauth2/advertiser/get/ returns advertiser ids tied to token
    const data = await ttGet<{ list: TTAdvertiser[] }>('/advertiser/info/', {});
    return (data.list || []).map((a) => ({
      id: a.advertiser_id,
      name: a.advertiser_name,
      currency: a.currency,
      platform: 'tiktok',
    }));
  },

  async listCampaigns(accountId: string): Promise<PlatformCampaign[]> {
    const data = await ttGet<{ list: TTCampaign[] }>('/campaign/get/', { advertiser_id: accountId });
    return (data.list || []).map((c) => ({
      id: c.campaign_id,
      name: c.campaign_name,
      status: c.operation_status === 'ENABLE' ? 'ACTIVE' : 'PAUSED',
      effective_status: c.operation_status === 'ENABLE' ? 'ACTIVE' : 'PAUSED',
      objective: c.objective_type,
      daily_budget: c.budget_mode === 'BUDGET_MODE_DAY' && c.budget ? String(c.budget * 100) : undefined,
      lifetime_budget: c.budget_mode === 'BUDGET_MODE_TOTAL' && c.budget ? String(c.budget * 100) : undefined,
      platform: 'tiktok',
    }));
  },

  async getInsights(accountId: string, opts: InsightOpts = {}): Promise<PlatformInsightRow[]> {
    const data = await ttGet<{ list: TTReport[] }>('/report/integrated/get/', {
      advertiser_id: accountId,
      report_type: 'BASIC',
      data_level: 'AUCTION_CAMPAIGN',
      dimensions: JSON.stringify(['campaign_id']),
      metrics: JSON.stringify(['spend', 'impressions', 'clicks', 'ctr', 'cpm', 'reach', 'conversion']),
      start_date: opts.since || '',
      end_date: opts.until || '',
    });
    return (data.list || []).map((r) => {
      const m = r.metrics || {};
      return {
        campaign_id: r.dimensions?.campaign_id,
        spend: Number(m.spend || 0),
        impressions: Number(m.impressions || 0),
        clicks: Number(m.clicks || 0),
        ctr: Number(m.ctr || 0),
        cpm: Number(m.cpm || 0),
        reach: m.reach ? Number(m.reach) : undefined,
        leads: Number(m.conversion || 0),
        platform: 'tiktok',
      };
    });
  },

  async setStatus(objectId: string, status: 'ACTIVE' | 'PAUSED') {
    throw new NotImplemented('tiktok', `setStatus(${objectId}, ${status})`);
  },
};
