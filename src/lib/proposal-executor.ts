import { setBudget, setStatus, createCampaignWizard } from './meta-api';
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
      default:
        return { ok: false, error: `Unknown action: ${p.action}` };
    }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Unknown error' };
  }
}
