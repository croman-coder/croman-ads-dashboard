import { describe, it, expect, vi, beforeEach } from 'vitest';

const setBudget = vi.fn();
const setStatus = vi.fn();
const createWizard = vi.fn();

vi.mock('@/lib/meta-api', () => ({
  setBudget: (...a: unknown[]) => setBudget(...a),
  setStatus: (...a: unknown[]) => setStatus(...a),
  createCampaignWizard: (...a: unknown[]) => createWizard(...a),
}));

import { executeProposal } from '../proposal-executor';
import type { Proposal } from '../proposal-store';

const baseProp: Proposal = {
  id: 'p1', created_at: '', expires_at: '', proposed_by: 'a',
  account_id: 'act_1', action: 'set_budget', scope: 'campaign',
  scope_id: '123', scope_name: 'C', payload: {}, current_state: null,
  reason: null, status: 'approved', decided_at: null, decided_by: null,
  decision_note: null, executed_at: null, meta_response: null, error: null,
};

beforeEach(() => { setBudget.mockReset(); setStatus.mockReset(); createWizard.mockReset(); });

describe('executeProposal', () => {
  it('calls setBudget for set_budget action', async () => {
    setBudget.mockResolvedValue({ ok: true });
    const r = await executeProposal({ ...baseProp,
      payload: { object_id: '123', amount: 50, type: 'daily' } });
    expect(setBudget).toHaveBeenCalledWith('123', 50, 'daily');
    expect(r.ok).toBe(true);
  });
  it('calls setStatus ACTIVE for activate', async () => {
    setStatus.mockResolvedValue({ ok: true });
    await executeProposal({ ...baseProp, action: 'activate',
      payload: { object_id: '123' } });
    expect(setStatus).toHaveBeenCalledWith('123', 'ACTIVE');
  });
  it('rejects payload that fails validation', async () => {
    const r = await executeProposal({ ...baseProp,
      payload: { object_id: 'abc!', amount: 5, type: 'daily' } });
    expect(r.ok).toBe(false);
    expect(setBudget).not.toHaveBeenCalled();
  });
  it('returns error on Meta API throw', async () => {
    setBudget.mockRejectedValue(new Error('Meta down'));
    const r = await executeProposal({ ...baseProp,
      payload: { object_id: '123', amount: 50, type: 'daily' } });
    expect(r.ok).toBe(false);
    expect(r.error).toContain('Meta down');
  });
});
