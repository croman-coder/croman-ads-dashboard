export const RISKY_ACTIONS: ReadonlySet<string> = new Set([
  'set_budget',
  'activate',
  'create_campaign',
  'duplicate_campaign',
]);

export function requiresApproval(action: string): boolean {
  return RISKY_ACTIONS.has(action);
}

export type RiskyAction = 'set_budget' | 'activate' | 'create_campaign' | 'duplicate_campaign';
