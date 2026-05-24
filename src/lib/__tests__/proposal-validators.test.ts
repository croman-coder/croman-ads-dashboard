import { describe, it, expect } from 'vitest';
import {
  validateBudgetPayload,
  validateActivatePayload,
  validateCreateCampaignPayload,
} from '../proposal-validators';

describe('validateBudgetPayload', () => {
  it('accepts valid daily budget', () => {
    const r = validateBudgetPayload({ object_id: '123', amount: 50, type: 'daily' });
    expect(r.success).toBe(true);
  });
  it('rejects amount > cap', () => {
    const r = validateBudgetPayload({ object_id: '123', amount: 2000, type: 'daily' });
    expect(r.success).toBe(false);
  });
  it('rejects invalid object_id', () => {
    const r = validateBudgetPayload({ object_id: 'abc!', amount: 50, type: 'daily' });
    expect(r.success).toBe(false);
  });
  it('rejects unknown type', () => {
    const r = validateBudgetPayload({ object_id: '123', amount: 50, type: 'monthly' });
    expect(r.success).toBe(false);
  });
});

describe('validateActivatePayload', () => {
  it('accepts valid object_id', () => {
    expect(validateActivatePayload({ object_id: '999' }).success).toBe(true);
  });
});

describe('validateCreateCampaignPayload', () => {
  it('accepts complete payload', () => {
    const r = validateCreateCampaignPayload({
      account_id: 'act_123',
      campaign_name: 'Test',
      objective: 'OUTCOME_LEADS',
      adset_name: 'AS',
      budget_amount: 50,
      budget_type: 'daily',
      page_id: '111',
      targeting: { age_min: 25 },
      ad_name: 'Ad',
      headline: 'H',
      message: 'M',
      image_hash: 'abc123',
    });
    expect(r.success).toBe(true);
  });
  it('rejects missing required fields', () => {
    expect(validateCreateCampaignPayload({ campaign_name: 'X' }).success).toBe(false);
  });
  it('rejects budget over cap', () => {
    const r = validateCreateCampaignPayload({
      account_id: 'act_123', campaign_name: 'T', objective: 'OUTCOME_LEADS',
      adset_name: 'A', budget_amount: 5000, budget_type: 'daily',
      page_id: '1', targeting: {}, ad_name: 'A', headline: 'H', message: 'M', image_hash: 'h',
    });
    expect(r.success).toBe(false);
  });
});
