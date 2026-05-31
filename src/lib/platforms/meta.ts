/**
 * Meta adapter — wraps existing meta-api.ts into the common PlatformAdapter.
 */
import {
  listAccounts as metaListAccounts,
  listCampaigns as metaListCampaigns,
  getInsights as metaGetInsights,
  setStatus as metaSetStatus,
  getAction,
} from '@/lib/meta-api';
import type {
  PlatformAdapter,
  PlatformAccount,
  PlatformCampaign,
  PlatformInsightRow,
  InsightOpts,
} from './types';

type RawAccount = { id: string; name: string; currency: string };
type RawCampaign = {
  id: string;
  name: string;
  status: string;
  effective_status: string;
  objective?: string;
  daily_budget?: string;
  lifetime_budget?: string;
};
type RawInsight = {
  campaign_id?: string;
  campaign_name?: string;
  spend?: string;
  impressions?: string;
  clicks?: string;
  ctr?: string;
  cpm?: string;
  reach?: string;
  frequency?: string;
  actions?: Array<{ action_type: string; value: string }>;
};

export const metaAdapter: PlatformAdapter = {
  id: 'meta',
  label: 'Meta',

  isConfigured() {
    return !!process.env.META_ACCESS_TOKEN;
  },

  async listAccounts(): Promise<PlatformAccount[]> {
    const data = (await metaListAccounts()) as RawAccount[];
    return data.map((a) => ({ id: a.id, name: a.name, currency: a.currency, platform: 'meta' }));
  },

  async listCampaigns(accountId: string): Promise<PlatformCampaign[]> {
    const data = (await metaListCampaigns(accountId)) as RawCampaign[];
    return data.map((c) => ({
      id: c.id,
      name: c.name,
      status: c.status,
      effective_status: c.effective_status,
      objective: c.objective,
      daily_budget: c.daily_budget,
      lifetime_budget: c.lifetime_budget,
      platform: 'meta',
    }));
  },

  async getInsights(accountId: string, opts: InsightOpts = {}): Promise<PlatformInsightRow[]> {
    const rows = (await metaGetInsights(accountId, {
      level: opts.level || 'campaign',
      since: opts.since,
      until: opts.until,
    })) as RawInsight[];
    return rows.map((r) => ({
      campaign_id: r.campaign_id,
      campaign_name: r.campaign_name,
      spend: Number(r.spend || 0),
      impressions: Number(r.impressions || 0),
      clicks: Number(r.clicks || 0),
      ctr: Number(r.ctr || 0),
      cpm: Number(r.cpm || 0),
      reach: r.reach ? Number(r.reach) : undefined,
      frequency: r.frequency ? Number(r.frequency) : undefined,
      leads: getAction(r, 'lead'),
      platform: 'meta',
    }));
  },

  async setStatus(objectId: string, status: 'ACTIVE' | 'PAUSED') {
    return metaSetStatus(objectId, status);
  },
};
