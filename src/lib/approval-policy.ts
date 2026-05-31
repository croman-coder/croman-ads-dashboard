export const RISKY_ACTIONS: ReadonlySet<string> = new Set([
  'set_budget',
  'activate',
  'create_campaign',
  'duplicate_campaign',
  'create_audience',
  'create_lookalike',
  'upload_customer_list',
  'configure_capi',
]);

export function requiresApproval(action: string): boolean {
  return RISKY_ACTIONS.has(action);
}

export type RiskyAction =
  | 'set_budget'
  | 'activate'
  | 'create_campaign'
  | 'duplicate_campaign'
  | 'create_audience'
  | 'create_lookalike'
  | 'upload_customer_list'
  | 'configure_capi';
