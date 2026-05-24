import { NextResponse } from 'next/server';
import { createCampaignWizard } from '@/lib/meta-api';
import { requiresApproval } from '@/lib/approval-policy';
import { insertProposal } from '@/lib/proposal-store';
import { requireSession } from '@/lib/api-auth';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(req: Request) {
  const session = await requireSession();
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  try {
    const body = await req.json();
    const required = [
      'account_id', 'campaign_name', 'objective', 'adset_name',
      'budget_amount', 'budget_type', 'page_id', 'targeting',
      'ad_name', 'headline', 'message', 'image_hash',
    ];
    for (const k of required) {
      if (body[k] === undefined || body[k] === null || body[k] === '') {
        return NextResponse.json({ error: `${k} required` }, { status: 400 });
      }
    }

    if (requiresApproval('create_campaign')) {
      const proposal = await insertProposal({
        proposed_by: session.email,
        account_id: body.account_id,
        action: 'create_campaign',
        scope: 'account',
        scope_id: null,
        scope_name: body.campaign_name,
        payload: body,
        current_state: null,
      });
      return NextResponse.json(
        { status: 'pending', proposal_id: proposal.id, message: 'Creación encolada' },
        { status: 202 }
      );
    }

    const result = await createCampaignWizard(body);
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 });
  }
}
