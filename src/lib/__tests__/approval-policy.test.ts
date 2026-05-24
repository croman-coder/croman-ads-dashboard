import { describe, it, expect } from 'vitest';
import { requiresApproval, RISKY_ACTIONS } from '../approval-policy';

describe('requiresApproval', () => {
  it('returns true for risky actions', () => {
    expect(requiresApproval('set_budget')).toBe(true);
    expect(requiresApproval('activate')).toBe(true);
    expect(requiresApproval('create_campaign')).toBe(true);
    expect(requiresApproval('duplicate_campaign')).toBe(true);
  });
  it('returns false for safe actions', () => {
    expect(requiresApproval('rename')).toBe(false);
    expect(requiresApproval('pause')).toBe(false);
    expect(requiresApproval('update_targeting')).toBe(false);
    expect(requiresApproval('swap_form')).toBe(false);
  });
  it('returns false for unknown actions', () => {
    expect(requiresApproval('foo_bar')).toBe(false);
  });
  it('exports complete RISKY_ACTIONS set', () => {
    expect(RISKY_ACTIONS.size).toBe(4);
  });
});
