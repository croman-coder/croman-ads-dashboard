/**
 * Common ad-platform interface. Each platform (Meta, TikTok, Google)
 * implements this so the dashboard talks to one shape regardless of source.
 */

export type PlatformId = 'meta' | 'tiktok' | 'google';

export type PlatformAccount = {
  id: string;
  name: string;
  currency: string;
  platform: PlatformId;
};

export type PlatformCampaign = {
  id: string;
  name: string;
  status: string;
  effective_status: string;
  objective?: string;
  daily_budget?: string;
  lifetime_budget?: string;
  platform: PlatformId;
};

export type PlatformInsightRow = {
  campaign_id?: string;
  campaign_name?: string;
  spend: number;
  impressions: number;
  clicks: number;
  ctr: number;
  cpm: number;
  reach?: number;
  frequency?: number;
  leads: number;
  platform: PlatformId;
};

export type InsightOpts = {
  level?: 'account' | 'campaign' | 'adset' | 'ad';
  since?: string;
  until?: string;
};

/** Every platform adapter implements these. Unsupported ops throw NotImplemented. */
export interface PlatformAdapter {
  readonly id: PlatformId;
  readonly label: string;
  isConfigured(): boolean;
  listAccounts(): Promise<PlatformAccount[]>;
  listCampaigns(accountId: string): Promise<PlatformCampaign[]>;
  getInsights(accountId: string, opts?: InsightOpts): Promise<PlatformInsightRow[]>;
  setStatus(objectId: string, status: 'ACTIVE' | 'PAUSED'): Promise<unknown>;
}

export class NotImplemented extends Error {
  constructor(platform: string, op: string) {
    super(`${platform}: ${op} not implemented yet`);
    this.name = 'NotImplemented';
  }
}
