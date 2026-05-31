import {
  setBudget,
  setStatus,
  createCampaignWizard,
  createWebsiteAudience,
  createEngagementAudience,
  createCustomerListAudience,
  createLookalike,
} from './meta-api';
import {
  validateBudgetPayload,
  validateActivatePayload,
  validateCreateCampaignPayload,
} from './proposal-validators';
import type { Proposal } from './proposal-store';

export interface ExecutionResult {
  ok: boolean;
  meta_response?: Record<string, unknown>;
  error?: string;
}

export async function executeProposal(p: Proposal): Promise<ExecutionResult> {
  try {
    switch (p.action) {
      case 'set_budget': {
        const v = validateBudgetPayload(p.payload);
        if (!v.success) return { ok: false, error: 'Payload invalid: ' + v.error.message };
        const r = await setBudget(v.data.object_id, v.data.amount, v.data.type);
        return { ok: true, meta_response: (r as Record<string, unknown>) ?? {} };
      }
      case 'activate': {
        const v = validateActivatePayload(p.payload);
        if (!v.success) return { ok: false, error: 'Payload invalid: ' + v.error.message };
        const r = await setStatus(v.data.object_id, 'ACTIVE');
        return { ok: true, meta_response: (r as Record<string, unknown>) ?? {} };
      }
      case 'create_campaign':
      case 'duplicate_campaign': {
        const v = validateCreateCampaignPayload(p.payload);
        if (!v.success) return { ok: false, error: 'Payload invalid: ' + v.error.message };
        const r = await createCampaignWizard(v.data);
        return { ok: true, meta_response: r as Record<string, unknown> };
      }
      case 'create_audience': {
        const pl = p.payload as Record<string, unknown>;
        const source = String(pl.source || '');
        const acct = String(pl.account_id || p.account_id);
        let r: { id: string };
        if (source === 'pixel') {
          r = await createWebsiteAudience(acct, {
            name: String(pl.name),
            pixel_id: String(pl.pixel_id),
            event: pl.event ? String(pl.event) : undefined,
            retention_days: Number(pl.retention_days || 30),
          });
        } else if (source === 'engagement') {
          r = await createEngagementAudience(acct, {
            name: String(pl.name),
            page_id: String(pl.page_id),
            engagement_type: (pl.engagement_type as 'page' | 'ig' | 'video' | 'leadform') || 'page',
            retention_days: Number(pl.retention_days || 90),
          });
        } else {
          return { ok: false, error: `create_audience: source inválido (${source})` };
        }
        return { ok: true, meta_response: r as unknown as Record<string, unknown> };
      }
      case 'upload_customer_list': {
        const pl = p.payload as Record<string, unknown>;
        const r = await createCustomerListAudience(String(pl.account_id || p.account_id), {
          name: String(pl.name),
          schema: String(pl.schema || 'EMAIL_SHA256'),
          hashed_data: (pl.hashed_data as string[]) || [],
        });
        return { ok: true, meta_response: r as unknown as Record<string, unknown> };
      }
      case 'create_lookalike': {
        const pl = p.payload as Record<string, unknown>;
        const r = await createLookalike(String(pl.account_id || p.account_id), {
          name: String(pl.name),
          origin_audience_id: String(pl.origin_audience_id),
          country: String(pl.country || 'PY'),
          ratio: Number(pl.ratio || 0.02),
        });
        return { ok: true, meta_response: r as unknown as Record<string, unknown> };
      }
      case 'configure_capi': {
        // Setup-only flag; actual event sends bypass gate. Record intent.
        return { ok: true, meta_response: { configured: true, pixel_id: (p.payload as Record<string, unknown>).pixel_id } };
      }
      default:
        return { ok: false, error: `Unknown action: ${p.action}` };
    }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Unknown error' };
  }
}
