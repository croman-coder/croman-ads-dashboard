import { z } from 'zod';

const CAP = Number(process.env.BUDGET_CAP_USD || 1000);
const ID = z.string().regex(/^\d+$/, 'object_id must be digits only');
const ACCT = z.string().regex(/^act_\d+$/, 'account_id must match act_\\d+');

export const BudgetPayloadSchema = z.object({
  object_id: ID,
  amount: z.number().positive().max(CAP),
  type: z.enum(['daily', 'lifetime']),
});

export const ActivatePayloadSchema = z.object({
  object_id: ID,
});

export const CreateCampaignPayloadSchema = z.object({
  account_id: ACCT,
  campaign_name: z.string().min(1).max(200),
  objective: z.string().min(1),
  adset_name: z.string().min(1).max(200),
  budget_amount: z.number().positive().max(CAP),
  budget_type: z.enum(['daily', 'lifetime']),
  start_time: z.string().optional(),
  end_time: z.string().optional(),
  page_id: z.string().regex(/^\d+$/),
  instagram_user_id: z.string().regex(/^\d+$/).optional(),
  targeting: z.record(z.string(), z.unknown()),
  ad_name: z.string().min(1).max(200),
  headline: z.string().min(1).max(200),
  description: z.string().max(200).optional(),
  message: z.string().min(1).max(2000),
  image_hash: z.string().min(1),
  lead_gen_form_id: z.string().regex(/^\d+$/).optional(),
  call_to_action: z.string().optional(),
});

export function validateBudgetPayload(input: unknown) {
  return BudgetPayloadSchema.safeParse(input);
}
export function validateActivatePayload(input: unknown) {
  return ActivatePayloadSchema.safeParse(input);
}
export function validateCreateCampaignPayload(input: unknown) {
  return CreateCampaignPayloadSchema.safeParse(input);
}
