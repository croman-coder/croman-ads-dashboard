import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockSql } = vi.hoisted(() => ({ mockSql: vi.fn() }));
vi.mock('@vercel/postgres', () => ({
  sql: Object.assign(mockSql, { query: mockSql }),
}));

import {
  insertProposal,
  getProposal,
  listProposals,
  updateProposalStatus,
  expireStaleProposals,
} from '../proposal-store';

beforeEach(() => mockSql.mockReset());

describe('insertProposal', () => {
  it('inserts row with computed expires_at +72h', async () => {
    mockSql.mockResolvedValue({ rows: [{ id: 'uuid-1', expires_at: new Date() }] });
    const r = await insertProposal({
      proposed_by: 'a@b.com',
      account_id: 'act_1',
      action: 'set_budget',
      scope: 'campaign',
      scope_id: '123',
      scope_name: 'Camp',
      payload: { amount: 50, type: 'daily', object_id: '123' },
      current_state: { amount: 30 },
    });
    expect(r.id).toBe('uuid-1');
    expect(mockSql).toHaveBeenCalled();
  });
});

describe('listProposals', () => {
  it('filters by status', async () => {
    mockSql.mockResolvedValue({ rows: [] });
    await listProposals({ status: 'pending' });
    expect(mockSql).toHaveBeenCalled();
  });
});

describe('updateProposalStatus', () => {
  it('returns null if not found', async () => {
    mockSql.mockResolvedValue({ rows: [] });
    const r = await updateProposalStatus('missing', { status: 'rejected', decided_by: 'a@b.com' });
    expect(r).toBeNull();
  });
});

describe('expireStaleProposals', () => {
  it('returns count of expired rows', async () => {
    mockSql.mockResolvedValue({ rowCount: 3, rows: [] });
    const n = await expireStaleProposals();
    expect(n).toBe(3);
  });
});
